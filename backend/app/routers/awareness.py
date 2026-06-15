"""
Awareness router — /awareness
Know-Your-Rights categories and laws.
L4: Quick tips loaded from data/tips.json (not hardcoded in Python).
"""
import json
import os
from typing import Optional

from fastapi import APIRouter, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.connection import bns_collection
from app.routers import serialize_law

router = APIRouter(tags=["Awareness"])
limiter = Limiter(key_func=get_remote_address)

# ── L4: Load tips from external JSON file ─────────────────────────────────────
def _load_tips() -> dict:
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    path = os.path.join(base, "data", "tips.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[WARN] Could not load tips.json: {e}")
        return {}

QUICK_TIPS = _load_tips()

AWARENESS_CATEGORIES = {
    "women_safety": {
        "title":       "Women Safety Laws",
        "icon":        "👩‍⚖️",
        "color":       "#e91e8c",
        "description": "Laws that protect women from violence, harassment, and discrimination in India.",
        "categories":  ["crimes_against_women"],
    },
    "cyber_crime": {
        "title":       "Cyber Crime Laws",
        "icon":        "🔐",
        "color":       "#1976d2",
        "description": "Laws covering online fraud, hacking, identity theft, and digital harassment.",
        "categories":  ["cyber_crimes"],
    },
    "arrest_rights": {
        "title":       "Rights During Arrest",
        "icon":        "⚖️",
        "color":       "#388e3c",
        "description": "Your fundamental legal rights when arrested or in police custody.",
        "categories":  ["rights_during_arrest"],
    },
    "property_crimes": {
        "title":       "Property & Financial Crimes",
        "icon":        "🏛️",
        "color":       "#f57c00",
        "description": "Laws covering theft, fraud, extortion and financial crimes.",
        "categories":  ["crimes_against_property"],
    },
    "crimes_against_children": {
        "title":       "Child Protection Laws",
        "icon":        "🧒",
        "color":       "#7b1fa2",
        "description": "Laws protecting children from abuse, trafficking and sexual exploitation.",
        "categories":  ["crimes_against_children"],
    },
}


@router.get("/awareness")
@limiter.limit("30/minute")
def get_awareness(request: Request, category: Optional[str] = None):
    """
    Return Know Your Rights awareness data.
    If category specified: return laws for that category.
    Otherwise: return all category overviews.
    """
    try:
        if category and category in AWARENESS_CATEGORIES:
            cat_info      = AWARENESS_CATEGORIES[category]
            db_categories = cat_info["categories"]
            laws = []
            for db_cat in db_categories:
                cursor = bns_collection.find({"category": db_cat}).limit(10)
                for doc in cursor:
                    laws.append(serialize_law(doc, full=True))

            return {
                "category":    category,
                "title":       cat_info["title"],
                "icon":        cat_info["icon"],
                "color":       cat_info["color"],
                "description": cat_info["description"],
                "tips":        QUICK_TIPS.get(category, []),
                "laws":        laws,
            }

        # Return all category overviews with law counts
        categories_data = []
        for key, info in AWARENESS_CATEGORIES.items():
            count = 0
            for db_cat in info["categories"]:
                count += bns_collection.count_documents({"category": db_cat})
            categories_data.append({
                "key":         key,
                "title":       info["title"],
                "icon":        info["icon"],
                "color":       info["color"],
                "description": info["description"],
                "law_count":   count,
                "tips_count":  len(QUICK_TIPS.get(key, [])),
            })

        return {"categories": categories_data}
    except Exception as e:
        print(f"[WARN] Awareness endpoint failed: {e}")
        return {"categories": []}
