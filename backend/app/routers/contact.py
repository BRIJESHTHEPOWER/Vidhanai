"""
Contact form — POST /contact

Public endpoint for the website's "Contact us" form. Emails the submission to
the support inbox (CONTACT_TO, default the Gmail address) with Reply-To set to
the sender, and sends the sender a confirmation. All mail goes through the
shared send_email() helper, so it uses the verified VidhanAI <noreply@vidhanai.me>
sender automatically.
"""
import os
import re
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.email_service import send_email
from app.services import email_templates

logger = logging.getLogger("vidhan.contact")

router = APIRouter(tags=["Contact"])
limiter = Limiter(key_func=get_remote_address)

_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def _support_inbox() -> str:
    """Where contact submissions are delivered."""
    return (os.getenv("CONTACT_TO")
            or os.getenv("GMAIL_USER")
            or "vidhanai.updates@gmail.com").strip()


class ContactIn(BaseModel):
    name:    str = Field(..., min_length=1, max_length=100)
    email:   str = Field(..., max_length=254)
    subject: str = Field("General enquiry", max_length=150)
    message: str = Field(..., min_length=5, max_length=4000)


@router.post("/contact")
@limiter.limit("5/minute")
def submit_contact(request: Request, body: ContactIn):
    name = body.name.strip()
    email = body.email.strip()
    subject = (body.subject or "General enquiry").strip()
    message = body.message.strip()

    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # 1. Deliver the submission to the support inbox (reply goes to the sender).
    admin_html, admin_text = email_templates.contact_admin_email(name, email, subject, message)
    ok, status_msg = send_email(
        to=_support_inbox(),
        subject=f"[Contact] {subject} — from {name}",
        html=admin_html,
        text=admin_text,
        reply_to=email,
    )
    if not ok:
        logger.error("Contact form: could not deliver message from %s: %s", email, status_msg)
        raise HTTPException(
            status_code=502,
            detail="We couldn't send your message right now. Please try again shortly.",
        )

    # 2. Confirmation to the sender (best-effort — don't fail the request on this).
    ack_html, ack_text = email_templates.contact_ack_email(name, subject)
    ack_ok, ack_msg = send_email(
        to=email,
        subject="We received your message — VidhanAI",
        html=ack_html,
        text=ack_text,
    )
    if not ack_ok:
        logger.warning("Contact form: acknowledgement to %s not sent: %s", email, ack_msg)

    return {"success": True, "message": "Thanks! Your message has been sent. We'll get back to you soon."}
