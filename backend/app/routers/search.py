"""
Search router — /search-law, /get-section, /suggest, /law-of-day, /compare-laws
BNS 2023 is the primary reference throughout.
"""
import json
import os
import random
import re
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import bns_collection, ipc_collection
from app.routers import get_all_laws, serialize_law, sanitize_input
from app.services.ai import generate_groq_json_response
from app.services.rag import get_comparison_context, find_relevant_law

router = APIRouter(tags=["Search"])
limiter = Limiter(key_func=get_remote_address)


# ── Smart search: MongoDB text + keyword fallback ─────────────────────────────
@router.get("/search-law")
@limiter.limit("30/minute")
def search_law(request: Request, q: str = Query(..., min_length=1)):
    """Natural language search across IPC+BNS laws stored in MongoDB."""
    # H6: sanitize input — strip HTML, limit length
    q = sanitize_input(q, max_len=300)
    if not q:
        return []

    results = []

    # 1. MongoDB full-text search
    try:
        cursor = bns_collection.find(
            {"$text": {"$search": q}},
            {"score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(5)
        for doc in cursor:
            results.append(serialize_law(doc))
    except Exception as e:
        print(f"[WARN] MongoDB text search failed: {e}")

    # 2. Keyword scoring fallback (if text search returned < 2)
    if len(results) < 2:
        words = [w.lower() for w in re.split(r"\W+", q) if len(w) > 2]
        all_laws = get_all_laws()
        scored = []
        for law in all_laws:
            score = 0
            combined = " ".join([
                law.get("title", ""),
                law.get("description", ""),
                law.get("simple_explanation", ""),
                " ".join(law.get("keywords", []))
            ]).lower()
            for word in words:
                if word in combined:
                    score += 1
                if word in [k.lower() for k in law.get("keywords", [])]:
                    score += 2
            if score > 0:
                scored.append((score, law))

        scored.sort(key=lambda x: x[0], reverse=True)
        seen_ids = {r["id"] for r in results}
        for score, law in scored[:5]:
            s = serialize_law(law)
            if s["id"] not in seen_ids:
                results.append(s)
                seen_ids.add(s["id"])

    return results[:5]


# ── Section detail ────────────────────────────────────────────────────────────
@router.get("/get-section/{section_id}")
@limiter.limit("30/minute")
def get_section(request: Request, section_id: str):
    """Return full detail for a specific law by MongoDB _id or section number."""
    try:
        doc = bns_collection.find_one({"_id": ObjectId(section_id)})
        if not doc:
            doc = bns_collection.find_one({"ipc_section": section_id})
        if not doc:
            doc = bns_collection.find_one({"bns_section": section_id})
        if not doc:
            raise HTTPException(status_code=404, detail="Section not found")
        return serialize_law(doc, full=True)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[WARN] MongoDB get-section failed: {e}")
        raise HTTPException(status_code=404, detail="Section not found")


# ── IPC vs BNS comparison ─────────────────────────────────────────────────────
@router.get("/compare-laws")
@limiter.limit("30/minute")
def compare_laws(
    request: Request,
    ipc: Optional[str] = None,
    bns: Optional[str] = None,
    q:   Optional[str] = None,
):
    """
    Returns rich IPC↔BNS side-by-side comparison data.
    Sources: enriched bns_collection (primary) + raw bns_collection (supplement).
    BNS is primary reference; IPC shown as historical context.
    """
    results = []

    def _enrich_with_bns(law_dict: dict) -> dict:
        """Supplement enriched law with raw BNS section data if available."""
        bns_sec = law_dict.get("bns_section")
        if not bns_sec:
            return law_dict
        try:
            raw = bns_collection.find_one({"section_number": str(bns_sec)}, {"_id": 0})
            if raw:
                law_dict["bns_chapter"]     = raw.get("chapter", "")
                law_dict["bns_ai_summary"]  = raw.get("ai_summary", "")
                if not law_dict.get("bns_description"):
                    law_dict["bns_description"] = raw.get("description", "")
                # Subsections for deep comparison
                law_dict["bns_subsections"] = raw.get("subsections", [])[:3]
                law_dict["bns_illustrations"] = raw.get("illustrations", [])[:2]
        except Exception as e:
            print(f"[WARN] MongoDB enrich failed: {e}")
        return law_dict

    def _score_laws(q_text: str, limit: int = 6):
        words = [w.lower() for w in re.split(r"\W+", q_text) if len(w) > 1]
        scored = []
        for law in get_all_laws():
            score = 0
            combined = " ".join([
                str(law.get("ipc_section", "")),
                str(law.get("bns_section", "")),
                law.get("title", ""),
                law.get("description", law.get("content", "")),
                law.get("simple_explanation", ""),
                " ".join(law.get("keywords", []))
            ]).lower()
            for word in words:
                if word in combined:
                    score += 1
            # Boost keyword matches
            for kw in law.get("keywords", []):
                if kw.lower() in q_text.lower():
                    score += 3
            if score > 0:
                scored.append((score, law))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [law for _, law in scored[:limit]]

    try:
        if ipc:
            doc = bns_collection.find_one({"ipc_section": ipc.strip()})
            if doc:
                results.append(_enrich_with_bns(serialize_law(doc, full=True)))

        elif bns:
            doc = bns_collection.find_one({"bns_section": bns.strip()})
            if doc:
                results.append(_enrich_with_bns(serialize_law(doc, full=True)))
            else:
                # Try raw bns_collection
                raw = bns_collection.find_one({"section_number": bns.strip()}, {"_id": 0})
                if raw:
                    pun = raw.get("punishment")
                    pun_text = ""
                    if isinstance(pun, dict):
                        pun_text = pun.get("maximum_imprisonment", "") or ""
                    elif isinstance(pun, str):
                        pun_text = pun
                    results.append({
                        "id": f"bns_{bns}",
                        "ipc_section": None,
                        "bns_section": bns.strip(),
                        "bns_chapter": raw.get("chapter", ""),
                        "title": raw.get("title", ""),
                        "category": raw.get("chapter", "").split(" - ")[-1] if " - " in raw.get("chapter", "") else "BNS",
                        "punishment": None,
                        "bns_punishment": pun_text,
                        "description": raw.get("description", ""),
                        "bns_description": raw.get("description", ""),
                        "simple_explanation": raw.get("ai_summary", ""),
                        "bns_ai_summary": raw.get("ai_summary", ""),
                        "keywords": raw.get("keywords", []),
                        "differences": "This is a new BNS provision with no direct IPC equivalent.",
                        "bns_subsections": raw.get("subsections", [])[:3],
                        "bns_illustrations": raw.get("illustrations", [])[:2],
                        "bailable": None,
                        "cognizable": None,
                    })

        elif q:
            q_strip = sanitize_input(q.strip(), max_len=300)
            # 1. Exact match
            exact_doc = bns_collection.find_one({
                "$or": [
                    {"ipc_section": q_strip},
                    {"bns_section": q_strip},
                    {"section": q_strip}
                ]
            })
            seen_ids = set()
            if exact_doc:
                enriched = _enrich_with_bns(serialize_law(exact_doc, full=True))
                results.append(enriched)
                seen_ids.add(str(exact_doc.get("_id")))

            # 2. Keyword scoring
            for law in _score_laws(q_strip, limit=6):
                if str(law.get("_id")) in seen_ids:
                    continue
                enriched = _enrich_with_bns(serialize_law(law, full=True))
                results.append(enriched)
                seen_ids.add(str(law.get("_id")))

        else:
            # Default: show a diverse sample of enriched laws
            all_laws = get_all_laws()
            enriched_only = [l for l in all_laws if l.get("ipc_section") and l.get("ipc_section") != "N/A" and l.get("bns_section") and l.get("bns_section") != "N/A"]
            sample = random.sample(enriched_only, min(6, len(enriched_only))) if enriched_only else random.sample(all_laws, min(6, len(all_laws)))
            for law in sample:
                results.append(_enrich_with_bns(serialize_law(law, full=True)))

    except Exception as e:
        print(f"[WARN] MongoDB compare-laws failed: {e}")
        return {"error": "Search temporarily unavailable", "results": []}

    return results


# ── AI Comparison ─────────────────────────────────────────────────────────────
@router.get("/ai-compare")
@limiter.limit("15/minute")
def ai_compare(request: Request, bns: str, ipc: Optional[str] = None):
    """
    Generates a structured IPC↔BNS comparison using Groq ONLY.
    RAG + MongoDB provide the legal context; Groq produces the diff JSON.
    """
    try:
        bns_doc = (
            bns_collection.find_one({"bns_section": bns}) or
            bns_collection.find_one({"section_number": bns}) or
            bns_collection.find_one({"section_number": int(bns) if bns.isdigit() else bns})
        )
        if not bns_doc:
            raise HTTPException(status_code=404, detail=f"BNS section '{bns}' not found")

        ipc_doc = None
        ipc_val = ipc
        if ipc and ipc != "N/A" and ipc != "null" and ipc.strip():
            ipc_doc = (
                ipc_collection.find_one({"section_number": ipc}) or
                ipc_collection.find_one({"section_number": int(ipc) if ipc.isdigit() else ipc}) or
                bns_collection.find_one({"ipc_section": ipc})
            )
        elif bns_doc.get("ipc_section") and bns_doc["ipc_section"] not in ("N/A", "", None):
            ipc_val = bns_doc["ipc_section"]
            ipc_doc = (
                ipc_collection.find_one({"section_number": ipc_val}) or
                ipc_collection.find_one({"section_number": int(ipc_val) if str(ipc_val).isdigit() else ipc_val})
            )

        # RAG + full section documents feed Groq comparison
        context = get_comparison_context(bns, ipc_val, bns_doc, ipc_doc)
        if not context:
            bns_text = f"BNS {bns}: {bns_doc.get('title', '')}\nDescription: {bns_doc.get('description', '')}\nPunishment: {bns_doc.get('punishment', '')}"
            ipc_text = "No direct IPC equivalent"
            if ipc_doc:
                ipc_text = f"IPC {ipc_val}: {ipc_doc.get('title', '')}\nDescription: {ipc_doc.get('description') or ipc_doc.get('section_text', '')}\nPunishment: {ipc_doc.get('punishment', '')}"
            context = f"Old Law:\n{ipc_text}\n\nNew Law:\n{bns_text}"

        system_prompt = """You are an expert Indian Legal AI comparing IPC 1860 (Old Law) vs BNS 2023 (New Law).
Use ONLY the provided database/RAG context. Do not invent sections or punishments.

Output valid JSON ONLY matching this schema:
{
  "changes": [
    {
      "title": "Section Number" | "Language" | "Explanation" | "Structure" | "Exceptions" | "Intent & Knowledge" | "Punishment",
      "description": "Short description of what changed (1-2 sentences)",
      "tag": "Updated" | "Enhanced" | "Reorganized" | "Clarified" | "Stronger" | "Removed",
      "section_ref": "302 → 103 (optional, for Section Number changes only)"
    }
  ],
  "jd_insight": "A short 1-2 sentence insight summarizing the core difference for students.",
  "impact_percentage": 60
}

Rules:
- Always include at least: Section Number, Language, and one of Explanation/Exceptions/Punishment when data exists.
- impact_percentage: 0-100 estimate of how much the provision changed (100 = entirely new, 0 = identical).
- For renumbered sections, set section_ref like "302 → 103"."""

        user_prompt = f"""Compare these two laws using the database context below.

IPC Section: {ipc_val or 'N/A'}
BNS Section: {bns}

{context}

Provide the JSON comparison."""

        res = generate_groq_json_response(system_prompt, user_prompt)
        
        # Strip markdown json blocks if present
        res = res.strip()
        if res.startswith("```json"):
            res = res[7:]
        if res.startswith("```"):
            res = res[3:]
        if res.endswith("```"):
            res = res[:-3]
            
        return json.loads(res.strip())

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[WARN] AI compare failed: {e}")
        return {
            "changes": [{"title": "Analysis Failed", "description": "Could not generate AI comparison at this time.", "tag": "Error"}],
            "jd_insight": "AI comparison is temporarily unavailable.",
            "impact_percentage": 0
        }



# ── RAG + Groq bullet-point comparison ───────────────────────────────────────
@router.get("/compare-search")
@limiter.limit("15/minute")
def compare_search(request: Request, q: str = Query(..., min_length=1)):
    """
    Full RAG + Groq powered comparison.
    Flow: query → FAISS/MongoDB RAG → direct DB lookup → Groq → bullet-point JSON
    """
    q = sanitize_input(q, max_len=300)
    if not q:
        raise HTTPException(status_code=400, detail="Query required")

    try:
        # 1. RAG context (FAISS semantic + MongoDB text)
        rag_ctx = find_relevant_law(q) or ""

        # 2. Find best matching BNS section
        bns_doc = None
        try:
            bns_doc = bns_collection.find_one({"$text": {"$search": q}})
        except Exception:
            pass

        if not bns_doc:
            words = [w.lower() for w in re.split(r"\W+", q) if len(w) > 2]
            best = 0
            for law in get_all_laws():
                if not (law.get("bns_section") and law.get("bns_section") not in ("N/A", None)):
                    continue
                combined = " ".join([law.get("title", ""), " ".join(law.get("keywords", []))]).lower()
                score = sum(1 for w in words if w in combined)
                score += sum(3 for kw in law.get("keywords", []) if kw.lower() in q.lower())
                if score > best:
                    best = score
                    bns_doc = law

        # 3. Find matching IPC section
        ipc_doc = None
        if bns_doc:
            ipc_s = bns_doc.get("ipc_section")
            if ipc_s and str(ipc_s) not in ("N/A", "", "null", "None"):
                try:
                    ipc_doc = (
                        ipc_collection.find_one({"section_number": str(ipc_s)}) or
                        ipc_collection.find_one({"Section": str(ipc_s)})
                    )
                except Exception:
                    pass

        # 4. Build rich context for Groq
        ctx_parts = []
        if rag_ctx:
            ctx_parts.append(f"=== RAG Context ===\n{rag_ctx}")
        if bns_doc:
            ctx_parts.append(
                f"=== BNS 2023 (New Law) ===\n"
                f"Section: {bns_doc.get('bns_section', 'N/A')}\n"
                f"Title: {bns_doc.get('title', '')}\n"
                f"Description: {bns_doc.get('bns_description') or bns_doc.get('description', '')}\n"
                f"Punishment: {bns_doc.get('bns_punishment') or bns_doc.get('punishment', '')}\n"
                f"Differences: {bns_doc.get('differences', '')}"
            )
        if ipc_doc:
            ctx_parts.append(
                f"=== IPC 1860 (Old Law) ===\n"
                f"Section: {ipc_doc.get('section_number') or ipc_doc.get('Section', 'N/A')}\n"
                f"Title: {ipc_doc.get('section_title') or ipc_doc.get('title', '')}\n"
                f"Description: {ipc_doc.get('section_desc') or ipc_doc.get('description', '')}\n"
                f"Punishment: {ipc_doc.get('punishment', '')}"
            )

        full_context = "\n\n".join(ctx_parts) if ctx_parts else f"Topic: {q}"

        # 5. Groq structured comparison
        system_prompt = """You are an expert Indian Legal AI comparing IPC 1860 (Old Law) vs BNS 2023 (New Law).
Use ONLY the provided database/RAG context. Output valid JSON ONLY matching this exact schema:
{
  "ipc_section": "302",
  "ipc_title": "Punishment for Murder",
  "bns_section": "101",
  "bns_title": "Murder",
  "ipc_bullets": [
    {"label": "Punishment", "value": "exact punishment text from database"},
    {"label": "Language", "value": "Complex and hard to understand."},
    {"label": "Focus", "value": "Colonial-era law focused on punishment."},
    {"label": "Approach", "value": "More on offence and less on justice delivery."},
    {"label": "Victim Rights", "value": "Not specifically defined."},
    {"label": "Technology", "value": "Did not address modern crimes."},
    {"label": "Terminology", "value": "Based on British legal system."}
  ],
  "bns_bullets": [
    {"label": "Punishment", "value": "exact punishment text from database"},
    {"label": "Language", "value": "Simple, clear and easy to understand."},
    {"label": "Focus", "value": "Justice oriented with emphasis on victim rights."},
    {"label": "Approach", "value": "Faster justice, time-bound investigation."},
    {"label": "Victim Rights", "value": "Clearly recognized and protected."},
    {"label": "Technology", "value": "Includes cyber, digital & modern crimes."},
    {"label": "Terminology", "value": "Based on Indian legal values and culture."}
  ],
  "what_changed": [
    {"icon": "message", "title": "Simpler Language", "desc": "BNS is written in easy English for everyone."},
    {"icon": "people", "title": "Victim Centric", "desc": "More focus on victim rights and support."},
    {"icon": "clock", "title": "Faster Justice", "desc": "Time-bound investigation and trial process."},
    {"icon": "shield", "title": "Modern Crimes", "desc": "Includes cyber crimes, digital fraud & more."},
    {"icon": "scale", "title": "Indian Values", "desc": "Based on Indian culture, ethics and constitution."}
  ]
}
Rules:
- Extract exact section numbers and titles from the context
- ipc_bullets shows IPC 1860 limitations (OLD law) — 7 bullet points
- bns_bullets shows BNS 2023 improvements (NEW law) — 7 bullet points
- Both use same 7 labels: Punishment, Language, Focus, Approach, Victim Rights, Technology, Terminology
- what_changed: 5 key changes; icon must be one of: message, people, clock, shield, scale
- Use exact punishment text from context for the Punishment bullets"""

        user_prompt = f'Query: "{q}"\n\nDatabase Context:\n{full_context}\n\nReturn JSON only.'

        raw = generate_groq_json_response(system_prompt, user_prompt)
        raw = raw.strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

        return json.loads(raw.strip())

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[WARN] /compare-search failed: {e}")
        return {
            "ipc_section": "N/A",
            "ipc_title": q.title(),
            "bns_section": "N/A",
            "bns_title": q.title(),
            "ipc_bullets": [{"label": "Note", "value": "AI comparison temporarily unavailable. Please retry."}],
            "bns_bullets": [{"label": "Note", "value": "AI comparison temporarily unavailable. Please retry."}],
            "what_changed": []
        }


# ── Autocomplete suggestions ──────────────────────────────────────────────────
@router.get("/suggest")
@limiter.limit("30/minute")
def suggest(request: Request, query: str):
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    file_path = os.path.join(BASE_DIR, "data", "ipc.json")

    q = sanitize_input(query.lower().strip(), max_len=100)
    suggestions = []

    try:
        cursor = bns_collection.find(
            {"$or": [
                {"title": {"$regex": q, "$options": "i"}},
                {"keywords": {"$elemMatch": {"$regex": q, "$options": "i"}}}
            ]}
        ).limit(4)
        for doc in cursor:
            ipc   = doc.get("ipc_section", "")
            bns   = doc.get("bns_section", "")
            title = doc.get("title", "")
            suggestions.append(f"IPC {ipc}/BNS {bns} - {title}")
    except Exception as e:
        print(f"[WARN] MongoDB suggest failed: {e}")

    if len(suggestions) < 5 and os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            laws = json.load(f)
        for law in laws:
            if q in law.get("section_title", "").lower():
                suggestions.append(f"IPC {law['Section']} - {law['section_title']}")
            if len(suggestions) >= 7:
                break

    return list(dict.fromkeys(suggestions))[:6]


# ── Law of the day ────────────────────────────────────────────────────────────
@router.get("/law-of-day")
@limiter.limit("10/minute")
def law_of_day(request: Request):
    try:
        count = bns_collection.count_documents({})
        if count > 0:
            skip = random.randint(0, count - 1)
            doc  = bns_collection.find().skip(skip).limit(1)[0]
            return {
                "section":     f"IPC {doc.get('ipc_section','?')} / BNS {doc.get('bns_section','?')}",
                "title":       doc.get("title", ""),
                "description": doc.get("simple_explanation") or doc.get("description", ""),
                "ipc_section": doc.get("ipc_section"),
                "bns_section": doc.get("bns_section"),
                "category":    doc.get("category", ""),
            }
    except Exception as e:
        print(f"[WARN] MongoDB law-of-day failed: {e}")

    # Fallback to ipc.json
    BASE_DIR  = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    file_path = os.path.join(BASE_DIR, "data", "ipc.json")
    with open(file_path, "r", encoding="utf-8") as f:
        laws = json.load(f)
    law = random.choice(laws)
    return {
        "section":     law["Section"],
        "title":       law["section_title"],
        "description": law["section_desc"],
        "ipc_section": law["Section"],
        "bns_section": None,
        "category":    "",
    }
