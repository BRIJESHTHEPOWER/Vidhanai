"""
Announcements router — Vidhan.ai "What's new" updates + newsletter.

Flow:
  • Admin posts an update from the admin console  →  stored permanently in
    MongoDB (with full date & time)  →  emailed to newsletter subscribers.
  • The website bell (NotificationBell) shows only updates from the LAST
    7 DAYS — older ones vanish from the frontend automatically but remain
    in the database and stay visible in the admin console history.

Endpoints
  Public:
    GET   /api/announcements            → last-7-days feed for the bell
    PATCH /api/announcements/mark-read  → clears the red "new" dot
    POST  /api/newsletter/subscribe     → footer newsletter signup
  Admin (JWT via _require_admin):
    GET    /admin/announcements         → FULL history (date + time, email status)
    POST   /admin/announcements         → create + email subscribers (background)
    DELETE /admin/announcements/{id}
"""
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId

from app.db.connection import (
    announcements_collection,
    newsletter_subscribers_collection,
)
from app.routers.admin import _require_admin
from app.services.email_service import send_email

router = APIRouter(tags=["Announcements"])

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
BELL_WINDOW_DAYS = 7   # how long an update stays visible in the website bell


# ── Models ────────────────────────────────────────────────────────────────────

class AnnouncementIn(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    message: str = Field(..., min_length=3, max_length=1000)
    plan: str = "all"
    feature_tag: str = "New Feature"


class SubscribeIn(BaseModel):
    email: str = Field(..., max_length=254)


# ── Email broadcast (best-effort, runs in background) ─────────────────────────

def _send_update_emails(announcement_id: str, title: str, message: str) -> None:
    """Email the update to every newsletter subscriber via the shared sender
    (Gmail SMTP first, Resend fallback — see services/email_service.py).
    Posting an update must never fail because email did."""
    site = os.getenv("SITE_URL", "http://localhost:3000")

    subscribers = [s["email"] for s in newsletter_subscribers_collection.find({}, {"email": 1})]

    def record(status: str, sent: int) -> None:
        try:
            announcements_collection.update_one(
                {"_id": ObjectId(announcement_id)},
                {"$set": {"email_status": status, "emailed_to": sent}},
            )
        except Exception as e:
            print(f"[Announcements] Could not record email status: {e}")

    if not subscribers:
        record("no subscribers", 0)
        return

    html = f"""
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#4f46e5;margin:0 0 4px;">Vidhan.ai — What's new</h2>
      <h3 style="margin:16px 0 8px;color:#111;">{title}</h3>
      <p style="color:#444;line-height:1.6;">{message}</p>
      <a href="{site}" style="display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;
         padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Open Vidhan.ai</a>
      <p style="color:#999;font-size:12px;margin-top:24px;">
        You receive this because you subscribed to Vidhan.ai updates.</p>
    </div>"""

    sent = 0
    last_status = ""
    for email in subscribers:
        ok, status = send_email(
            to=email,
            subject=f"Vidhan.ai update: {title}",
            html=html,
            text=f"{title}\n\n{message}\n\n{site}",
        )
        if ok:
            sent += 1
        else:
            last_status = status
            print(f"[Announcements] Failed to email {email}: {status}")
    if sent == 0 and last_status:
        record(f"email failed: {last_status}", 0)
    else:
        record(f"sent to {sent}/{len(subscribers)} subscribers", sent)


# ── Public: bell feed (last 7 days only) ─────────────────────────────────────

@router.get("/api/announcements")
def list_announcements():
    """Feed for the website bell. Only updates from the last 7 days — older
    ones disappear from the frontend but remain stored for the admin."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=BELL_WINDOW_DAYS)
    docs = list(
        announcements_collection
        .find({"created_at": {"$gte": cutoff}})
        .sort("created_at", -1)
        .limit(50)
    )
    out = []
    for d in docs:
        out.append({
            "_id":         str(d["_id"]),
            "title":       d.get("title", ""),
            "message":     d.get("message", ""),
            "plan":        d.get("plan", "all"),
            "feature_tag": d.get("feature_tag", "New Feature"),
            "date":        d.get("date", ""),
            "is_new":      bool(d.get("is_new", False)),
        })
    return out


@router.patch("/api/announcements/mark-read")
def mark_all_read():
    announcements_collection.update_many({"is_new": True}, {"$set": {"is_new": False}})
    return {"success": True}


# ── Public: newsletter subscribe (footer form) ───────────────────────────────

@router.post("/api/newsletter/subscribe")
def newsletter_subscribe(body: SubscribeIn):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    existing = newsletter_subscribers_collection.find_one({"email": email})
    if existing:
        return {"success": True, "message": "You're already subscribed!"}
    newsletter_subscribers_collection.insert_one({
        "email": email,
        "subscribed_at": datetime.now(timezone.utc),
    })
    return {"success": True, "message": "Subscribed! You'll get updates by email."}


# ── Admin: full history + create + delete ────────────────────────────────────

@router.get("/admin/announcements")
def admin_list_announcements(admin=Depends(_require_admin)):
    """FULL permanent history for the admin console — every update ever posted,
    with exact date & time and email delivery status."""
    docs = list(announcements_collection.find().sort("created_at", -1))
    cutoff = datetime.now(timezone.utc) - timedelta(days=BELL_WINDOW_DAYS)
    out = []
    for d in docs:
        created = d.get("created_at")
        # naive datetimes (from older inserts) are treated as UTC
        if isinstance(created, datetime) and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        out.append({
            "id":           str(d["_id"]),
            "title":        d.get("title", ""),
            "message":      d.get("message", ""),
            "plan":         d.get("plan", "all"),
            "feature_tag":  d.get("feature_tag", "New Feature"),
            "created_at":   created.isoformat() if isinstance(created, datetime) else "",
            "live_on_bell": isinstance(created, datetime) and created >= cutoff,
            "emailed_to":   d.get("emailed_to", 0),
            "email_status": d.get("email_status", "—"),
        })
    subscriber_count = newsletter_subscribers_collection.count_documents({})
    return {"announcements": out, "subscriber_count": subscriber_count}


@router.post("/admin/announcements")
def admin_create_announcement(
    body: AnnouncementIn,
    background: BackgroundTasks,
    admin=Depends(_require_admin),
):
    now = datetime.now(timezone.utc)
    doc = {
        "title":        body.title.strip(),
        "message":      body.message.strip(),
        "plan":         body.plan,
        "feature_tag":  body.feature_tag,
        "date":         now.strftime("%Y-%m-%d"),
        "is_new":       True,
        "created_at":   now,
        "created_by":   admin.get("sub", "admin"),
        "emailed_to":   0,
        "email_status": "sending…",
    }
    result = announcements_collection.insert_one(doc)
    ann_id = str(result.inserted_id)
    # Email subscribers without blocking the admin's request.
    background.add_task(_send_update_emails, ann_id, doc["title"], doc["message"])
    return {"success": True, "id": ann_id}


@router.delete("/admin/announcements/{announcement_id}")
def admin_delete_announcement(announcement_id: str, admin=Depends(_require_admin)):
    try:
        oid = ObjectId(announcement_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    result = announcements_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"success": True}
