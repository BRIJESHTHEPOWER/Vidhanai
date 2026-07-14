"""
JD Teach router — voice-driven chapter-by-chapter lessons.

Pipeline: legal dataset (Mongo) -> Groq (JD teaching script) -> Sarvam TTS -> audio/wav

Endpoints:
  POST /jd/teach/start          — start a lesson session at a chapter/section
  GET  /jd/teach/audio/{sid}/{turn_id} — stream cached lesson audio
  POST /jd/teach/interrupt       — student asks a doubt mid-lesson
  POST /jd/teach/doubt-resolved  — student says doubt is clear (resume) or not (re-explain)
  POST /jd/teach/next            — advance to the next section
  GET  /jd/teach/session/{sid}   — current session state (for page reloads)
"""
import io
import logging
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.routers import sanitize_input
from app.routers.tutor import _get_chapters, _pun_to_str
from app.services import teaching
from app.services import sarvam_tts as sarvam_service
from app.services.plan_gate import require_pro

# JD voice lessons are Pro-only. Each endpoint is gated individually because
# /audio/{sid}/{turn_id} must stay header-free — it is played via <audio src>,
# which cannot send an Authorization header. Audio is only reachable through
# unguessable session/turn ids created by the Pro-gated /start.
_PRO = [Depends(require_pro)]

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jd/teach", tags=["JD Teach"])
limiter = Limiter(key_func=get_remote_address)

MAX_QUESTION_CHARS = 1000

# ── Session store ────────────────────────────────────────────────────────────
_SESSIONS: dict = {}
_SESSION_TTL = 60 * 60  # 1 hour


def _cleanup_sessions():
    now = time.monotonic()
    expired = [sid for sid, s in _SESSIONS.items() if now - s["last_access"] > _SESSION_TTL]
    for sid in expired:
        _SESSIONS.pop(sid, None)


def _get_session(session_id: str) -> dict:
    _cleanup_sessions()
    session = _SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired. Please start a new lesson.")
    session["last_access"] = time.monotonic()
    return session


def _normalize_sections(law_code: str, chapter_num: int):
    chapters = _get_chapters(law_code)
    chapter = next((ch for ch in chapters if ch["chapter_num"] == chapter_num), None)
    if not chapter:
        return None, None
    secs = []
    for s in chapter["sections"]:
        pun = _pun_to_str(s.get("punishment"))
        secs.append({
            "section_number": str(s.get("section_number", "")),
            "title":          s.get("title", ""),
            "text":           s.get("section_text") or s.get("description") or "",
            "punishment":     pun,
        })
    return chapter, secs


def _make_audio(text: str, session: dict) -> Optional[str]:
    """
    Synthesize audio via Sarvam AI only — no Kokoro, no browser TTS.
    Returns a turn_id (cached audio URL key) or None if Sarvam is unavailable.
    """
    if not sarvam_service.is_available():
        logger.warning("[JD Teach] Sarvam API key not set — returning text-only mode")
        return None

    language = session.get("language", "English")
    try:
        audio_bytes = sarvam_service.synthesize(text, language=language)
        logger.debug("[JD Teach] Sarvam synthesised %d bytes for language=%s", len(audio_bytes), language)
    except Exception as exc:
        logger.error("[JD Teach] Sarvam TTS failed: %s", exc)
        return None

    turn_id = uuid.uuid4().hex
    session["audio_cache"][turn_id] = audio_bytes
    return turn_id


def _section_payload(session: dict, text: str, turn_id: Optional[str]):
    idx = session["idx"]
    section = session["sections"][idx]
    return {
        "ok":             True,
        "session_id":     session["session_id"],
        "law_code":       session["law_code"],
        "chapter_num":    session["chapter_num"],
        "chapter_name":   session["chapter_name"],
        "section_index":  idx,
        "total_sections": len(session["sections"]),
        "is_last_section": idx == len(session["sections"]) - 1,
        "section": {
            "section_number": section["section_number"],
            "title":          section["title"],
        },
        "text":      text,
        "audio_url": f"/jd/teach/audio/{session['session_id']}/{turn_id}" if turn_id else None,
        "tts_available": sarvam_service.is_available(),
    }


# ── /start ──────────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    law_code:      str
    chapter_num:   int
    section_index: Optional[int] = 0
    mode:          Optional[str] = "general"   # single unified mode
    language:      Optional[str] = "English"


@router.post("/start", dependencies=_PRO)
@limiter.limit("15/minute")
def start_lesson(request: Request, body: StartRequest):
    law_code = body.law_code.upper().strip()
    if law_code not in ("BNS", "IPC"):
        raise HTTPException(status_code=400, detail="law_code must be BNS or IPC")

    chapter, sections = _normalize_sections(law_code, body.chapter_num)
    if chapter is None:
        raise HTTPException(status_code=404, detail="Chapter not found")
    if not sections:
        raise HTTPException(status_code=404, detail="Chapter has no sections")

    idx = body.section_index or 0
    idx = max(0, min(idx, len(sections) - 1))

    session_id = uuid.uuid4().hex
    session = {
        "session_id":   session_id,
        "law_code":     law_code,
        "chapter_num":  body.chapter_num,
        "chapter_name": chapter["chapter_name"],
        "sections":     sections,
        "idx":          idx,
        "mode":         "general",
        "language":     body.language or "English",
        "history":      [],
        "audio_cache":  {},
        "last_access":  time.monotonic(),
    }
    _SESSIONS[session_id] = session

    section = sections[idx]
    # Each lesson now opens by naming the section ("This is the BNS definition of ...").
    # No separate "Welcome" greeting is prepended — it was repeating on every (re)start.
    lesson_text = teaching.generate_teaching_script(
        law_code=law_code,
        section_number=section["section_number"],
        section_title=section["title"],
        section_text=section["text"],
        punishment=section["punishment"],
        mode=session["mode"],
        language=session["language"],
    )

    session["history"].append(("assistant", lesson_text))
    session["current_text"] = lesson_text

    turn_id = _make_audio(lesson_text, session)
    return _section_payload(session, lesson_text, turn_id)


