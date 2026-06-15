import os
import json
import random
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
from slowapi import Limiter
from slowapi.util import get_remote_address
from dotenv import load_dotenv

from app.db.connection import bns_collection, detective_cases_collection, users_collection
from app.routers import get_current_user_email_optional, sanitize_input
from app.services.ai import generate_json_response


load_dotenv()
router = APIRouter(prefix="/detective", tags=["Detective Game"])
limiter = Limiter(key_func=get_remote_address)

# ── Models ────────────────────────────────────────────────────────────────────
class GenerateCaseRequest(BaseModel):
    difficulty: Optional[str] = "medium"

class SolveCaseRequest(BaseModel):
    case_id: str
    selected_section: str
    user_id: Optional[str] = "guest"

class Suspect(BaseModel):
    name: str
    role: str
    statement: str
    confession: str
    is_guilty: bool

class Clue(BaseModel):
    title: str
    description: str
    type: str
    location: str

class CaseResponse(BaseModel):
    case_id: str
    title: str
    incident_report: str
    clues: List[Clue]
    suspects: List[Suspect]
    options: List[str] # List of 4 sections (e.g., "BNS 303: Theft")

# ── Helper ────────────────────────────────────────────────────────────────────
def get_random_law():
    """Pick a random law from the dataset that has good details."""
    pipeline = [
        {"$match": {
            "$or": [
                {"bns_section": {"$exists": True, "$ne": "", "$ne": "N/A"}},
                {"section": {"$exists": True, "$ne": "", "$ne": "N/A"}}
            ],
            "title": {"$exists": True, "$ne": ""}
        }},
        {"$sample": {"size": 1}}
    ]
    random_laws = list(bns_collection.aggregate(pipeline))
    if not random_laws:
        raise HTTPException(status_code=500, detail="No laws found in dataset")
    
    law = random_laws[0]
    if "bns_section" not in law:
        law["bns_section"] = law.get("section", "N/A")
        law["ipc_section"] = "N/A"
        law["description"] = law.get("content", "")[:500]
        law["simple_explanation"] = law.get("content", "")[:300]
    return law

def get_other_random_sections(exclude_bns: str, count: int = 3):
    """Get some random sections to serve as wrong multiple-choice options."""
    pipeline = [
        {"$match": {
            "$or": [
                {"bns_section": {"$exists": True, "$ne": exclude_bns, "$ne": "", "$ne": "N/A"}},
                {"section": {"$exists": True, "$ne": exclude_bns, "$ne": "", "$ne": "N/A"}}
            ]
        }},
        {"$sample": {"size": count}}
    ]
    laws = list(bns_collection.aggregate(pipeline))
    options = []
    for l in laws:
        title = l.get("title", "Unknown Offense")
        bns = l.get("bns_section", l.get("section", "N/A"))
        ipc = l.get("ipc_section", "N/A")
        options.append(f"BNS {bns} (Old IPC {ipc}) - {title}")
    return options

# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=CaseResponse)
@limiter.limit("20/minute")
def generate_case(request: Request, req: GenerateCaseRequest):
    """Generates a dynamic detective case, utilizing cache for speed and reliability."""
    
    # 1. Try to serve a cached case to make it blazing fast (80% of the time if we have enough cases)
    try:
        count = detective_cases_collection.count_documents({})
    except Exception as e:
        print(f"[WARN] detective_cases_collection count failed: {e}")
        count = 0
        
    if count >= 3 and random.random() < 0.8:
        try:
            pipeline = [{"$sample": {"size": 1}}]
            cached = list(detective_cases_collection.aggregate(pipeline))[0]
            # Shuffle options so it's not identical every time
            options = cached["options"]
            random.shuffle(options)
            return {
                "case_id": cached["case_id"],
                "title": cached["title"],
                "incident_report": cached["incident_report"],
                "clues": cached["clues"],
                "suspects": cached["suspects"],
                "options": options
            }
        except Exception as e:
            print(f"[WARN] Cached case fetch failed: {e}")

    # 2. Otherwise, generate a new one dynamically
    try:
        law = get_random_law()
    except Exception as e:
        print(f"[WARN] get_random_law failed: {e}")
        # Try cache as fallback
        if count > 0:
            try:
                pipeline = [{"$sample": {"size": 1}}]
                cached = list(detective_cases_collection.aggregate(pipeline))[0]
                options = cached["options"]
                random.shuffle(options)
                return {
                    "case_id": cached["case_id"],
                    "title": cached["title"],
                    "incident_report": cached["incident_report"],
                    "clues": cached["clues"],
                    "suspects": cached["suspects"],
                    "options": options
                }
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="Failed to generate case and no cache available.")
    
    bns_section = law.get("bns_section", "N/A")
    title = law.get("title", "Unknown")
    description = law.get("description", "")
    keywords = law.get("keywords", [])
    example = law.get("real_life_example", "")
    
    prompt = f"""You are a Game Master for a cyber detective game. 
Generate a crime case matching this law: BNS Section {bns_section} - {title}.
Keywords: {', '.join(keywords)}. Description: {description}. Example: {example}.
Provide 3 clues (with location to find them) and 3 suspects (only 1 guilty).
Subtly weave the exact keywords into the clues and confessions so the user learns the law definitions.
Respond ONLY in valid JSON matching this schema:
{{
  "title": "Case Name",
  "incident_report": "3-sentence police report.",
  "clues": [ {{"title": "Clue 1", "description": "Desc with keyword", "type": "Physical / Digital / Witness", "location": "Where to find it (e.g., Victim's Phone, Crime Scene Floor)"}} ],
  "suspects": [ {{"name": "Name", "role": "Role", "statement": "Alibi", "confession": "If guilty, how they did it. If innocent, a relieved statement.", "is_guilty": true}} ]
}}"""

    try:
        raw = generate_json_response(
            "You are a Game Master for a cyber detective game. Respond ONLY in valid JSON.",
            prompt,
            temperature=0.7,
            max_tokens=1000,
        )
        case_data = json.loads(raw.strip())
        
        ipc_section = law.get("ipc_section", "N/A")
        correct_option = f"BNS {bns_section} (Old IPC {ipc_section}) - {title}"
        wrong_options = get_other_random_sections(exclude_bns=bns_section, count=3)
        all_options = [correct_option] + wrong_options
        random.shuffle(all_options)
        
        case_id = str(uuid.uuid4())
        
        case_record = {
            "case_id": case_id,
            "law_id": str(law.get("_id", "")),
            "bns_section": bns_section,
            "correct_option": correct_option,
            "title": case_data["title"],
            "incident_report": case_data["incident_report"],
            "clues": case_data["clues"],
            "suspects": case_data["suspects"],
            "options": all_options,
            "law_explanation": law.get("simple_explanation", ""),
            "punishment": law.get("bns_punishment", "") or law.get("punishment", ""),
        }
        detective_cases_collection.insert_one(case_record)
        
        return {
            "case_id": case_id,
            "title": case_data["title"],
            "incident_report": case_data["incident_report"],
            "clues": case_data["clues"],
            "suspects": case_data["suspects"],
            "options": all_options
        }
        
    except Exception as e:
        print(f"Game Generation Error: {e}")
        # 3. Fallback to cache if Gemini generation fails
        if count > 0:
            try:
                pipeline = [{"$sample": {"size": 1}}]
                cached = list(detective_cases_collection.aggregate(pipeline))[0]
                options = cached["options"]
                random.shuffle(options)
                return {
                    "case_id": cached["case_id"],
                    "title": cached["title"],
                    "incident_report": cached["incident_report"],
                    "clues": cached["clues"],
                    "suspects": cached["suspects"],
                    "options": options
                }
            except Exception:
                pass
        raise HTTPException(status_code=500, detail="Failed to generate case and no cache available.")


