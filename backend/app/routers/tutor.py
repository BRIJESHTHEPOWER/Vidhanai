"""
Tutor router — AI-powered Law Tutor for BNS 2023 and IPC 1860.
Teaches chapter-by-chapter with JD AI, mid-lesson checkpoints,
chapter assessments, and performance analysis.
"""
import re
import json
import logging
from typing import Optional, List
from fastapi import APIRouter, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import bns_collection, ipc_collection
from app.services.ai import _call_gemini, _PRIMARY_MODEL, generate_groq_json_response
from app.services.teaching import generate_doubt_answer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Tutor"])
limiter = Limiter(key_func=get_remote_address)

# ── Chapter badges ─────────────────────────────────────────────────────────────
CHAPTER_BADGES = [
    {"icon": "📜", "name": "Law Initiate",         "color": "#6366f1"},
    {"icon": "⚖️", "name": "Justice Explorer",      "color": "#3b82f6"},
    {"icon": "🛡️", "name": "Defense Scholar",       "color": "#06b6d4"},
    {"icon": "🔗", "name": "Conspiracy Expert",     "color": "#8b5cf6"},
    {"icon": "🏛️", "name": "State Guardian",        "color": "#f59e0b"},
    {"icon": "🎖️", "name": "Force Defender",        "color": "#ef4444"},
    {"icon": "🗳️", "name": "Democracy Champion",    "color": "#22c55e"},
    {"icon": "🕊️", "name": "Peacekeeper",           "color": "#14b8a6"},
    {"icon": "👮", "name": "Integrity Champion",    "color": "#f97316"},
    {"icon": "📋", "name": "Order Enforcer",        "color": "#a78bfa"},
    {"icon": "🔍", "name": "Evidence Master",       "color": "#34d399"},
    {"icon": "💰", "name": "Finance Guardian",      "color": "#fbbf24"},
    {"icon": "📏", "name": "Fair Trade Scholar",    "color": "#60a5fa"},
    {"icon": "🏥", "name": "Safety Advocate",       "color": "#4ade80"},
    {"icon": "🕌", "name": "Harmony Keeper",        "color": "#fb923c"},
    {"icon": "💪", "name": "Rights Defender",       "color": "#c084fc"},
    {"icon": "👨‍👩‍👧", "name": "Protection Expert",     "color": "#f472b6"},
    {"icon": "🏠", "name": "Property Law Expert",   "color": "#818cf8"},
    {"icon": "🔐", "name": "Trust Guardian",        "color": "#2dd4bf"},
    {"icon": "🎯", "name": "Grand Scholar",         "color": "#fcd34d"},
]

SPECIAL_BADGES = {
    "chapter_master":    {"icon": "🏅", "name": "Chapter Master",   "color": "#f59e0b", "desc": "Pass any chapter"},
    "chapter_expert":    {"icon": "🥇", "name": "Chapter Expert",   "color": "#fbbf24", "desc": "Score 90%+"},
    "perfect_scholar":   {"icon": "👑", "name": "Perfect Scholar",   "color": "#f97316", "desc": "Score 100%"},
    "bns_master":        {"icon": "⚖️", "name": "BNS Master",        "color": "#6366f1", "desc": "Complete BNS course"},
    "ipc_legend":        {"icon": "⚔️", "name": "IPC Legend",        "color": "#ef4444", "desc": "Complete IPC course"},
    "grand_jurist":      {"icon": "🏆", "name": "Grand Jurist",      "color": "#22d3ee", "desc": "Complete both courses"},
}

# ── Shared helpers ─────────────────────────────────────────────────────────────

def _pun_to_str(p) -> str:
    if isinstance(p, dict):
        parts = []
        if p.get("maximum_imprisonment"): parts.append(p["maximum_imprisonment"])
        if p.get("minimum_imprisonment"): parts.append(f"minimum {p['minimum_imprisonment']}")
        if p.get("fine"): parts.append(f"fine {p['fine']}")
        return " and ".join(parts) if parts else ""
    return (p or "").strip()


