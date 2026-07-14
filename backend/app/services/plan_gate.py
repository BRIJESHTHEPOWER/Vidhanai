"""
Plan gating — server-side enforcement of the Free vs Pro plans shown on /pricing.

Free plan:
  • 5 AI legal questions per day  (/ask, /ask-stream)
  • English language only
  • BNS/IPC search, law comparison and Know Your Rights stay open

Pro plan (users.plan_status == "pro", granted ONLY by the Razorpay webhook):
  • Unlimited questions, all 7 languages, voice input, Quiz & Learning Hub,
    AI Law Tutor (incl. JD voice lessons + TTS), Comic Story mode.

Anonymous visitors (home-page demo chat) get a small per-IP daily allowance.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import Depends, HTTPException

from app.db.connection import users_collection, usage_collection
from app.routers import get_current_user_email

FREE_DAILY_QUESTIONS = 5   # matches the pricing page: "5 AI legal questions per day"
ANON_DAILY_QUESTIONS = 2   # home-page demo chat (not logged in), per IP
FREE_LANGUAGES = {"english"}

# Quotas reset at Indian midnight — the product targets Indian users.
_IST = timezone(timedelta(hours=5, minutes=30))


def _today() -> str:
    return datetime.now(_IST).strftime("%Y-%m-%d")


def get_plan_status(user_email: str) -> str:
    user = users_collection.find_one({"email": user_email}, {"plan_status": 1}) or {}
    return user.get("plan_status", "free")


def _upgrade_403(message: str, feature: str) -> HTTPException:
    """Structured 403 the frontend recognises (detail.error == 'upgrade_required')."""
    return HTTPException(status_code=403, detail={
        "error": "upgrade_required",
        "feature": feature,
        "message": message,
    })


def require_pro(user_email: str = Depends(get_current_user_email)) -> str:
    """Dependency for Pro-only endpoints/routers (quiz, tutor, comic, voice, TTS…)."""
    if get_plan_status(user_email) != "pro":
        raise _upgrade_403(
            "This feature is part of the Pro plan. Upgrade to unlock it.",
            "pro_feature",
        )
    return user_email


def require_language_allowed(user_email: Optional[str], language: Optional[str]) -> None:
    """Free plan (and anonymous) is English-only."""
    lang = (language or "English").strip().lower()
    if lang in FREE_LANGUAGES:
        return
    if user_email and get_plan_status(user_email) == "pro":
        return
    raise _upgrade_403(
        "Answers in Indian languages are a Pro feature. The Free plan supports English only.",
        "languages",
    )


def enforce_question_quota(
    user_email: Optional[str],
    language: Optional[str],
    client_ip: Optional[str],
) -> dict:
    """Gate for /ask and /ask-stream. Counts one question and returns
    {"plan", "remaining"} (remaining is None for Pro = unlimited).

    Raises 403 (non-English on Free) or 429 (daily limit reached)."""
    if user_email and get_plan_status(user_email) == "pro":
        return {"plan": "pro", "remaining": None}

    require_language_allowed(user_email, language)
    today = _today()

    if user_email:
        user = users_collection.find_one(
            {"email": user_email}, {"qa_date": 1, "qa_count": 1}
        ) or {}
        count = user.get("qa_count", 0) if user.get("qa_date") == today else 0
        if count >= FREE_DAILY_QUESTIONS:
            raise HTTPException(status_code=429, detail={
                "error": "daily_limit_reached",
                "limit": FREE_DAILY_QUESTIONS,
                "message": (
                    f"You've used all {FREE_DAILY_QUESTIONS} free questions for today. "
                    "Upgrade to Pro for unlimited AI legal questions."
                ),
            })
        res = users_collection.update_one(
            {"email": user_email, "qa_date": today}, {"$inc": {"qa_count": 1}}
        )
        if res.matched_count == 0:  # first question of the day — reset the counter
            users_collection.update_one(
                {"email": user_email}, {"$set": {"qa_date": today, "qa_count": 1}}
            )
        return {"plan": "free", "remaining": max(0, FREE_DAILY_QUESTIONS - count - 1)}

    # Anonymous (home-page demo chat): small per-IP daily allowance.
    key = {"kind": "anon_ask", "ip": client_ip or "unknown", "date": today}
    doc = usage_collection.find_one(key) or {}
    count = doc.get("count", 0)
    if count >= ANON_DAILY_QUESTIONS:
        raise HTTPException(status_code=429, detail={
            "error": "demo_limit_reached",
            "limit": ANON_DAILY_QUESTIONS,
            "message": (
                "Demo limit reached. Create a free account for "
                f"{FREE_DAILY_QUESTIONS} AI legal questions every day."
            ),
        })
    usage_collection.update_one(key, {"$inc": {"count": 1}}, upsert=True)
    return {"plan": "anonymous", "remaining": max(0, ANON_DAILY_QUESTIONS - count - 1)}


def question_usage(user_email: str) -> dict:
    """Read-only usage snapshot for GET /api/user/plan-status."""
    if get_plan_status(user_email) == "pro":
        return {
            "questions_limit": None,
            "questions_used_today": None,
            "questions_remaining": None,
        }
    user = users_collection.find_one(
        {"email": user_email}, {"qa_date": 1, "qa_count": 1}
    ) or {}
    used = user.get("qa_count", 0) if user.get("qa_date") == _today() else 0
    return {
        "questions_limit": FREE_DAILY_QUESTIONS,
        "questions_used_today": used,
        "questions_remaining": max(0, FREE_DAILY_QUESTIONS - used),
    }