@router.post("/solve")
@limiter.limit("30/minute")
def solve_case(
    request: Request,
    req: SolveCaseRequest,
    user_email: Optional[str] = Depends(get_current_user_email_optional)
):
    """Verifies the user's answer and awards XP."""
    try:
        case = detective_cases_collection.find_one({"case_id": req.case_id}, {"_id": 0})
    except Exception as e:
        print(f"[WARN] detective_cases_collection find_one failed: {e}")
        raise HTTPException(status_code=404, detail="Case not found")
        
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    is_correct = req.selected_section == case["correct_option"]
    xp_earned = 100 if is_correct else 10
    
    # Update user XP in DB
    target_email = user_email
    target_name = None
    if not target_email and req.user_id and req.user_id != "guest":
        if "@" in req.user_id:
            target_email = req.user_id
        else:
            target_name = req.user_id

    if target_email:
        try:
            user_doc = users_collection.find_one({"email": target_email})
            if user_doc:
                users_collection.update_one(
                    {"email": target_email},
                    {"$inc": {"xp": xp_earned, "cases_solved": 1 if is_correct else 0}}
                )
            else:
                users_collection.update_one(
                    {"email": target_email},
                    {
                        "$inc": {"xp": xp_earned, "cases_solved": 1 if is_correct else 0},
                        "$setOnInsert": {
                            "name": target_email.split("@")[0],
                            "created_at": datetime.utcnow()
                        }
                    },
                    upsert=True
                )
        except Exception as e:
            print(f"[WARN] User XP update failed: {e}")
    elif target_name and target_name != "guest":
        try:
            user_doc = users_collection.find_one({"name": target_name})
            if user_doc:
                users_collection.update_one(
                    {"name": target_name},
                    {"$inc": {"xp": xp_earned, "cases_solved": 1 if is_correct else 0}}
                )
            else:
                users_collection.update_one(
                    {"name": target_name},
                    {
                        "$inc": {"xp": xp_earned, "cases_solved": 1 if is_correct else 0},
                        "$setOnInsert": {
                            "created_at": datetime.utcnow()
                        }
                    },
                    upsert=True
                )
        except Exception as e:
            print(f"[WARN] User XP update failed: {e}")
    
    from bson.objectid import ObjectId
    full_law = {}
    try:
        full_law = bns_collection.find_one({"_id": ObjectId(case["law_id"])})
    except Exception:
        full_law = {}

    return {
        "is_correct": is_correct,
        "correct_option": case["correct_option"],
        "xp_earned": xp_earned,
        "law_explanation": case["law_explanation"],
        "punishment": case["punishment"],
        "ipc_section": full_law.get("ipc_section", "N/A"),
        "bns_section": full_law.get("bns_section", "N/A"),
        "differences": full_law.get("differences", "No major changes."),
        "bailable": full_law.get("bailable", "Unknown"),
        "cognizable": full_law.get("cognizable", "Unknown"),
        "message": "Case Solved! Excellent work, Detective." if is_correct else "Incorrect! The criminal got away."
    }

@router.get("/leaderboard")
@limiter.limit("30/minute")
def get_leaderboard(request: Request):
    """Returns top 10 detectives by XP."""
    try:
        raw_users = list(users_collection.find({"xp": {"$exists": True}}, {"_id": 0, "user_id": 1, "name": 1, "xp": 1}).sort("xp", -1).limit(10))
    except Exception as e:
        print(f"[WARN] leaderboard fetch failed: {e}")
        raw_users = []
        
    top_users = []
    for u in raw_users:
        display_name = u.get("user_id") or u.get("name") or "Anonymous Detective"
        top_users.append({
            "user_id": display_name,
            "xp": u.get("xp", 0)
        })
    if not top_users:
        return [
            {"user_id": "CyberCop_01", "xp": 1500},
            {"user_id": "LawNinja", "xp": 1200},
            {"user_id": "JusticeSeeker", "xp": 900},
        ]
    return top_users