def _fetch_bns_chapters():
    docs = list(bns_collection.find({}, {"_id": 0, "section_number": 1, "chapter": 1,
                                          "title": 1, "description": 1, "ai_summary": 1,
                                          "punishment": 1, "is_punishable": 1, "important_definitions": 1}))
    chapters = {}
    for d in docs:
        ch = (d.get("chapter") or "General").strip()
        if ch not in chapters:
            chapters[ch] = []
        chapters[ch].append(d)

    result = []
    for i, (ch_name, sections) in enumerate(chapters.items()):
        sec_nums = [s.get("section_number", "") for s in sections if s.get("section_number")]
        result.append({
            "chapter_num":   i + 1,
            "chapter_name":  ch_name,
            "short_name":    ch_name.split(" - ")[-1].strip() if " - " in ch_name else ch_name,
            "section_count": len(sections),
            "sections":      sorted(sections, key=lambda s: str(s.get("section_number", ""))),
            "badge":         CHAPTER_BADGES[i % len(CHAPTER_BADGES)],
        })
    return result


def _fetch_ipc_chapters():
    docs = list(ipc_collection.find({}, {"_id": 0, "section_number": 1, "chapter": 1,
                                          "title": 1, "section_text": 1, "description": 1,
                                          "meaning": 1, "ai_summary": 1, "punishment": 1,
                                          "key_points": 1, "offence_category": 1}))
    chapters = {}
    for d in docs:
        ch = (d.get("chapter") or "General").strip()
        if ch not in chapters:
            chapters[ch] = []
        chapters[ch].append(d)

    result = []
    for i, (ch_name, sections) in enumerate(chapters.items()):
        result.append({
            "chapter_num":   i + 1,
            "chapter_name":  ch_name,
            "short_name":    ch_name.split(" - ")[-1].strip() if " - " in ch_name else ch_name,
            "section_count": len(sections),
            "sections":      sorted(sections, key=lambda s: str(s.get("section_number", ""))),
            "badge":         CHAPTER_BADGES[i % len(CHAPTER_BADGES)],
        })
    return result


# ── Cache ──────────────────────────────────────────────────────────────────────
import time as _time
_CH_CACHE: dict = {}
_CH_CACHE_TTL = 600  # 10 min


def _get_chapters(law_code: str):
    global _CH_CACHE
    key = law_code.upper()
    cached = _CH_CACHE.get(key)
    if cached and (_time.monotonic() - cached[1]) < _CH_CACHE_TTL:
        return cached[0]
    data = _fetch_bns_chapters() if key == "BNS" else _fetch_ipc_chapters()
    _CH_CACHE[key] = (data, _time.monotonic())
    return data


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/tutor/chapters/{law_code}")
@limiter.limit("60/minute")
def get_chapters(request: Request, law_code: str):
    """Return all chapters for BNS or IPC with metadata (no sections data to keep response small)."""
    try:
        chapters = _get_chapters(law_code)
        # Strip sections data from list endpoint
        return [
            {
                "chapter_num":   ch["chapter_num"],
                "chapter_name":  ch["chapter_name"],
                "short_name":    ch["short_name"],
                "section_count": ch["section_count"],
                "badge":         ch["badge"],
            }
            for ch in chapters
        ]
    except Exception as e:
        return []


