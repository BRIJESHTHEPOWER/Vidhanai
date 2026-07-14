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

class ReviewResponse(BaseModel):
    id: str
    name: str
    rating: int
    text: str
    role: Optional[str] = None
    created_at: str
    featured: bool = False

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

    name = user.get("name") or user_email.split("@")[0]

    try:
        now = datetime.now().isoformat()
        review_doc = {
            "name": name.strip(),
            "email": user_email,
            "rating": review.rating,
            "text": review.text.strip(),
            "role": review.role.strip() if review.role else None,
            "created_at": now,
            "featured": False,
        }
        result = reviews_collection.insert_one(review_doc)
        review_doc["id"] = str(result.inserted_id)
        return review_doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create review: {str(e)}")

@router.get("", response_model=List[ReviewResponse])
async def get_reviews(limit: int = 100, featured_only: bool = True):
    """Public reviews feed. By default only returns reviews an admin has
    marked as featured (shown on the home page / Reviews page showcase).
    Every submitted review is still stored in MongoDB and visible to admins."""
    try:
        query = {"featured": True} if featured_only else {}
        cursor = reviews_collection.find(query).sort("created_at", -1).limit(limit)
        reviews = []
        for doc in cursor:
            doc["id"] = str(doc["_id"])
            doc.setdefault("featured", False)
            reviews.append(doc)
        return reviews
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reviews: {str(e)}")

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
