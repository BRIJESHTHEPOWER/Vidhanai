"""
Admin router — Vidhan.ai
Handles admin authentication, dashboard stats, and CRUD for all collections.
All /admin/* endpoints (except /admin/login) require a valid admin JWT.
"""
from fastapi import APIRouter, HTTPException, Header, Depends, Query
from pydantic import BaseModel, Field
from datetime import datetime, timedelta, timezone

def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()
from typing import Optional, List
import os
import jwt
import bcrypt
from bson import ObjectId

from app.db.connection import (
    users_collection,
    reviews_collection,
    queries_collection,
    bns_collection,
    ipc_collection,
    admin_users_collection,
    settings_collection,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.post("/rebuild-faiss")
def rebuild_faiss():
    """Build FAISS index using the already-loaded model to avoid Windows lock issues."""
    try:
        from vector.search import _model, _lazy_init
        if _model is None:
            _lazy_init()
            
        import faiss, numpy as np, pickle, os
        from app.db.connection import bns_collection
        from vector.search import INDEX_PATH, MAP_PATH
        
        docs = list(bns_collection.find())
        texts, ids = [], []
        for doc in docs:
            parts = [doc.get("title",""), doc.get("description",""), doc.get("simple_explanation",""), " ".join(doc.get("keywords",[]))]
            texts.append(" ".join(p for p in parts if p))
            ids.append(str(doc["_id"]))
            
        embeddings = _model.encode(texts)
        index = faiss.IndexFlatL2(embeddings.shape[1])
        index.add(np.array(embeddings, dtype=np.float32))
        
        temp_i, temp_m = INDEX_PATH + ".tmp", MAP_PATH + ".tmp"
        faiss.write_index(index, temp_i)
        with open(temp_m, "wb") as f:
            pickle.dump(ids, f)
            
        if os.path.exists(INDEX_PATH): os.remove(INDEX_PATH)
        if os.path.exists(MAP_PATH): os.remove(MAP_PATH)
        os.rename(temp_i, INDEX_PATH)
        os.rename(temp_m, MAP_PATH)
        
        return {"status": "ok", "vectors": len(ids)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

SECRET_KEY = os.getenv("JWT_SECRET", "vidhan-super-secret-jwt-key-2024")
ALGORITHM  = "HS256"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def _verify(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def _make_token(email: str, role: str = "admin") -> str:
    payload = {
        "sub": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=1),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _require_admin(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing admin token")
    token = authorization.split("Bearer ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Seed default admin on startup ─────────────────────────────────────────────

def seed_default_admin():
    """Create a default admin account if none exists."""
    if admin_users_collection.count_documents({}) == 0:
        admin_users_collection.insert_one({
            "name": "Admin",
            "email": "admin@vidhan.ai",
            "password": _hash("admin@123"),
            "role": "admin",
            "created_at": _utcnow(),
        })
        print("[Admin] Default admin created: admin@vidhan.ai / admin@123")

try:
    seed_default_admin()
except Exception as e:
    print(f"[Admin] Could not seed admin: {e}")


# ── Models ────────────────────────────────────────────────────────────────────

class AdminLogin(BaseModel):
    email: str
    password: str

class AdminRegister(BaseModel):
    name: str
    email: str
    password: str = Field(..., min_length=6)

class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# ── Auth endpoints ─────────────────────────────────────────────────────────────

@router.post("/login")
def admin_login(body: AdminLogin):
    admin = admin_users_collection.find_one({"email": body.email})
    if not admin or not _verify(body.password, admin["password"]):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    token = _make_token(admin["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "name": admin["name"],
        "email": admin["email"],
        "role": admin.get("role", "admin"),
    }

@router.post("/register")
def admin_register(body: AdminRegister, admin=Depends(_require_admin)):
    """Create a new admin account. Only existing admins can do this."""
    if admin_users_collection.find_one({"email": body.email}):
        raise HTTPException(status_code=400, detail="Admin with this email already exists")
    admin_users_collection.insert_one({
        "name": body.name,
        "email": body.email,
        "password": _hash(body.password),
        "role": "admin",
        "created_at": _utcnow(),
    })
    return {"message": f"Admin account created for {body.email}"}

@router.get("/me")
def admin_me(admin=Depends(_require_admin)):
    doc = admin_users_collection.find_one({"email": admin["sub"]}, {"password": 0, "_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Admin not found")
    return doc

@router.post("/change-password")
def change_password(body: ChangePassword, admin=Depends(_require_admin)):
    doc = admin_users_collection.find_one({"email": admin["sub"]})
    if not doc or not _verify(body.current_password, doc["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    admin_users_collection.update_one(
        {"email": admin["sub"]},
        {"$set": {"password": _hash(body.new_password)}}
    )
    return {"message": "Password updated successfully"}


# ── Dashboard Stats ────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(admin=Depends(_require_admin)):
    try:
        total_users   = users_collection.count_documents({})
        total_reviews = reviews_collection.count_documents({})
        total_queries = queries_collection.count_documents({})
        bns_total     = bns_collection.count_documents({})
        ipc_total     = ipc_collection.count_documents({})

        # Reviews by rating
        rating_dist = {}
        for r in [1, 2, 3, 4, 5]:
            rating_dist[str(r)] = reviews_collection.count_documents({"rating": r})

        # Avg rating
        all_reviews = list(reviews_collection.find({}, {"rating": 1}))
        avg_rating = round(sum(r["rating"] for r in all_reviews) / len(all_reviews), 1) if all_reviews else 0

        # Recent 7 days new users
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        new_users_week = users_collection.count_documents({"created_at": {"$gte": week_ago}})

        # Recently active users (last_login within 7 days)
        active_users = users_collection.count_documents({"last_login": {"$gte": week_ago}})

        # Laws by category (combined BNS + IPC, with chapter/offence_category fallback)
        bns_cat_counts = _bns_category_counts()
        ipc_cat_counts = _ipc_category_counts()
        laws_by_category: dict = {}
        for cat, c in bns_cat_counts.items():
            laws_by_category[cat] = laws_by_category.get(cat, 0) + c
        for cat, c in ipc_cat_counts.items():
            laws_by_category[cat] = laws_by_category.get(cat, 0) + c
        laws_by_category = dict(sorted(laws_by_category.items(), key=lambda kv: kv[1], reverse=True))

        # Platform status
        platform_enabled = _get_platform_status()

        # Recent reviews
        recent_reviews = []
        for doc in reviews_collection.find().sort("created_at", -1).limit(5):
            txt = doc.get("text", "")
            recent_reviews.append({
                "type":       "review",
                "name":       doc.get("name"),
                "rating":     doc.get("rating"),
                "text":       (txt[:60] + "…") if len(txt) > 60 else txt,
                "created_at": doc.get("created_at"),
            })

        return {
            "total_users":      total_users,
            "total_reviews":    total_reviews,
            "total_queries":    total_queries,
            "bns_laws":         bns_total,
            "ipc_laws":         ipc_total,
            "total_laws":       bns_total + ipc_total,
            "avg_rating":       avg_rating,
            "rating_dist":      rating_dist,
            "new_users_week":   new_users_week,
            "active_users_week": active_users,
            "platform_enabled": platform_enabled,
            "recent_reviews":   recent_reviews,
            "laws_by_category": laws_by_category,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def get_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    search: str = Query(""),
    admin=Depends(_require_admin),
):
    query = {}
    if search:
        query = {"$or": [
            {"name":  {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]}
    skip = (page - 1) * limit
    total = users_collection.count_documents(query)
    docs  = list(users_collection.find(query, {"password": 0}).sort("created_at", -1).skip(skip).limit(limit))
    for d in docs:
        d["id"] = str(d.pop("_id"))
        if "created_at" in d and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
    return {"users": docs, "total": total, "page": page, "pages": -(-total // limit)}

@router.delete("/users/{user_id}")
def delete_user(user_id: str, admin=Depends(_require_admin)):
    try:
        res = users_collection.delete_one({"_id": ObjectId(user_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "User deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Reviews ───────────────────────────────────────────────────────────────────

@router.get("/reviews")
def get_all_reviews(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    search: str = Query(""),
    rating: int = Query(0, ge=0, le=5),
    admin=Depends(_require_admin),
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"text": {"$regex": search, "$options": "i"}},
        ]
    if rating:
        query["rating"] = rating
    skip  = (page - 1) * limit
    total = reviews_collection.count_documents(query)
    docs  = list(reviews_collection.find(query).sort("created_at", -1).skip(skip).limit(limit))
    for d in docs:
        d["id"] = str(d.pop("_id"))
        d.setdefault("featured", False)
    return {"reviews": docs, "total": total, "page": page, "pages": -(-total // limit)}


class FeatureReviewBody(BaseModel):
    featured: bool


@router.patch("/reviews/{review_id}/feature")
def set_review_featured(review_id: str, body: FeatureReviewBody, admin=Depends(_require_admin)):
    """Mark/unmark a review as featured. Only featured reviews are shown in the
    public Reviews/home page showcase — every other submitted review stays
    stored in MongoDB and visible here in the admin panel."""
    try:
        result = reviews_collection.update_one({"_id": ObjectId(review_id)}, {"$set": {"featured": body.featured}})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Review not found")
        return {"message": "Updated", "featured": body.featured}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/reviews/{review_id}")
def delete_review(review_id: str, admin=Depends(_require_admin)):
    try:
        res = reviews_collection.delete_one({"_id": ObjectId(review_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Review not found")
        return {"message": "Review deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Queries ───────────────────────────────────────────────────────────────────

@router.get("/queries")
def get_queries(
    page: int = Query(1, ge=1),
    limit: int = Query(30, le=100),
    search: str = Query(""),
    email: str = Query(""),
    admin=Depends(_require_admin),
):
    # Only real AI-query log entries (excludes any stray non-query documents)
    query: dict = {"question": {"$exists": True}}
    if search:
        query["question"] = {"$regex": search, "$options": "i"}
    if email:
        query["email"] = email
    skip  = (page - 1) * limit
    total = queries_collection.count_documents(query)
    docs  = list(
        queries_collection.find(query, {"password": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    for d in docs:
        d["id"] = str(d.pop("_id"))
        if "created_at" in d and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
    return {"queries": docs, "total": total, "page": page, "pages": -(-total // limit)}


# ── Laws shared model ──────────────────────────────────────────────────────────

class LawUpsert(BaseModel):
    title:          str
    description:    str          = ""
    section_number: str          = ""
    ipc_section:    str          = ""
    bns_section:    str          = ""
    category:       str          = "General"
    chapter:        str          = ""
    punishment:     str          = ""
    bns_punishment: str          = ""
    bailable:       Optional[str]= None   # "Yes" | "No" | "Depends"
    cognizable:     Optional[str]= None
    keywords:       List[str]    = []
    simple_explanation: str      = ""
    real_life_example:  str      = ""


def _law_query(search: str) -> dict:
    if not search:
        return {}
    return {"$or": [
        {"title":            {"$regex": search, "$options": "i"}},
        {"section_number":   {"$regex": search, "$options": "i"}},
        {"ipc_section":      {"$regex": search, "$options": "i"}},
        {"bns_section":      {"$regex": search, "$options": "i"}},
        {"category":         {"$regex": search, "$options": "i"}},
        {"chapter":          {"$regex": search, "$options": "i"}},
        {"offence_category": {"$regex": search, "$options": "i"}},
        {"description":      {"$regex": search, "$options": "i"}},
        {"section_text":     {"$regex": search, "$options": "i"}},
        {"keywords":         {"$regex": search, "$options": "i"}},
    ]}


def _serialize(docs):
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return docs


# ── Category aggregation (works for both raw and admin-enriched docs) ─────────

def _bns_category_counts() -> dict:
    counts: dict = {}
    for doc in bns_collection.find({}, {"category": 1, "chapter": 1}):
        cat = doc.get("category") or doc.get("chapter") or "General"
        counts[cat] = counts.get(cat, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: kv[1], reverse=True))


def _ipc_category_counts() -> dict:
    counts: dict = {}
    for doc in ipc_collection.find({}, {"category": 1, "offence_category": 1, "chapter": 1}):
        cat = doc.get("category") or doc.get("offence_category") or doc.get("chapter") or "General"
        counts[cat] = counts.get(cat, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: kv[1], reverse=True))


# ── BNS Laws CRUD ──────────────────────────────────────────────────────────────

@router.get("/laws")
def get_bns_laws(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    search: str = Query(""),
    admin=Depends(_require_admin),
):
    query = _law_query(search)
    skip  = (page - 1) * limit
    total = bns_collection.count_documents(query)
    docs  = _serialize(list(bns_collection.find(query).sort("section_number", 1).skip(skip).limit(limit)))
    return {"laws": docs, "total": total, "page": page, "pages": -(-total // limit), "source": "bns"}

@router.post("/laws")
def create_bns_law(body: LawUpsert, admin=Depends(_require_admin)):
    doc = body.model_dump()
    doc["created_at"] = _utcnow()
    doc["source"] = "bns"
    res = bns_collection.insert_one(doc)
    doc.pop("_id", None)
    doc["id"] = str(res.inserted_id)
    return {"message": "BNS law created", "law": doc}

@router.put("/laws/{law_id}")
def update_bns_law(law_id: str, body: LawUpsert, admin=Depends(_require_admin)):
    try:
        res = bns_collection.update_one(
            {"_id": ObjectId(law_id)},
            {"$set": {**body.model_dump(), "updated_at": _utcnow()}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="BNS law not found")
        return {"message": "BNS law updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/laws/{law_id}")
def delete_bns_law(law_id: str, admin=Depends(_require_admin)):
    try:
        res = bns_collection.delete_one({"_id": ObjectId(law_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="BNS law not found")
        return {"message": "BNS law deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── IPC Laws CRUD ──────────────────────────────────────────────────────────────

@router.get("/ipc-laws")
def get_ipc_laws(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    search: str = Query(""),
    admin=Depends(_require_admin),
):
    query = _law_query(search)
    skip  = (page - 1) * limit
    total = ipc_collection.count_documents(query)
    docs  = _serialize(list(ipc_collection.find(query).sort("section_number", 1).skip(skip).limit(limit)))
    return {"laws": docs, "total": total, "page": page, "pages": -(-total // limit), "source": "ipc"}

@router.post("/ipc-laws")
def create_ipc_law(body: LawUpsert, admin=Depends(_require_admin)):
    doc = body.model_dump()
    doc["created_at"] = _utcnow()
    doc["source"] = "ipc"
    res = ipc_collection.insert_one(doc)
    doc.pop("_id", None)
    doc["id"] = str(res.inserted_id)
    return {"message": "IPC law created", "law": doc}

@router.put("/ipc-laws/{law_id}")
def update_ipc_law(law_id: str, body: LawUpsert, admin=Depends(_require_admin)):
    try:
        res = ipc_collection.update_one(
            {"_id": ObjectId(law_id)},
            {"$set": {**body.model_dump(), "updated_at": _utcnow()}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="IPC law not found")
        return {"message": "IPC law updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/ipc-laws/{law_id}")
def delete_ipc_law(law_id: str, admin=Depends(_require_admin)):
    try:
        res = ipc_collection.delete_one({"_id": ObjectId(law_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="IPC law not found")
        return {"message": "IPC law deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Laws summary (BNS + IPC combined) ─────────────────────────────────────────

@router.get("/laws-summary")
def laws_summary(admin=Depends(_require_admin)):
    bns_total = bns_collection.count_documents({})
    ipc_total = ipc_collection.count_documents({})
    bns_cats  = _bns_category_counts()
    ipc_cats  = _ipc_category_counts()
    return {
        "bns": {"total": bns_total, "by_category": bns_cats},
        "ipc": {"total": ipc_total, "by_category": ipc_cats},
        "grand_total": bns_total + ipc_total,
    }


# ── Platform on/off toggle ────────────────────────────────────────────────────

def _get_platform_status() -> bool:
    doc = settings_collection.find_one({"key": "platform"})
    if doc is None:
        settings_collection.insert_one({"key": "platform", "enabled": True})
        return True
    return bool(doc.get("enabled", True))

@router.get("/platform-status")
def platform_status(admin=Depends(_require_admin)):
    return {"enabled": _get_platform_status()}

@router.post("/platform/toggle")
def toggle_platform(admin=Depends(_require_admin)):
    current = _get_platform_status()
    new_val = not current
    settings_collection.update_one(
        {"key": "platform"},
        {"$set": {"enabled": new_val, "toggled_by": admin["sub"], "toggled_at": _utcnow()}},
        upsert=True,
    )
    state = "enabled" if new_val else "disabled"
    return {"enabled": new_val, "message": f"Platform {state} successfully"}


# ── Admin list ────────────────────────────────────────────────────────────────

@router.get("/admins")
def list_admins(admin=Depends(_require_admin)):
    docs = list(admin_users_collection.find({}, {"password": 0}))
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"admins": docs}

@router.delete("/admins/{admin_id}")
def delete_admin(admin_id: str, admin=Depends(_require_admin)):
    target = admin_users_collection.find_one({"_id": ObjectId(admin_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    if target["email"] == admin["sub"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    admin_users_collection.delete_one({"_id": ObjectId(admin_id)})
    return {"message": "Admin deleted"}
