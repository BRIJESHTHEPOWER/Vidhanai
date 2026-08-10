from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

from app.db.connection import reviews_collection, users_collection
from app.routers import get_current_user_email_optional

router = APIRouter(prefix="/reviews", tags=["Reviews"])

class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    text: str = Field(..., min_length=5, max_length=1000)
    role: Optional[str] = Field(None, max_length=80)
    # The display name for THIS review. Defaults to the account name when empty,
    # but a reviewer may prefer a shorter name, a pen name, or their first name
    # only. The account it came from is still recorded and shown alongside.
    name: Optional[str] = Field(None, max_length=60)

class ReviewResponse(BaseModel):
    id: str
    name: str
    rating: int
    text: str
    role: Optional[str] = None
    created_at: str
    featured: bool = False
    picture: Optional[str] = None   # Google avatar, so the reviewer is a real face
    email: Optional[str] = None     # MASKED — see _mask_email


def _mask_email(email: Optional[str]) -> Optional[str]:
    """`brijesh.kumar@gmail.com` -> `bri•••ar@gmail.com`.

    The reviews feed is public and unauthenticated, so publishing full addresses
    would hand a scraper a verified mailing list. Masking keeps what the feature
    is actually for — showing a review came from a real signed-in account, and
    letting someone recognise their own — without leaking anyone's inbox.
    """
    if not email or "@" not in email:
        return None
    local, _, domain = email.partition("@")
    if len(local) <= 4:
        visible = local[:1]
        return f"{visible}{'•' * 3}@{domain}"
    return f"{local[:3]}{'•' * 3}{local[-2:]}@{domain}"


def _serialise(doc: dict, profiles: dict) -> dict:
    """Review document -> API shape, enriched from the author's account.

    The avatar comes from the live user record, so a review written before that
    was stored (or by someone who has since changed their photo) still shows the
    right face. The NAME does not: it belongs to the review.
    """
    email = doc.get("email")
    profile = profiles.get(email, {}) if email else {}
    return {
        "id": str(doc["_id"]),
        # The name saved WITH the review wins. That is the name the reviewer
        # chose to be published under; preferring the account name here would
        # rewrite every review by one person to a single name.
        "name": doc.get("name") or profile.get("name") or "Anonymous",
        "rating": doc.get("rating", 5),
        "text": doc.get("text", ""),
        "role": doc.get("role"),
        "created_at": doc.get("created_at", ""),
        "featured": bool(doc.get("featured", False)),
        "picture": profile.get("picture") or doc.get("picture") or None,
        "email": _mask_email(email),
    }

@router.post("", response_model=ReviewResponse)
async def create_review(
    review: ReviewCreate,
    user_email: Optional[str] = Depends(get_current_user_email_optional),
):
    if not user_email:
        raise HTTPException(status_code=401, detail="Please log in to submit a review.")

    user = users_collection.find_one({"email": user_email})
    if not user:
        raise HTTPException(status_code=401, detail="Account not found. Please log in again.")

    # Whatever the reviewer typed, else their account name, else the local part
    # of their address — never blank.
    name = (review.name or "").strip() or user.get("name") or user_email.split("@")[0]

    try:
        now = datetime.now().isoformat()
        review_doc = {
            "name": name.strip(),
            "email": user_email,
            # Snapshot the avatar so a review still has a face if the account is
            # later deleted; live lookups in _serialise take priority while the
            # account exists, so a changed photo is picked up automatically.
            "picture": user.get("picture") or None,
            "rating": review.rating,
            "text": review.text.strip(),
            "role": review.role.strip() if review.role else None,
            "created_at": now,
            "featured": False,
        }
        result = reviews_collection.insert_one(review_doc)
        review_doc["_id"] = result.inserted_id
        return _serialise(review_doc, {user_email: user})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create review: {str(e)}")

@router.get("", response_model=List[ReviewResponse])
async def get_reviews(limit: int = 100, featured_only: bool = True):
    """Public reviews feed. By default only returns reviews an admin has
    marked as featured (shown on the home page / Reviews page showcase).
    Every submitted review is still stored in MongoDB and visible to admins."""
    try:
        query = {"featured": True} if featured_only else {}
        docs = list(reviews_collection.find(query).sort("created_at", -1).limit(limit))

        # One lookup for every author, rather than one per review — the avatar
        # and current display name live on the account, not on the review.
        emails = {d.get("email") for d in docs if d.get("email")}
        profiles = {}
        if emails:
            for u in users_collection.find(
                {"email": {"$in": list(emails)}},
                {"email": 1, "name": 1, "picture": 1, "_id": 0},
            ):
                profiles[u["email"]] = u

        return [_serialise(d, profiles) for d in docs]
    except Exception as e:
        print(f"[WARN] Database query failed in get_reviews: {e}")
        return []

@router.delete("/{review_id}")
async def delete_review(review_id: str):
    """Admin: delete a review by ID."""
    try:
        from bson import ObjectId
        result = reviews_collection.delete_one({"_id": ObjectId(review_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Review not found")
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
