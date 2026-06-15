from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import bcrypt
from app.db.connection import users_collection
import jwt
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

router = APIRouter(prefix="/auth", tags=["Authentication"])

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

class GoogleToken(BaseModel):
    token: str

class ProfileUpdate(BaseModel):
    email: str
    picture: str

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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
            "created_at": datetime.now(timezone.utc)
        }
        users_collection.insert_one(new_user)
        return {"message": "User registered successfully!"}
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
                "created_at": datetime.now(timezone.utc)
            })
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
    try:
        db_user = users_collection.find_one({"email": req.email})
    except Exception as e:
        print(f"[Auth] Forgot-password DB error: {e}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable.")

    if not db_user:
        raise HTTPException(status_code=404, detail="Email not found in our system.")

    return {"message": "Password reset instructions have been dispatched to your email."}


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