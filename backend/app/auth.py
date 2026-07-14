from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import bcrypt
from app.db.connection import users_collection
from app.services.email_service import send_email
from app.services import email_templates
import jwt
import random
from datetime import datetime, timedelta, timezone
import os
import sys

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    print(
        "❌  FATAL: JWT_SECRET is not set in your .env file.\n"
        "    Add:  JWT_SECRET=your-very-long-random-secret-here\n"
        "    Generate one: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
    sys.exit(1)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
ALGORITHM = "HS256"

OTP_EXPIRY_MINUTES   = 10
OTP_RESEND_COOLDOWN  = 30   # seconds — server-side backstop behind the frontend's own cooldown

RESET_OTP_EXPIRY_MINUTES = 15
RESET_OTP_COOLDOWN       = 30   # seconds between password-reset code requests

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── One-time grandfather migration ────────────────────────────────────────────
# Email-verification is a new requirement. Every email/password account that
# existed before this feature shipped was never asked to verify anything, so
# locking them out now would be a regression, not a security fix. Any account
# missing the "verified" field entirely (i.e. created before this change) is
# marked verified once. New signups always start unverified (see signup_user).
def _grandfather_existing_users() -> None:
    try:
        result = users_collection.update_many(
            {"auth_provider": "email", "verified": {"$exists": False}},
            {"$set": {"verified": True}},
        )
        if result.modified_count:
            print(f"[Auth] Grandfathered {result.modified_count} pre-existing email account(s) as verified.")
    except Exception as e:
        print(f"[Auth] Could not run grandfather migration: {e}")

try:
    _grandfather_existing_users()
except Exception as e:
    print(f"[Auth] Grandfather migration error: {e}")

class PwdContext:
    def hash(self, password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    def verify(self, plain: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
        except:
            return False

pwd_context = PwdContext()

class UserSignup(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class ForgotPassword(BaseModel):
    email: str

class ResetPassword(BaseModel):
    email: str
    code: str
    new_password: str

class GoogleToken(BaseModel):
    token: str

class ProfileUpdate(BaseModel):
    email: str
    picture: str

class OTPVerify(BaseModel):
    email: str
    code: str

class OTPResend(BaseModel):
    email: str

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def _generate_and_send_otp(email: str, name: str) -> None:
    """Generate a fresh 6-digit code, store it (10-min expiry) and email it via
    Resend. Best-effort: a failed email must never break signup/resend — the
    code is still stored, so 'resend code' lets the user recover."""
    code = str(random.randint(100000, 999999))
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)

    users_collection.update_one(
        {"email": email},
        {"$set": {
            "otp_code": code,
            "otp_expires_at": expires_at,
            "otp_last_sent_at": now,
        }},
    )

    html, text = email_templates.verification_email(name, code, OTP_EXPIRY_MINUTES)
    ok, status_msg = send_email(
        to=email,
        subject=f"Your VidhanAI verification code: {code}",
        html=html,
        text=text,
    )
    if not ok:
        print(f"[Auth] OTP email to {email} not sent: {status_msg}")


def _generate_and_send_reset_otp(email: str, name: str) -> None:
    """Generate a fresh 6-digit password-reset code, store it (15-min expiry)
    under separate reset_* fields (so it never collides with the signup
    verification OTP) and email it. Best-effort — a failed email is logged."""
    code = str(random.randint(100000, 999999))
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=RESET_OTP_EXPIRY_MINUTES)

    users_collection.update_one(
        {"email": email},
        {"$set": {
            "reset_otp_code": code,
            "reset_otp_expires_at": expires_at,
            "reset_otp_last_sent_at": now,
        }},
    )

    html, text = email_templates.password_reset_email(name, code, RESET_OTP_EXPIRY_MINUTES)
    ok, status_msg = send_email(
        to=email,
        subject=f"Your VidhanAI password reset code: {code}",
        html=html,
        text=text,
    )
    if not ok:
        print(f"[Auth] Reset OTP email to {email} not sent: {status_msg}")


def _send_welcome_email(email: str, name: str) -> None:
    """Send the one-time welcome email. Best-effort — never blocks signup."""
    html, text = email_templates.welcome_email(name)
    ok, status_msg = send_email(
        to=email,
        subject="Welcome to VidhanAI 🎉",
        html=html,
        text=text,
    )
    if not ok:
        print(f"[Auth] Welcome email to {email} not sent: {status_msg}")

@router.post("/signup")
def signup_user(user: UserSignup):
    try:
        if users_collection.find_one({"email": user.email}):
            raise HTTPException(status_code=400, detail="User already registered.")
        hashed_password = pwd_context.hash(user.password)
        new_user = {
            "name": user.name,
            "email": user.email,
            "password": hashed_password,
            "picture": "",
            "auth_provider": "email",
            "verified": False,   # must verify via OTP before /auth/login will succeed
            "created_at": datetime.now(timezone.utc)
        }
        users_collection.insert_one(new_user)
        _generate_and_send_otp(user.email, user.name)
        return {
            "message": "Account created. Enter the verification code we emailed you.",
            "email": user.email,
            "otp_required": True,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Auth] Signup DB error: {e}")
        raise HTTPException(status_code=503, detail="Authentication service temporarily unavailable.")

@router.post("/login")
def login_user(user: UserLogin):
    try:
        db_user = users_collection.find_one({"email": user.email})
    except Exception as e:
        print(f"[Auth] Login DB error: {e}")
        raise HTTPException(status_code=503, detail="Authentication service temporarily unavailable.")

    if not db_user or not pwd_context.verify(user.password, db_user["password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    # Google accounts are never gated here — this check only ever applies to
    # accounts created with auth_provider "email" (manual signup).
    if db_user.get("auth_provider") == "email" and not db_user.get("verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before logging in. Check your inbox for the verification code.",
        )

    now = datetime.now(timezone.utc)
    users_collection.update_one(
        {"email": user.email},
        {"$set": {"last_login": now.isoformat()}, "$push": {"login_history": {"action": "login", "at": now.isoformat()}}}
    )

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(days=7)
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "name": db_user["name"],
        "email": db_user["email"],
        "picture": db_user.get("picture", ""),
        "last_login": now.isoformat(),
    }

@router.post("/verify-otp")
def verify_otp(body: OTPVerify):
    db_user = users_collection.find_one({"email": body.email})
    if not db_user:
        raise HTTPException(status_code=404, detail="No account found for this email.")

    if db_user.get("verified", False):
        # Idempotent: verifying twice (e.g. double-submit) is not an error.
        access_token = create_access_token(data={"sub": body.email}, expires_delta=timedelta(days=7))
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "name": db_user["name"],
            "email": db_user["email"],
            "picture": db_user.get("picture", ""),
            "message": "Email already verified.",
        }

    stored_code = db_user.get("otp_code")
    expires_at  = db_user.get("otp_expires_at")
    if not stored_code or not expires_at:
        raise HTTPException(status_code=400, detail="No verification code found. Please request a new one.")

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This code has expired. Please request a new one.")

    if body.code.strip() != stored_code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    users_collection.update_one(
        {"email": body.email},
        {
            "$set": {"verified": True},
            "$unset": {"otp_code": "", "otp_expires_at": "", "otp_last_sent_at": ""},
        },
    )

    # First successful verification → welcome the new user (best-effort).
    _send_welcome_email(body.email, db_user.get("name", ""))

    # Auto-login: the user just proved ownership of the email, no need to make
    # them type their password again right after signing up.
    now = datetime.now(timezone.utc)
    users_collection.update_one(
        {"email": body.email},
        {"$set": {"last_login": now.isoformat()}, "$push": {"login_history": {"action": "login", "at": now.isoformat()}}}
    )
    access_token = create_access_token(data={"sub": body.email}, expires_delta=timedelta(days=7))
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "name": db_user["name"],
        "email": db_user["email"],
        "picture": db_user.get("picture", ""),
        "message": "Email verified successfully!",
    }


@router.post("/resend-otp")
def resend_otp(body: OTPResend):
    db_user = users_collection.find_one({"email": body.email})
    if not db_user:
        raise HTTPException(status_code=404, detail="No account found for this email.")

    if db_user.get("auth_provider") != "email":
        raise HTTPException(status_code=400, detail="This account uses Google sign-in and does not need a code.")

    if db_user.get("verified", False):
        return {"message": "This email is already verified. Please log in."}

    last_sent = db_user.get("otp_last_sent_at")
    if last_sent:
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last_sent).total_seconds()
        if elapsed < OTP_RESEND_COOLDOWN:
            wait = int(OTP_RESEND_COOLDOWN - elapsed)
            raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting another code.")

    _generate_and_send_otp(body.email, db_user.get("name", ""))
    return {"message": "A new verification code has been sent to your email."}