@router.get("/tutor/chapter/{law_code}/{chapter_num}/sections")
@limiter.limit("60/minute")
def get_chapter_sections(request: Request, law_code: str, chapter_num: int):
    """Return all sections in a given chapter."""
    try:
        chapters = _get_chapters(law_code)
        chapter = next((ch for ch in chapters if ch["chapter_num"] == chapter_num), None)
        if not chapter:
            return {"error": "Chapter not found", "sections": []}
        secs = []
        for s in chapter["sections"]:
            pun = _pun_to_str(s.get("punishment"))
            secs.append({
                "section_number": s.get("section_number", ""),
                "title":          s.get("title", ""),
                "text":           s.get("section_text") or s.get("description") or "",
                "summary":        s.get("ai_summary") or s.get("meaning") or "",
                "punishment":     pun,
                "key_points":     s.get("key_points") or [],
                "definitions":    s.get("important_definitions") or [],
                "is_punishable":  bool(s.get("is_punishable") or pun),
            })
        return {
            "chapter_num":  chapter_num,
            "chapter_name": chapter["chapter_name"],
            "short_name":   chapter["short_name"],
            "badge":        chapter["badge"],
            "sections":     secs,
        }
    except Exception as e:
        return {"error": str(e), "sections": []}


# ── AI lesson generation ───────────────────────────────────────────────────────

class LessonRequest(BaseModel):
    law_code:       str
    section_number: str
    section_title:  str
    section_text:   str
    punishment:     Optional[str] = ""
    mode:           Optional[str] = "student"   # citizen | student | exam
    language:       Optional[str] = "English"
    context:        Optional[str] = ""          # surrounding sections for continuity


