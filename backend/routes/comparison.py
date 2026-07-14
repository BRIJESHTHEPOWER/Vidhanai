"""
IPC vs BNS Comparison API
GET /api/compare?topic=murder&ipc_section=302&bns_section=103
"""

import re
import os
from fastapi import APIRouter, Query
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
_client   = AsyncIOMotorClient(MONGO_URL)
_db       = _client["ai_legal_system"]
ipc_col   = _db["ipc_sections"]
bns_col   = _db["bns_sections"]


# ── helpers ───────────────────────────────────────────────────────────────────

def _to_str_id(doc: dict | None) -> dict | None:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def _pun_label(doc: dict, text_key: str) -> str:
    return str(doc.get("punishment") or "").strip() or "No punishment / General provision"


def detect_changes(ipc: dict, bns: dict) -> list:
    changes = []

    # 1. Section number changed
    ipc_num = str(ipc.get("section_number", "")).strip()
    bns_num = str(bns.get("section_number", "")).strip()
    if ipc_num != bns_num:
        changes.append({
            "type":   "section_number",
            "label":  "Section number changed",
            "ipc":    f"Section {ipc_num}" if ipc_num else "—",
            "bns":    f"Section {bns_num}" if bns_num else "—",
            "impact": "neutral",
        })

    # 2. Punishment changed
    ipc_pun = _pun_label(ipc, "section_text")
    bns_pun = _pun_label(bns, "description")
    if ipc_pun != bns_pun:
        changes.append({
            "type":   "punishment",
            "label":  "Punishment",
            "ipc":    ipc_pun,
            "bns":    bns_pun,
            "impact": "high",
        })

    # 3. is_punishable field (BNS-specific)
    is_pun = bns.get("is_punishable")
    if is_pun is not None:
        changes.append({
            "type":   "is_punishable",
            "label":  "Punishable offence",
            "ipc":    "Not explicitly stated in IPC",
            "bns":    "Yes" if is_pun else "No",
            "impact": "medium",
        })

    # 4. Exceptions added in BNS
    exceptions = bns.get("exceptions") or []
    if exceptions:
        changes.append({
            "type":   "exceptions",
            "label":  "Exceptions in BNS",
            "ipc":    "None",
            "bns":    f"{len(exceptions)} exception{'s' if len(exceptions) != 1 else ''} added",
            "impact": "new",
        })

    # 5. Illustrations added in BNS
    illustrations = bns.get("illustrations") or []
    if illustrations:
        changes.append({
            "type":   "illustrations",
            "label":  "Illustrations added in BNS",
            "ipc":    "None",
            "bns":    f"{len(illustrations)} illustration{'s' if len(illustrations) != 1 else ''} added",
            "impact": "new",
        })

    # 6. Important definitions added in BNS
    defs = bns.get("important_definitions") or []
    if defs:
        changes.append({
            "type":   "important_definitions",
            "label":  "New definitions in BNS",
            "ipc":    "None",
            "bns":    f"{len(defs)} definition{'s' if len(defs) != 1 else ''} added",
            "impact": "new",
        })

    return changes


# ── endpoint ──────────────────────────────────────────────────────────────────

@router.get("/api/compare")
async def compare(
    topic:       str | None = Query(default=None),
    ipc_section: str | None = Query(default=None),
    bns_section: str | None = Query(default=None),
):
    ipc_doc = None
    bns_doc = None

    # ── IPC lookup ────────────────────────────────────────────────────────────
    if ipc_section and ipc_section.strip():
        ipc_doc = await ipc_col.find_one({"section_number": ipc_section.strip()})

    if ipc_doc is None and topic and topic.strip():
        pattern = {"$regex": re.escape(topic.strip()), "$options": "i"}
        ipc_doc = await ipc_col.find_one({
            "$or": [
                {"title":        pattern},
                {"section_text": pattern},
                {"keywords":     pattern},
            ]
        })

    # ── BNS lookup ────────────────────────────────────────────────────────────
    if bns_section and bns_section.strip():
        bns_doc = await bns_col.find_one({"section_number": bns_section.strip()})

    if bns_doc is None and topic and topic.strip():
        pattern = {"$regex": re.escape(topic.strip()), "$options": "i"}
        bns_doc = await bns_col.find_one({
            "$or": [
                {"title":       pattern},
                {"description": pattern},
                {"keywords":    pattern},
            ]
        })

    # ── Nothing found ─────────────────────────────────────────────────────────
    if not ipc_doc and not bns_doc:
        return {
            "error": "No matching section found. Try a different topic or section number."
        }

    ipc_doc = _to_str_id(ipc_doc)
    bns_doc = _to_str_id(bns_doc)

    changes = detect_changes(ipc_doc or {}, bns_doc or {}) if (ipc_doc and bns_doc) else []

    return {
        "ipc":     ipc_doc,
        "bns":     bns_doc,
        "changes": changes,
    }
