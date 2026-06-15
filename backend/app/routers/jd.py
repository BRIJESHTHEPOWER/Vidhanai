"""
JD — Vidhan AI Voice Assistant & Law Tutor  (POST /jd/chat)

Three automatic modes:
  1. Website Assistant — returns ACTION: <code> for navigation commands
  2. Legal Assistant   — RAG + Groq legal explanation (voice-friendly)
  3. AI Law Tutor      — interactive teaching with examples and questions
"""
from typing import List, Optional
from fastapi import APIRouter, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.routers import rag_context_from_db, sanitize_input
from app.services.ai import generate_jd_response

router  = APIRouter(tags=["JD"])
limiter = Limiter(key_func=get_remote_address)


class HistoryItem(BaseModel):
    role: str   # "user" | "jd"
    text: str


class JDChatRequest(BaseModel):
    message:         str
    language:        Optional[str]            = "English"
    context_section: Optional[str]            = None   # lesson section context (tutor mode)
    history:         Optional[List[HistoryItem]] = []  # last few turns for continuity


@router.post("/jd/chat")
@limiter.limit("40/minute")
def jd_chat(request: Request, body: JDChatRequest):
    """
    Universal JD endpoint — auto-detects mode and responds via Groq.
    Response fields:
      response  str        — what JD speaks aloud
      action    str|null   — navigation code (e.g. "OPEN_TUTOR") or null
      mode      str        — "website_assistant" | "legal" | "tutor" | "error"
      rag_used  bool       — whether RAG context was found
    """
    message = sanitize_input((body.message or "").strip(), max_len=1000)
    if not message:
        return {"response": "I didn't catch that. Could you say that again?", "action": None, "mode": "error", "rag_used": False}

    # Try RAG lookup for legal context (skipped for obvious navigation commands)
    nav_words = {"open", "go to", "take me", "navigate", "launch", "start", "show", "home", "quiz", "comic", "detective", "chatbot", "tutor", "compare", "dashboard", "profile"}
    lower = message.lower()
    looks_like_nav = any(w in lower for w in nav_words) and len(message.split()) <= 8

    rag_ctx = ""
    if not looks_like_nav:
        try:
            rag_ctx = rag_context_from_db(message) or ""
        except Exception:
            rag_ctx = ""
        if not rag_ctx:
            try:
                from app.services.rag import find_relevant_law
                rag_ctx = find_relevant_law(message) or ""
            except Exception:
                rag_ctx = ""

    # Convert history to (role, text) tuples
    history = [(h.role, h.text) for h in (body.history or [])]

    return generate_jd_response(
        message=message,
        rag_context=rag_ctx,
        history=history,
        language=body.language or "English",
        context_section=body.context_section or "",
    )