@router.post("/google")
async def google_auth(body: GoogleToken):
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests

        idinfo = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        email   = idinfo["email"]
        name    = idinfo.get("name", email.split("@")[0])
        picture = idinfo.get("picture", "")

        existing = users_collection.find_one({"email": email})
        if not existing:
            users_collection.insert_one({
                "name": name,
                "email": email,
                "password": "",
                "picture": picture,
                "auth_provider": "google",
                "verified": True,   # Google already verified the address
                "created_at": datetime.now(timezone.utc)
            })
            # First-time Google signup → welcome email (best-effort).
            _send_welcome_email(email, name)
        else:
            users_collection.update_one(
                {"email": email},
                {"$set": {"picture": picture, "name": name}}
            )

        access_token = create_access_token(
            data={"sub": email},
            expires_delta=timedelta(days=7)
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "name": name,
            "email": email,
            "picture": picture
        }
    except Exception as e:
        print(f"[Auth] Google auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Google token.")

@router.post("/update-picture")
def update_picture(body: ProfileUpdate):
    try:
        users_collection.update_one(
            {"email": body.email},
            {"$set": {"picture": body.picture}}
        )
        return {"message": "Profile picture updated!", "picture": body.picture}
    except Exception as e:
        print(f"[Auth] Update picture error: {e}")
        raise HTTPException(status_code=500, detail="Failed to update picture.")

