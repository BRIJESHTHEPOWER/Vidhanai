"""
Redis Rate Limiter for Public Live Demo.

Requirements:
- Development mode (ENVIRONMENT != 'production'): Demo rate limit is disabled.
- Production mode (ENVIRONMENT == 'production'): Visitors are limited to 5 requests per 24 hours.
- Returns remaining request count.
- Blocks after 5 requests with message: "Demo limit reached. Please try again later."
- Does not expose any credentials or secrets.
"""

import os
import logging
from typing import Optional, Tuple
from fastapi import Request, HTTPException

logger = logging.getLogger("redis_limiter")

# ── Environment & Config ──────────────────────────────────────────────────────
ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("APP_ENV", "development")).strip().lower()
REDIS_URL   = os.getenv("REDIS_URL", "redis://localhost:6379/0").strip()
DEMO_RATE_LIMIT  = int(os.getenv("DEMO_RATE_LIMIT", "5"))
DEMO_RATE_WINDOW = int(os.getenv("DEMO_RATE_WINDOW", "86400"))  # 24 hours in seconds

_redis_client = None
_redis_initialized = False


def is_dev_mode() -> bool:
    """True if running in local development mode."""
    return ENVIRONMENT != "production"


def get_redis_client():
    """Lazily initializes and returns the Redis client instance."""
    global _redis_client, _redis_initialized
    if _redis_initialized:
        return _redis_client

    _redis_initialized = True
    try:
        import redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=3)
        # Quick ping test
        _redis_client.ping()
        logger.info(f"[Redis] Successfully connected to Redis at {REDIS_URL.split('@')[-1]}")
    except Exception as e:
        logger.warning(f"[Redis] Could not connect to Redis: {e}. Rate limiter will fallback gracefully.")
        _redis_client = None

    return _redis_client


def get_client_ip(request: Request) -> str:
    """
    Extracts client IP address safely, checking proxy headers first
    (X-Forwarded-For, CF-Connecting-IP, X-Real-IP) and falling back to client.host.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # First IP in comma-separated chain is the original client IP
        return forwarded.split(",")[0].strip()

    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host.strip()

    return "127.0.0.1"


def check_and_increment_demo_limit(client_ip: str, is_pro: bool = False) -> Tuple[bool, int, str]:
    """
    Checks if client IP is within the demo limit (5 requests / 24 hours).
    Returns (is_allowed, remaining_count, error_message).

    - In development mode (ENVIRONMENT != 'production'): returns (True, DEMO_RATE_LIMIT, "")
    - Pro users (is_pro=True): returns (True, DEMO_RATE_LIMIT, "")
    - In production mode: uses Redis to enforce 5 requests per 24 hours per IP.
    """
    # 1. Bypass restriction in development mode
    if is_dev_mode():
        return True, DEMO_RATE_LIMIT, ""

    # 2. Bypass restriction for Pro plan users
    if is_pro:
        return True, DEMO_RATE_LIMIT, ""

    # 3. Production mode: Check via Redis
    r = get_redis_client()
    if r is None:
        # Fallback if Redis is unavailable: log warning and allow request safely
        logger.warning("[Redis] Redis unavailable in production mode. Allowing request.")
        return True, DEMO_RATE_LIMIT, ""

    key = f"demo_rate_limit:{client_ip}"
    blocked_msg = "Demo limit reached. Please try again later."

    try:
        val = r.get(key)
        current_count = int(val) if val is not None else 0

        if current_count >= DEMO_RATE_LIMIT:
            return False, 0, blocked_msg

        # Increment count atomically
        new_count = r.incr(key)
        # Set 24h TTL on key creation
        if new_count == 1:
            r.expire(key, DEMO_RATE_WINDOW)

        remaining = max(0, DEMO_RATE_LIMIT - new_count)
        return True, remaining, ""

    except Exception as e:
        logger.error(f"[Redis] Error checking rate limit for {client_ip}: {e}")
        # In case of Redis operation failure, allow request gracefully
        return True, DEMO_RATE_LIMIT, ""


async def check_redis_demo_limit(request: Request) -> int:
    """
    FastAPI dependency that enforces Redis rate limiting before any paid or expensive API call.
    Raises HTTP 429 if the limit (5 requests / 24 hrs in production) has been reached.
    Attaches `demo_remaining` to `request.state`.
    """
    client_ip = get_client_ip(request)

    # Check if request carries a Pro user token
    is_pro = False
    try:
        from app.auth import get_current_user_email_optional
        user_email = get_current_user_email_optional(request)
        if user_email:
            from app.services.plan_gate import get_plan_status
            if get_plan_status(user_email) == "pro":
                is_pro = True
    except Exception:
        pass

    allowed, remaining, msg = check_and_increment_demo_limit(client_ip, is_pro=is_pro)

    # Store remaining count in request state for response headers/body
    request.state.demo_remaining = remaining

    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "demo_limit_reached",
                "message": msg,
                "remaining": 0,
                "limit": DEMO_RATE_LIMIT,
            }
        )

    return remaining
