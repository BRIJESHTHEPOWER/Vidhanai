"""
Transactional email sender — Resend (primary) with optional Gmail SMTP fallback.

Sender identity is centralised here: every feature calls send_email(), so all
mail goes out as EMAIL_FROM (default: "VidhanAI <noreply@vidhanai.me>"), a
sender on a domain verified at resend.com/domains. No sandbox mode — the
verified domain delivers to any recipient.

Provider order
  1. Resend  — primary. Requires RESEND_API_KEY. Delivers to anyone because the
               EMAIL_FROM domain is verified.
  2. Gmail   — optional fallback, used only if Resend fails AND GMAIL_USER +
               GMAIL_APP_PASSWORD are set.

CONFIG (.env)
  RESEND_API_KEY      Resend API key (primary provider).
  EMAIL_FROM          Verified sender, e.g. "VidhanAI <noreply@vidhanai.me>".
  GMAIL_USER          Optional fallback Gmail address.
  GMAIL_APP_PASSWORD  Optional fallback 16-char Google app password.

send_email() never raises: a failed send is logged and returned as
(False, reason). The caller's action (signup, subscribe, …) still succeeds —
only the notification failed.

Used by auth.py (OTP / verification) and announcements.py (newsletter / admin
updates). Any new email feature should call send_email() so it inherits this
sender automatically.
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Tuple

import resend

logger = logging.getLogger("vidhan.email")

# Default verified sender. Override per-environment with EMAIL_FROM in .env.
DEFAULT_SENDER = "VidhanAI <noreply@vidhanai.me>"


def get_sender() -> str:
    """The From identity used for every outgoing email."""
    return (os.getenv("EMAIL_FROM") or DEFAULT_SENDER).strip()


def _send_via_resend(to: str, subject: str, html: str, text: str,
                     reply_to: str = "") -> str:
    """Send one email through Resend. Raises on any failure. Returns the
    Resend message id on success."""
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY is not set")

    # Configure the SDK on every call — cheap, and safe across workers/reloads.
    resend.api_key = api_key

    params = {
        "from":    get_sender(),
        "to":      [to],
        "subject": subject,
        "html":    html,
        "text":    text or subject,
    }
    if reply_to:
        params["reply_to"] = reply_to
    resp = resend.Emails.send(params)

    # The SDK returns a dict (or object) carrying the message id.
    msg_id = None
    if isinstance(resp, dict):
        msg_id = resp.get("id")
    else:
        msg_id = getattr(resp, "id", None)
    return msg_id or "sent"


def _send_via_gmail(user: str, app_password: str, to: str,
                    subject: str, html: str, text: str, reply_to: str = "") -> None:
    """Optional SMTP fallback. Raises on failure — caller decides what to do."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = get_sender()
    msg["To"] = to
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.attach(MIMEText(text or subject, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20) as server:
        server.login(user, app_password)
        # Envelope sender must be the authenticated Gmail account; the visible
        # From header above carries the VidhanAI identity.
        server.sendmail(user, [to], msg.as_string())


def send_email(to: str, subject: str, html: str, text: str = "",
               reply_to: str = "") -> Tuple[bool, str]:
    """Send one transactional email. Resend first (verified domain — delivers to
    anyone), Gmail SMTP as an optional fallback.

    reply_to: optional Reply-To address (e.g. the sender of a contact form),
    so replies go to the person rather than the noreply@ mailbox.

    Returns (success, status_message). Never raises.
    """
    resend_key = os.getenv("RESEND_API_KEY")
    gmail_user = (os.getenv("GMAIL_USER") or "").strip()
    gmail_pass = (os.getenv("GMAIL_APP_PASSWORD") or "").replace(" ", "").strip()
    gmail_ready = bool(gmail_user and gmail_pass)

    if not resend_key and not gmail_ready:
        logger.error(
            "Email not configured — set RESEND_API_KEY (recommended) "
            "or GMAIL_USER + GMAIL_APP_PASSWORD."
        )
        return False, "email not configured (set RESEND_API_KEY or Gmail credentials)"

    errors = []

    # ── Primary: Resend with the verified domain ─────────────────────────────
    if resend_key:
        try:
            msg_id = _send_via_resend(to, subject, html, text, reply_to)
            logger.info("Email sent via Resend to %s (from=%s, id=%s)",
                        to, get_sender(), msg_id)
            return True, f"sent via resend ({msg_id})"
        except Exception as e:
            logger.warning("Resend send to %s failed: %s", to, e)
            errors.append(f"resend: {e}")

    # ── Fallback: Gmail SMTP (only if configured) ────────────────────────────
    if gmail_ready:
        try:
            _send_via_gmail(gmail_user, gmail_pass, to, subject, html, text, reply_to)
            logger.info("Email sent via Gmail SMTP fallback to %s", to)
            return True, "sent via gmail"
        except Exception as e:
            logger.error("Gmail SMTP send to %s failed: %s", to, e)
            errors.append(f"gmail: {e}")

    reason = "; ".join(errors) or "no email provider available"
    logger.error("All email providers failed for %s: %s", to, reason)
    return False, reason
