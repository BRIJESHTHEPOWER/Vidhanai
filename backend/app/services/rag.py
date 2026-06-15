import os
import re
import json
from vector.search import search as vector_search
from app.db.connection import (
    bns_collection, ipc_collection,
    normalize_law_doc, normalize_ipc_doc,
)


def find_relevant_law(question: str) -> str:
    """
    Enhanced RAG search (IPC + BNS):
    1. Try semantic search (FAISS) — top 3 results (covers both IPC & BNS)
    2. Fallback to MongoDB text search on both collections — top 3 results
    3. Fallback to keyword scoring across all DB laws (both collections)
    4. Returns consolidated multi-law context string for better answers
    """
    try:
        # --- 1. Semantic Search (FAISS, top-3, covers both IPC + BNS) ---
        v_results = vector_search(question, k=3)
        if v_results:
            return _format_multi_context(v_results)

        # --- 2. MongoDB Full-Text Search Fallback (both collections, top-3) ---
        docs = []

        # Search BNS collection
        try:
            bns_cursor = bns_collection.find(
                {"$text": {"$search": question}},
                {"score": {"$meta": "textScore"}}
            ).sort([("score", {"$meta": "textScore"})]).limit(3)
            docs.extend([(d.get("score", 0) if "score" in d else 0, normalize_law_doc(d)) for d in bns_cursor])
        except Exception:
            pass  # Text index might not exist

        # Search IPC collection
        try:
            ipc_cursor = ipc_collection.find(
                {"$text": {"$search": question}},
                {"score": {"$meta": "textScore"}}
            ).sort([("score", {"$meta": "textScore"})]).limit(3)
            docs.extend([(d.get("score", 0) if "score" in d else 0, normalize_ipc_doc(d)) for d in ipc_cursor])
        except Exception:
            pass  # Text index might not exist

        if docs:
            # Sort by text score descending, take top 3
            docs.sort(key=lambda x: x[0], reverse=True)
            top_docs = [doc for _, doc in docs[:3]]
            return _format_multi_context(top_docs)

    except Exception as e:
        print(f"RAG Error (FAISS/text search): {e}")

    # --- 3. Keyword-Scoring Fallback (both collections) ---
    try:
        from app.routers import get_all_laws
        words = [w.lower() for w in re.split(r"\W+", question) if len(w) > 2]
        scored = []

        # Score all laws using the in-memory cache
        for law in get_all_laws():
            score = _score_law(law, words, question)
            if score > 0:
                scored.append((score, law))

        scored.sort(key=lambda x: x[0], reverse=True)
        top_laws = [law for _, law in scored[:3]]
        if top_laws:
            return _format_multi_context(top_laws)

    except Exception as e:
        print(f"RAG Error (keyword fallback): {e}")

    return None


def _score_law(law: dict, words: list, question: str) -> int:
    """Score a law document against query words and keywords."""
    score = 0
    combined = " ".join([
        law.get("title", ""),
        law.get("description", ""),
        law.get("simple_explanation", ""),
        law.get("section_text", ""),
        law.get("meaning", ""),
        " ".join(law.get("keywords", [])),
        str(law.get("bns_section", "")),
        str(law.get("ipc_section", "")),
    ]).lower()
    for w in words:
        if w in combined:
            score += 1
    for kw in law.get("keywords", []):
        if kw.lower() in question.lower():
            score += 3
    return score


def _format_multi_context(docs: list) -> str:
    """Format multiple MongoDB law documents into a rich context string."""
    parts = []
    for i, doc in enumerate(docs, 1):
        law_code = doc.get("law_code", "BNS" if doc.get("bns_section", "N/A") != "N/A" else "IPC")
        part = (
            f"[Law {i} — {law_code}]\n"
            f"Title: {doc.get('title', 'N/A')}\n"
            f"IPC Section: {doc.get('ipc_section', 'N/A')}\n"
            f"BNS Section: {doc.get('bns_section', 'N/A')}\n"
            f"Description: {doc.get('description', 'N/A')}\n"
            f"Simple Explanation: {doc.get('simple_explanation', 'N/A')}\n"
            f"Punishment (IPC): {doc.get('punishment', 'N/A')}\n"
            f"Punishment (BNS): {doc.get('bns_punishment', 'N/A')}\n"
            f"Key Differences: {doc.get('differences', 'N/A')}\n"
            f"Real Life Example: {doc.get('real_life_example', 'N/A')}\n"
        )
        parts.append(part)
    return "\n---\n".join(parts)


def _format_context(doc: dict) -> str:
    """Format a single MongoDB law document into a context string."""
    return _format_multi_context([doc])


def _format_comparison_section(doc: dict, law_code: str, section: str) -> str:
    """Format a single law document with full detail for comparison prompts."""
    lines = [
        f"{law_code} Section {section}",
        f"Title: {doc.get('title', 'N/A')}",
        f"Description: {doc.get('description') or doc.get('section_text') or doc.get('bns_description', 'N/A')}",
        f"Punishment: {doc.get('punishment') or doc.get('bns_punishment', 'N/A')}",
        f"Simple Explanation: {doc.get('simple_explanation') or doc.get('bns_ai_summary', 'N/A')}",
        f"Key Differences: {doc.get('differences', 'N/A')}",
        f"Exceptions: {doc.get('exceptions', 'N/A')}",
        f"Real Life Example: {doc.get('real_life_example', 'N/A')}",
    ]
    subs = doc.get("bns_subsections") or doc.get("subsections") or []
    if subs:
        lines.append("Subsections / Explanations:")
        for sub in subs[:5]:
            text = sub.get("text", sub) if isinstance(sub, dict) else str(sub)
            lines.append(f"  - {text}")
    return "\n".join(lines)


def get_comparison_context(bns: str, ipc: str = None, bns_doc: dict = None, ipc_doc: dict = None) -> str:
    """
    Build rich RAG + database context for IPC↔BNS comparison.
    Combines vector/keyword search with direct section documents.
    """
    parts = []

    title = (bns_doc or {}).get("title", "")
    query = f"IPC {ipc or ''} BNS {bns} {title}".strip()
    rag_context = find_relevant_law(query)
    if rag_context:
        parts.append("=== Related Legal Database Context (RAG) ===")
        parts.append(rag_context)

    if bns_doc:
        parts.append("=== New Law — BNS 2023 (Primary) ===")
        parts.append(_format_comparison_section(bns_doc, "BNS", bns))

    if ipc_doc:
        parts.append("=== Old Law — IPC 1860 (Historical) ===")
        ipc_sec = ipc or ipc_doc.get("section_number") or ipc_doc.get("ipc_section", "")
        parts.append(_format_comparison_section(ipc_doc, "IPC", str(ipc_sec)))
    elif bns_doc and bns_doc.get("differences"):
        parts.append("=== Known Differences (Database) ===")
        parts.append(str(bns_doc.get("differences")))

    return "\n\n".join(parts) if parts else ""