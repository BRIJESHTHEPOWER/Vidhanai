"""
Shared utilities for all routers:
  - Auth helper
  - Law serializer
  - RAG context builder
  - Cached laws accessor (H2: TTL-aware, multi-worker safe)
  - Input sanitizer (H6)
"""
import os
import re
import html
import time
from typing import Optional, List

import jwt
from fastapi import Header

from app.db.connection import bns_collection, ipc_collection, normalize_law_doc, normalize_ipc_doc

# ── H2: TTL-aware cache (safe for multi-worker uvicorn) ─────────────────────
# We avoid a module-level mutable global. Instead we use a simple tuple cache:
# (_data, _fetched_at). Each worker has its own copy which is fine for read-only
# law data. TTL=300s means a worker refreshes every 5 min, not per-request.
_LAW_CACHE: tuple = (None, 0.0)
_LAW_CACHE_TTL   = 300  # seconds


def get_all_laws() -> List[dict]:
    """Return all law documents from BNS + IPC (normalized). Refreshes from DB every 5 minutes per worker."""
    global _LAW_CACHE
    data, fetched_at = _LAW_CACHE
    if data is None or (time.monotonic() - fetched_at) > _LAW_CACHE_TTL:
        # Fetch from both BNS and IPC collections
        bns_raw = list(bns_collection.find({}))
        ipc_raw = list(ipc_collection.find({}))
        data = (
            [normalize_law_doc(d) for d in bns_raw] +
            [normalize_ipc_doc(d) for d in ipc_raw]
        )
        _LAW_CACHE = (data, time.monotonic())
    return data


def invalidate_laws_cache():
    """Force-expire the cache (e.g. after a DB write)."""
    global _LAW_CACHE
    _LAW_CACHE = (None, 0.0)


# ── H6: Input sanitization helper ────────────────────────────────────────────
_HTML_TAG_RE = re.compile(r"<[^>]+>")

def sanitize_input(text: str, max_len: int = 2000) -> str:
    """
    Strip HTML tags, collapse whitespace, enforce max length.
    Returns a safe, trimmed string ready for use in queries and LLM prompts.
    """
    if not text:
        return ""
    # Decode HTML entities first (e.g. &lt; → <), then strip all tags
    cleaned = html.unescape(text)
    cleaned = _HTML_TAG_RE.sub("", cleaned)
    # Collapse multiple whitespace to single space
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    # Enforce max length
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len]
    return cleaned


# ── Auth helper ───────────────────────────────────────────────────────────────
def get_current_user_email_optional(
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ")[1]
    try:
        secret = os.getenv("JWT_SECRET")
        if not secret:
            return None
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return payload.get("sub")
    except Exception:
        return None


# ── Law serializer ────────────────────────────────────────────────────────────
def serialize_law(doc: dict, full: bool = False) -> dict:
    """Serialize a MongoDB law document for API response."""
    is_enriched = bool(doc.get("ipc_section") and doc.get("ipc_section") != "N/A" and doc.get("bns_section") and doc.get("bns_section") != "N/A")
    
    # Raw BNS documents have "section_number" instead of "law_code"
    is_bns = doc.get("law_code") == "BNS" or "section_number" in doc
    is_ipc = doc.get("law_code") == "IPC"
    
    sec = doc.get("section_number") or doc.get("section")
    
    base = {
        "id":               str(doc["_id"]),
        "ipc_section":      doc.get("ipc_section") if is_enriched else (sec if is_ipc else "N/A"),
        "bns_section":      doc.get("bns_section") if is_enriched else (sec if is_bns else "N/A"),
        "bns_chapter":      doc.get("bns_chapter") if is_enriched else doc.get("chapter", "N/A"),
        "title":            doc.get("title") or doc.get("section_title", "Unknown Title"),
        "category":         doc.get("category", "General"),
        "punishment":       doc.get("punishment", "Varies / See Description"),
        "bns_punishment":   doc.get("bns_punishment"),
        "simple_explanation": doc.get("simple_explanation") if is_enriched else (doc.get("description", doc.get("content", ""))[:300] + "..."),
        "keywords":         doc.get("keywords") or [doc.get("law_code", "BNS")],
        "bailable":         doc.get("bailable"),
        "cognizable":       doc.get("cognizable"),
    }
    if full:
        base.update({
            "description":       doc.get("description") if is_enriched else doc.get("description", doc.get("content", "")),
            "bns_description":   doc.get("bns_description"),
            "real_life_example": doc.get("real_life_example"),
            "related_laws":      doc.get("related_laws", []),
            "differences":       doc.get("differences"),
        })
    return base


# ── RAG context builder ───────────────────────────────────────────────────────
def rag_context_from_db(question: str) -> Optional[str]:
    """Keyword-score MongoDB laws to build RAG context string (top-3 results)."""
    try:
        words = [w.lower() for w in re.split(r"\W+", question) if len(w) > 2]
        scored = []

        for law in get_all_laws():
            combined = " ".join([
                law.get("title", ""),
                law.get("description", ""),
                " ".join(law.get("keywords", [])),
                law.get("simple_explanation", ""),
                str(law.get("ipc_section", "")),
                str(law.get("bns_section", "")),
            ]).lower()
            score = sum(1 for w in words if w in combined)
            for kw in law.get("keywords", []):
                if kw.lower() in question.lower():
                    score += 3
            if score > 0:
                scored.append((score, law))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_laws = [law for _, law in scored[:3]]

        if top_laws:
            parts = []
            for i, law in enumerate(top_laws, 1):
                ipc_sec = law.get('ipc_section')
                bns_sec = law.get('bns_section')
                bns_desc = law.get('bns_description') or law.get('description') or ''
                ipc_desc = law.get('description') or ''
                parts.append(
                    f"[Law {i}]\n"
                    f"Title: {law.get('title')}\n"
                    f"Current Law (BNS 2023): Section {bns_sec}\n"
                    f"Historical Law (IPC 1860): Section {ipc_sec}\n"
                    f"BNS Description: {bns_desc}\n"
                    f"IPC Description (historical): {ipc_desc}\n"
                    f"Punishment under BNS: {law.get('bns_punishment') or law.get('punishment')}\n"
                    f"Punishment under IPC: {law.get('punishment')}\n"
                    f"Key Differences (IPC → BNS): {law.get('differences', 'No major changes in text, section renumbered.')}\n"
                    f"Bailable: {law.get('bailable')}\n"
                    f"Simple Explanation: {law.get('simple_explanation')}"
                )
            return "\n---\n".join(parts)

    except Exception:
        pass
    return None

