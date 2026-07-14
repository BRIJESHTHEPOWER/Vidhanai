"""
Branded HTML/text builders for VidhanAI transactional emails.

Each function returns (html, text). Keep all styling inline — email clients
strip <style> blocks. Every template is wrapped by _wrap() for a consistent
header/footer. Used by auth.py (verification, reset, welcome) and
contact.py (contact form).
"""
from typing import Tuple

BRAND = "VidhanAI"
PRIMARY = "#6d28d9"
SITE = "Vidhan.ai — AI Legal Awareness for India"


def _wrap(inner_html: str) -> str:
    return f"""\
<div style="background:#f4f4f8;padding:24px 0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;
              overflow:hidden;border:1px solid #ececf2;">
    <div style="background:{PRIMARY};padding:18px 24px;">
      <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.3px;">⚖️ {BRAND}</span>
    </div>
    <div style="padding:24px;color:#333;line-height:1.6;">
      {inner_html}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #f0f0f4;color:#9a9aa8;font-size:12px;">
      {SITE}
    </div>
  </div>
</div>"""


def _code_box(code: str) -> str:
    return (f'<div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#111;'
            f'background:#f4f4f8;border-radius:10px;padding:16px 12px;text-align:center;'
            f'margin:20px 0;">{code}</div>')


def verification_email(name: str, code: str, minutes: int) -> Tuple[str, str]:
    inner = (
        f'<h2 style="color:{PRIMARY};margin:0 0 8px;">Verify your email</h2>'
        f'<p>Hi {name or "there"}, use this code to verify your {BRAND} account:</p>'
        f'{_code_box(code)}'
        f'<p style="color:#666;">This code expires in {minutes} minutes. '
        f'If you didn\'t request this, you can ignore this email.</p>'
    )
    text = (f"Your {BRAND} verification code is {code}. "
            f"It expires in {minutes} minutes.")
    return _wrap(inner), text


def password_reset_email(name: str, code: str, minutes: int) -> Tuple[str, str]:
    inner = (
        f'<h2 style="color:{PRIMARY};margin:0 0 8px;">Reset your password</h2>'
        f'<p>Hi {name or "there"}, we received a request to reset your {BRAND} '
        f'password. Enter this code to continue:</p>'
        f'{_code_box(code)}'
        f'<p style="color:#666;">This code expires in {minutes} minutes. '
        f'If you didn\'t request a reset, ignore this email — your password stays '
        f'unchanged.</p>'
    )
    text = (f"Your {BRAND} password reset code is {code}. "
            f"It expires in {minutes} minutes. "
            f"If you didn't request this, ignore this email.")
    return _wrap(inner), text


def welcome_email(name: str) -> Tuple[str, str]:
    inner = (
        f'<h2 style="color:{PRIMARY};margin:0 0 8px;">Welcome to {BRAND}! 🎉</h2>'
        f'<p>Hi {name or "there"}, your account is verified and ready.</p>'
        f'<p>{BRAND} helps you understand Indian law (BNS 2023 &amp; IPC 1860) in '
        f'plain language. Here\'s what you can do:</p>'
        f'<ul style="padding-left:18px;color:#444;">'
        f'<li>Ask AI legal questions and compare IPC ↔ BNS sections</li>'
        f'<li>Learn your rights and explore Know-Your-Rights guides</li>'
        f'<li>Upgrade to Pro for the Law Tutor, quizzes, voice input and more</li>'
        f'</ul>'
        f'<p style="color:#666;">Happy learning! — The {BRAND} team</p>'
    )
    text = (f"Welcome to {BRAND}! Your account is verified. Ask AI legal questions, "
            f"compare IPC/BNS sections, and learn your rights. — The {BRAND} team")
    return _wrap(inner), text


def contact_admin_email(name: str, email: str, subject: str, message: str) -> Tuple[str, str]:
    safe_msg = (message or "").replace("\n", "<br>")
    inner = (
        f'<h2 style="color:{PRIMARY};margin:0 0 8px;">New contact form message</h2>'
        f'<p><b>From:</b> {name} &lt;{email}&gt;</p>'
        f'<p><b>Subject:</b> {subject}</p>'
        f'<div style="background:#f4f4f8;border-radius:10px;padding:14px;margin-top:8px;">'
        f'{safe_msg}</div>'
        f'<p style="color:#666;margin-top:16px;">Reply directly to this email to '
        f'respond to {name}.</p>'
    )
    text = f"New contact message from {name} <{email}>\nSubject: {subject}\n\n{message}"
    return _wrap(inner), text


def contact_ack_email(name: str, subject: str) -> Tuple[str, str]:
    inner = (
        f'<h2 style="color:{PRIMARY};margin:0 0 8px;">We got your message ✅</h2>'
        f'<p>Hi {name or "there"}, thanks for reaching out to {BRAND}. '
        f'We received your message about "<b>{subject}</b>" and will get back to '
        f'you soon.</p>'
        f'<p style="color:#666;">— The {BRAND} team</p>'
    )
    text = (f"Hi {name or 'there'}, thanks for contacting {BRAND}. We received your "
            f'message about "{subject}" and will reply soon.')
    return _wrap(inner), text
