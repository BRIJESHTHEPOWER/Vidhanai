"""
Explore router — /explore/law/{ipc_section}
"""
from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import bns_collection

router = APIRouter(tags=["Explore"])
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


@router.get("/explore/law/{ipc_section}")
@limiter.limit("30/minute")
def get_explore_law(request: Request, ipc_section: str):
    """Return complete law data for Explore Mode."""
    try:
        law = bns_collection.find_one({"ipc_section": ipc_section})
        if not law:
            law = bns_collection.find_one({"bns_section": ipc_section})
        if not law:
            raise HTTPException(status_code=404, detail=f"Section {ipc_section} not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[WARN] MongoDB explore/law failed: {e}")
        raise HTTPException(status_code=404, detail=f"Section {ipc_section} not found")

    cat      = law.get("category", "general_provisions")
    cat_info = CATEGORY_LABELS.get(cat, {"label": cat, "color": "#94a3b8", "icon": "📜"})

    return {
        "id":               str(law["_id"]),
        "ipc_section":      law.get("ipc_section"),
        "bns_section":      law.get("bns_section"),
        "title":            law.get("title"),
        "category":         cat,
        "category_label":   cat_info["label"],
        "category_color":   cat_info["color"],
        "category_icon":    cat_info["icon"],
        "description":      law.get("description"),
        "bns_description":  law.get("bns_description"),
        "punishment":       law.get("punishment"),
        "bns_punishment":   law.get("bns_punishment"),
        "simple_explanation": law.get("simple_explanation"),
        "real_life_example":  law.get("real_life_example"),
        "keywords":         law.get("keywords", []),
        "related_laws":     law.get("related_laws", []),
        "differences":      law.get("differences"),
        "bailable":         law.get("bailable"),
        "cognizable":       law.get("cognizable"),
    }