@router.post("/tutor/lesson")
@limiter.limit("30/minute")
def generate_lesson(request: Request, body: LessonRequest):
    """Generate a structured AI lesson for one section — JD teaching style (Groq, fast)."""
    mode_desc = {
        "citizen": "Use very simple everyday language. No legal jargon. Give relatable real-life examples.",
        "student": "Use proper legal terminology but explain every term simply. Detailed analysis for law students.",
        "exam":    "Focus on key points for exam preparation. Highlight important definitions, case scenarios, and common exam questions.",
    }.get(body.mode, "Use clear, accessible language.")

    lang_note = f"Write the entire lesson in {body.language}." if body.language != "English" else "Write in English."

    law_full = "BNS 2023 (Bharatiya Nyaya Sanhita)" if body.law_code.upper() == "BNS" else "IPC 1860 (Indian Penal Code)"

    system = f"""You are JD, an expert Indian law tutor teaching {law_full} like a real classroom professor.
Your job is to TEACH and EXPLAIN — never just repeat or rephrase the legal text.
Teaching mode: {body.mode.upper()}. {mode_desc}
{lang_note}

HOW TO TEACH (very important):
1. The "plain_explanation" MUST begin by naming what this is, e.g. "This is the {body.law_code} definition of {body.section_title}." or "This is the {body.law_code} provision on {body.section_title}." — then explain in your OWN simple words what it actually MEANS and how it works. NEVER copy the legal text verbatim. If the legal text is short or vague, expand it using your legal knowledge so the student truly understands the concept.
2. "why_it_exists" — explain WHY this law was made and what real problem it solves.
3. "real_example" is MANDATORY — a vivid 3-5 sentence story with named Indian characters (e.g. "Ravi was walking home when...") showing exactly when this applies. Never leave it empty.

Always return JSON with these exact keys:
{{
  "simple_title": "one-line friendly title for this section",
  "why_it_exists": "2-3 sentences on why this law was created, what real-world problem it solves",
  "plain_explanation": "Starts with 'This is the {body.law_code} definition/provision of ...' then 3-5 sentences explaining what it means in simple words — your own words, NOT the legal text",
  "key_concepts": ["concept 1", "concept 2", "concept 3"],
  "real_example": "REQUIRED vivid 3-5 sentence story with named Indian characters showing when this law applies",
  "when_applies": "Clear conditions when this law applies (2-3 short sentences)",
  "when_not_applies": "Key exceptions — when this law does NOT apply",
  "remember": "One memorable, quotable takeaway sentence",
  "checkpoint_question": {{
    "question": "A conceptual scenario-based MCQ testing real understanding (not section-number memorization)",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct": "A",
    "explanation": "Why this is correct and why the others are wrong"
  }}
}}
Output ONLY the JSON object. No markdown, no commentary."""

    user_text = f"""Teach this legal section now:

Law: {body.law_code} | Section {body.section_number}: {body.section_title}
Legal Text: {body.section_text[:800] or 'Not provided — use your legal knowledge of this section.'}
Punishment: {body.punishment or 'N/A'}
Nearby sections (context only): {body.context[:300] if body.context else 'None'}"""

    def _fallback():
        title = body.section_title or f"Section {body.section_number}"
        return {
            "ok": False,
            "lesson": {
                "simple_title": title,
                "why_it_exists": "This section sets out an important rule in Indian criminal law that the courts rely on.",
                "plain_explanation": (
                    f"This is the {body.law_code} provision on {title}. "
                    f"In simple terms, it explains the following: {body.section_text[:300]}".strip()
                ),
                "key_concepts": [],
                "real_example": "",
                "when_applies": "",
                "when_not_applies": "",
                "remember": title,
                "checkpoint_question": None,
            },
        }

    try:
        raw = (generate_groq_json_response(system, user_text, temperature=0.5, max_tokens=1200) or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        if not isinstance(data, dict) or not data.get("plain_explanation"):
            return _fallback()
        return {"ok": True, "lesson": data}
    except (json.JSONDecodeError, ValueError):
        return _fallback()
    except Exception as e:
        logger.error("[Tutor] Lesson generation failed: %s", e)
        return _fallback()


# ── Assessment generation ──────────────────────────────────────────────────────

class AssessRequest(BaseModel):
    law_code:     str
    chapter_num:  int
    chapter_name: str
    sections:     List[dict]          # [{section_number, title, text, punishment}]
    mode:         Optional[str] = "student"
    language:     Optional[str] = "English"


@router.post("/tutor/assess")
@limiter.limit("10/minute")
def generate_assessment(request: Request, body: AssessRequest):
    """Generate a 10-question chapter-end assessment."""
    lang_note = f"Write questions in {body.language}." if body.language != "English" else ""

    # Build context from sections
    context_lines = []
    for s in body.sections[:15]:  # cap at 15 sections for prompt size
        pun = _pun_to_str(s.get("punishment", ""))
        context_lines.append(
            f"Section {s.get('section_number')}: {s.get('title')}\n"
            f"Content: {str(s.get('text') or s.get('section_text') or '')[:300]}\n"
            f"Punishment: {pun or 'N/A'}"
        )
    context_str = "\n---\n".join(context_lines)

    mode_instructions = {
        "citizen": "Make questions conceptual and relatable. Use everyday scenarios.",
        "student": "Include definition-based, scenario-based, and application questions.",
        "exam":    "Focus on frequently tested points. Include tricky questions. Mix MCQ, True/False, and scenario.",
    }.get(body.mode, "")

    system = f"""You are an expert Indian law exam setter creating a chapter-end assessment.
{mode_instructions}
{lang_note}

Generate EXACTLY 10 questions. Mix these types:
- 5 Multiple Choice (4 options A/B/C/D)
- 3 True/False
- 2 Scenario-based (short case, pick the correct law application)

Output ONLY valid JSON array with exactly 10 objects:
[
  {{
    "type": "mcq",
    "question": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correct": "B",
    "explanation": "...",
    "topic": "concept name this tests"
  }},
  {{
    "type": "tf",
    "question": "True or False: ...",
    "options": ["A) True", "B) False"],
    "correct": "A",
    "explanation": "...",
    "topic": "..."
  }},
  ...
]
No markdown fences. Only the JSON array."""

    user_text = f"""Create a 10-question assessment for:
Law: {body.law_code} | {body.chapter_name}

Chapter Content:
{context_str}"""

    try:
        raw = _call_gemini(
            model_name=_PRIMARY_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user_text}],
            temperature=0.3,
            max_tokens=2000,
        ).strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        questions = json.loads(raw)
        if not isinstance(questions, list):
            raise ValueError("Not a list")
        # Ensure all have required fields
        validated = []
        for i, q in enumerate(questions[:10]):
            validated.append({
                "id":          i,
                "type":        q.get("type", "mcq"),
                "question":    q.get("question", ""),
                "options":     q.get("options", ["A) True", "B) False"]),
                "correct":     q.get("correct", "A"),
                "explanation": q.get("explanation", ""),
                "topic":       q.get("topic", "General"),
            })
        return {"ok": True, "questions": validated, "total": len(validated)}
    except Exception as e:
        return {"ok": False, "error": str(e), "questions": [], "total": 0}