# ── audio streaming ─────────────────────────────────────────────────────────

@router.get("/audio/{session_id}/{turn_id}")
@limiter.limit("60/minute")
def get_audio(request: Request, session_id: str, turn_id: str):
    session = _get_session(session_id)
    audio_bytes = session["audio_cache"].get(turn_id)
    if not audio_bytes:
        raise HTTPException(status_code=404, detail="Audio not found or expired")
    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/wav",
        headers={"Content-Disposition": "inline; filename=lesson.wav"},
    )


# ── /interrupt ─────────────────────────────────────────────────────────────

class InterruptRequest(BaseModel):
    session_id: str
    question:   str


@router.post("/interrupt", dependencies=_PRO)
@limiter.limit("20/minute")
def interrupt(request: Request, body: InterruptRequest):
    session = _get_session(body.session_id)
    question = sanitize_input(body.question, max_len=MAX_QUESTION_CHARS)
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")

    section = session["sections"][session["idx"]]
    session["history"].append(("user", question))

    answer = teaching.generate_doubt_answer(
        law_code=session["law_code"],
        section_number=section["section_number"],
        section_title=section["title"],
        section_text=section["text"],
        question=question,
        history=session["history"],
        language=session["language"],
        ask_clear=True,
    )
    session["history"].append(("assistant", answer))

    turn_id = _make_audio(answer, session)
    return {
        "ok":         True,
        "session_id": session["session_id"],
        "text":       answer,
        "audio_url":  f"/jd/teach/audio/{session['session_id']}/{turn_id}" if turn_id else None,
        "awaiting":   "doubt_clear",
        "tts_available": sarvam_service.is_available(),
    }


# ── /doubt-resolved ───────────────────────────────────────────────────────────

class DoubtResolvedRequest(BaseModel):
    session_id: str
    resolved:   bool


@router.post("/doubt-resolved", dependencies=_PRO)
@limiter.limit("20/minute")
def doubt_resolved(request: Request, body: DoubtResolvedRequest):
    session = _get_session(body.session_id)

    if body.resolved:
        # Frontend resumes the current section's lesson audio from where it paused.
        return {"ok": True, "session_id": session["session_id"], "resume": True}

    # Not clear -> re-explain the current section in a simpler way.
    section = session["sections"][session["idx"]]
    last_question = next((t for r, t in reversed(session["history"]) if r == "user"), "")

    answer = teaching.generate_doubt_answer(
        law_code=session["law_code"],
        section_number=section["section_number"],
        section_title=section["title"],
        section_text=section["text"],
        question=last_question or "Please re-explain the concept more simply.",
        history=session["history"],
        language=session["language"],
        ask_clear=True,
        reexplain=True,   # use different analogy / simpler approach
    )
    session["history"].append(("assistant", answer))

    turn_id = _make_audio(answer, session)
    return {
        "ok":         True,
        "session_id": session["session_id"],
        "resume":     False,
        "text":       answer,
        "audio_url":  f"/jd/teach/audio/{session['session_id']}/{turn_id}" if turn_id else None,
        "awaiting":   "doubt_clear",
        "tts_available": sarvam_service.is_available(),
    }


# ── /next ──────────────────────────────────────────────────────────────────

class NextRequest(BaseModel):
    session_id: str


@router.post("/next", dependencies=_PRO)
@limiter.limit("15/minute")
def next_section(request: Request, body: NextRequest):
    session = _get_session(body.session_id)

    if session["idx"] >= len(session["sections"]) - 1:
        return {
            "ok":   True,
            "done": True,
            "session_id": session["session_id"],
            "message": f"That's the end of {session['chapter_name']}. Great job completing this chapter!",
        }

    session["idx"] += 1
    section = session["sections"][session["idx"]]

    lesson_text = teaching.generate_teaching_script(
        law_code=session["law_code"],
        section_number=section["section_number"],
        section_title=section["title"],
        section_text=section["text"],
        punishment=section["punishment"],
        mode=session["mode"],
        language=session["language"],
    )
    session["history"].append(("assistant", lesson_text))
    session["current_text"] = lesson_text

    turn_id = _make_audio(lesson_text, session)
    return _section_payload(session, lesson_text, turn_id)


# ── session state (for reloads) ───────────────────────────────────────────────

@router.get("/session/{session_id}", dependencies=_PRO)
@limiter.limit("60/minute")
def get_session_state(request: Request, session_id: str):
    session = _get_session(session_id)
    return {
        "ok":             True,
        "session_id":     session["session_id"],
        "law_code":       session["law_code"],
        "chapter_num":    session["chapter_num"],
        "chapter_name":   session["chapter_name"],
        "section_index":  session["idx"],
        "total_sections": len(session["sections"]),
        "is_last_section": session["idx"] == len(session["sections"]) - 1,
        "section": {
            "section_number": session["sections"][session["idx"]]["section_number"],
            "title":          session["sections"][session["idx"]]["title"],
        },
        "text": session.get("current_text", ""),
    }