@router.post("/forgot-password")
def forgot_password(req: ForgotPassword):
    """Send a password-reset code to the email if a password account exists.

    Always returns the same generic message so the endpoint can't be used to
    probe which emails are registered (no account enumeration)."""
    generic = {"message": "If an account exists for this email, we've sent a password reset code."}
    email = (req.email or "").strip().lower()

    try:
        db_user = users_collection.find_one({"email": email})
    except Exception as e:
        print(f"[Auth] Forgot-password DB error: {e}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable.")

    # No account, or a Google account (no password to reset) → say nothing extra.
    if not db_user or db_user.get("auth_provider") != "email":
        return generic

    # Light rate-limit: one reset code per RESET_OTP_COOLDOWN seconds.
    last_sent = db_user.get("reset_otp_last_sent_at")
    if last_sent:
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last_sent).total_seconds()
        if elapsed < RESET_OTP_COOLDOWN:
            wait = int(RESET_OTP_COOLDOWN - elapsed)
            raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting another code.")

    _generate_and_send_reset_otp(email, db_user.get("name", ""))
    return generic


@router.post("/reset-password")
def reset_password(body: ResetPassword):
    """Verify the reset code and set a new password."""
    email = (body.email or "").strip().lower()
    new_password = body.new_password or ""

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    try:
        db_user = users_collection.find_one({"email": email})
    except Exception as e:
        print(f"[Auth] Reset-password DB error: {e}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable.")

    if not db_user or db_user.get("auth_provider") != "email":
        raise HTTPException(status_code=400, detail="Invalid or expired reset code.")

    stored_code = db_user.get("reset_otp_code")
    expires_at  = db_user.get("reset_otp_expires_at")
    if not stored_code or not expires_at:
        raise HTTPException(status_code=400, detail="No active reset code. Please request a new one.")

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This reset code has expired. Please request a new one.")

    if body.code.strip() != stored_code:
        raise HTTPException(status_code=400, detail="Invalid reset code.")

    users_collection.update_one(
        {"email": email},
        {
            "$set": {"password": pwd_context.hash(new_password), "verified": True},
            "$unset": {"reset_otp_code": "", "reset_otp_expires_at": "", "reset_otp_last_sent_at": ""},
        },
    )
    return {"message": "Password reset successfully. You can now log in with your new password."}


class LogoutRequest(BaseModel):
    email: str

@router.post("/logout")
def logout_user(body: LogoutRequest):
    """Record logout timestamp for the user (called by frontend on logout)."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        users_collection.update_one(
            {"email": body.email},
            {
                "$set":  {"last_logout": now},
                "$push": {"login_history": {"action": "logout", "at": now}},
            },
        )
        return {"message": "Logged out"}
    except Exception as e:
        print(f"[Auth] Logout error: {e}")
        return {"message": "Logged out"}  # always succeed client-side