# ── Performance analysis ───────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    law_code:       str
    chapter_name:   str
    score:          int
    total:          int
    correct_topics: List[str]
    wrong_topics:   List[str]
    mode:           Optional[str] = "student"
    language:       Optional[str] = "English"


@router.post("/tutor/analyze")
@limiter.limit("20/minute")
def analyze_performance(request: Request, body: AnalyzeRequest):
    """Generate AI performance feedback after assessment."""
    pct = round((body.score / body.total) * 100) if body.total else 0
    grade = "Excellent" if pct >= 90 else "Good" if pct >= 70 else "Needs Revision"
    lang_note = f"Respond in {body.language}." if body.language != "English" else ""

    system = f"""You are JD, a supportive law tutor. Give encouraging but honest feedback.
{lang_note}
Keep the response warm, motivating, and concise (under 150 words total).
Output ONLY valid JSON:
{{
  "message": "Personalized 2-sentence encouraging message addressing the student's performance",
  "strong_areas": ["topic 1", "topic 2"],
  "weak_areas": ["topic 1", "topic 2"],
  "recommendations": ["specific study tip 1", "specific study tip 2", "specific study tip 3"],
  "next_step": "One clear actionable sentence"
}}"""

    user_text = f"""Student completed {body.chapter_name} ({body.law_code})
Score: {body.score}/{body.total} ({pct}%) — {grade}
Strong topics: {', '.join(body.correct_topics[:5]) or 'None identified'}
Weak topics:   {', '.join(body.wrong_topics[:5]) or 'None identified'}
Mode: {body.mode}"""

    try:
        raw = _call_gemini(
            model_name=_PRIMARY_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user_text}],
            temperature=0.5,
            max_tokens=400,
        ).strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        return {
            "ok":      True,
            "score":   body.score,
            "total":   body.total,
            "pct":     pct,
            "grade":   grade,
            "passed":  pct >= 70,
            "analysis": data,
        }
    except Exception as e:
        return {
            "ok":    False,
            "score": body.score,
            "total": body.total,
            "pct":   pct,
            "grade": grade,
            "passed": pct >= 70,
            "analysis": {
                "message":         f"You scored {pct}% — {'great work!' if pct >= 70 else 'keep practicing!'}",
                "strong_areas":    body.correct_topics[:3],
                "weak_areas":      body.wrong_topics[:3],
                "recommendations": ["Review weak sections", "Re-read key definitions", "Take notes on concepts"],
                "next_step":       "Continue studying to improve your understanding.",
            },
        }


# ── In-lesson doubt answering ──────────────────────────────────────────────────

class DoubtRequest(BaseModel):
    law_code:       str
    section_number: str
    section_title:  str
    section_text:   Optional[str] = ""
    question:       str
    mode:           Optional[str] = "student"
    language:       Optional[str] = "English"


@router.post("/tutor/doubt")
@limiter.limit("30/minute")
def answer_doubt(request: Request, body: DoubtRequest):
    """Answer a student's in-lesson doubt about the current section using Groq (fast)."""
    try:
        answer = generate_doubt_answer(
            law_code=body.law_code,
            section_number=body.section_number,
            section_title=body.section_title,
            section_text=body.section_text or "",
            question=body.question,
            language=body.language or "English",
            ask_clear=False,
        )
        return {"ok": True, "answer": answer}
    except Exception as e:
        logger.error("[Tutor] Doubt answer failed: %s", e)
        return {"ok": False, "answer": "I couldn't process your question right now. Please try again.", "error": str(e)}
