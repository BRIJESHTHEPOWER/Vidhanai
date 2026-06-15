"""
Learn router — /learn/topics, /learn/topic/{ipc_section}, /learn/ask-ai
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import bns_collection
from app.routers import get_all_laws, rag_context_from_db, sanitize_input
from app.services.ai import generate_ai_response
from app.services.scenario import generate_scenario

router  = APIRouter(tags=["Learn"])
limiter = Limiter(key_func=get_remote_address)

CATEGORY_LABELS = {
    "crimes_against_body":        {"label": "Crimes Against Body",    "color": "#ef4444", "icon": "🩺"},
    "crimes_against_women":       {"label": "Women's Protection",     "color": "#ec4899", "icon": "👩"},
    "crimes_against_property":    {"label": "Property Crimes",        "color": "#f59e0b", "icon": "🏠"},
    "crimes_against_children":    {"label": "Child Protection",       "color": "#8b5cf6", "icon": "🧒"},
    "cyber_crimes":               {"label": "Cyber Crime",            "color": "#06b6d4", "icon": "💻"},
    "public_order":               {"label": "Public Order",           "color": "#6366f1", "icon": "🏛️"},
    "offences_against_reputation":{"label": "Reputation & Speech",   "color": "#84cc16", "icon": "🗣️"},
    "rights_during_arrest":       {"label": "Arrest Rights",          "color": "#22c55e", "icon": "⚖️"},
    "general_provisions":         {"label": "General Provisions",     "color": "#94a3b8", "icon": "📜"},
}


# ── All topics ────────────────────────────────────────────────────────────────
@router.get("/learn/topics")
@limiter.limit("30/minute")
def get_learn_topics(request: Request, category: Optional[str] = None):
    """Return enriched IPC laws as topic cards grouped by category."""
    try:
        all_laws = get_all_laws()
    except Exception as e:
        print(f"[WARN] MongoDB get_all_laws failed: {e}")
        return {"total": 0, "topics": []}
    
    results = []
    for law in all_laws:
        is_enriched = bool(law.get("ipc_section"))
        is_bns = law.get("law_code") == "BNS"
        is_ipc = law.get("law_code") == "IPC" or not law.get("law_code") # fallback
        
        cat = law.get("category", "general_provisions")
        if category and cat != category:
            continue
        cat_info = CATEGORY_LABELS.get(cat, {"label": cat, "color": "#94a3b8", "icon": "📜"})
        
        results.append({
            "id":               str(law["_id"]),
            "ipc_section":      law.get("ipc_section", "") if is_enriched else law.get("section", ""),
            "bns_section":      law.get("bns_section", "") if is_enriched else (law.get("section", "") if is_bns else ""),
            "display_code":     "BNS" if is_bns else "IPC",
            "display_section":  law.get("section", "") if not is_enriched else law.get("ipc_section", ""),
            "title":            law.get("title", law.get("title", "Law Topic")),
            "category":         cat,
            "category_label":   cat_info["label"],
            "category_color":   cat_info["color"],
            "category_icon":    cat_info["icon"],
            "punishment":       law.get("punishment", "Varies"),
            "simple_explanation": law.get("simple_explanation", "") if is_enriched else (law.get("content", "")[:100] + "..."),
            "bailable":         law.get("bailable", False),
            "cognizable":       law.get("cognizable", False),
            "keywords":         law.get("keywords") or [law.get("law_code", "LAW")],
        })
    return {"total": len(results), "topics": results}


# ── Topic scenario ────────────────────────────────────────────────────────────
@router.get("/learn/topic/{ipc_section}")
@limiter.limit("30/minute")
def get_learn_scenario(request: Request, ipc_section: str):
    """Generate/return 4-step scenario for a given IPC section."""
    try:
        law = bns_collection.find_one({"ipc_section": ipc_section})
        if not law:
            law = bns_collection.find_one({"bns_section": ipc_section})
        if not law:
            raise HTTPException(status_code=404, detail=f"Section {ipc_section} not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[WARN] MongoDB learn/topic failed: {e}")
        raise HTTPException(status_code=404, detail=f"Section {ipc_section} not found")

    steps = generate_scenario(law)
    return {
        "ipc_section": law.get("ipc_section"),
        "bns_section": law.get("bns_section"),
        "title":       law.get("title"),
        "category":    law.get("category"),
        "punishment":  law.get("punishment"),
        "steps":       steps,
    }


# ── AI follow-up Q&A ──────────────────────────────────────────────────────────
class AskSectionModel(BaseModel):
    ipc_section: str
    question:    str
    language:    Optional[str] = "English"


@router.post("/learn/ask-ai")
@limiter.limit("15/minute")  # Rate limit Gemini API usage
def learn_ask_ai(request: Request, body: AskSectionModel):
    """AI follow-up question for a specific IPC section."""
    # H6: sanitize question input
    question = sanitize_input(body.question, max_len=1000)
    if not question:
        return {"answer": "Please provide a valid question."}

    try:
        law = bns_collection.find_one({"ipc_section": body.ipc_section})
        if not law:
            law = bns_collection.find_one({"bns_section": body.ipc_section})
    except Exception as e:
        print(f"[WARN] MongoDB learn/ask-ai failed: {e}")
        law = None

    if law:
        context = (
            f"Law: {law.get('title')}\n"
            f"IPC {law.get('ipc_section')} / BNS {law.get('bns_section')}\n"
            f"Description: {law.get('description')}\n"
            f"Punishment: {law.get('punishment')}\n"
            f"Simple Explanation: {law.get('simple_explanation')}\n"
            f"Real Life Example: {law.get('real_life_example', '')}"
        )
    else:
        context = rag_context_from_db(question) or ""

    if not context:
        return {"answer": "I couldn't find relevant legal information for this question."}

    answer = generate_ai_response(question, context, body.language)
    return {"answer": answer, "ipc_section": body.ipc_section}
