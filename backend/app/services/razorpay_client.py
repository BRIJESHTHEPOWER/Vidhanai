"""
Razorpay SDK client.

Reads test/live keys from the environment (never hardcoded). Provides a single
lazily-initialised razorpay.Client plus small config accessors used by the
subscriptions router and the one-time plan-creation script.

Required .env keys:
    RAZORPAY_KEY_ID            rzp_test_xxx / rzp_live_xxx
    RAZORPAY_KEY_SECRET        the matching key secret
    RAZORPAY_PLAN_ID_MONTHLY   plan_xxx for the monthly Pro plan
    RAZORPAY_PLAN_ID_ANNUAL    plan_xxx for the annual Pro plan (optional)
    RAZORPAY_WEBHOOK_SECRET    the signing secret you set in the dashboard webhook

Plan ids are created via scripts/create_razorpay_plan.py. A legacy single
RAZORPAY_PLAN_ID is still honoured as a fallback for the monthly plan.
"""
import os

import razorpay

_client = None


def get_key_id() -> str:
    key_id = os.getenv("RAZORPAY_KEY_ID")
    if not key_id:
        raise RuntimeError("RAZORPAY_KEY_ID is not set in the environment / .env file.")
    # TEST MODE ONLY — refuse anything that is not a test key. No live-mode handling.
    if not key_id.startswith("rzp_test_"):
        raise RuntimeError(
            "RAZORPAY_KEY_ID must be a TEST key (starts with 'rzp_test_'). "
            "Live-mode keys are not supported yet."
        )
    return key_id


def is_test_mode() -> bool:
    """True when running against Razorpay test keys. Currently always True by
    design — get_key_id() rejects non-test keys."""
    return (os.getenv("RAZORPAY_KEY_ID") or "").startswith("rzp_test_")


def get_key_secret() -> str:
    secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not secret:
        raise RuntimeError("RAZORPAY_KEY_SECRET is not set in the environment / .env file.")
    return secret


def get_plan_id(period: str = "monthly") -> str:
    """Return the Razorpay plan id for the chosen billing period.

    period: "monthly" (default) or "annual". Reads RAZORPAY_PLAN_ID_MONTHLY /
    RAZORPAY_PLAN_ID_ANNUAL, falling back to the legacy single RAZORPAY_PLAN_ID
    for the monthly plan so older .env files keep working."""
    period = (period or "monthly").strip().lower()

    if period == "annual":
        plan_id = os.getenv("RAZORPAY_PLAN_ID_ANNUAL")
        if not plan_id:
            raise RuntimeError(
                "RAZORPAY_PLAN_ID_ANNUAL is not set. Run "
                "scripts/create_razorpay_plan.py --period yearly and paste the "
                "printed plan_id into your .env file."
            )
        return plan_id

    # monthly (default)
    plan_id = os.getenv("RAZORPAY_PLAN_ID_MONTHLY") or os.getenv("RAZORPAY_PLAN_ID")
    if not plan_id:
        raise RuntimeError(
            "RAZORPAY_PLAN_ID_MONTHLY is not set. Run "
            "scripts/create_razorpay_plan.py and paste the printed plan_id into "
            "your .env file (as RAZORPAY_PLAN_ID_MONTHLY)."
        )
    return plan_id


def get_webhook_secret() -> str:
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    if not secret:
        raise RuntimeError("RAZORPAY_WEBHOOK_SECRET is not set in the environment / .env file.")
    return secret


def get_client() -> "razorpay.Client":
    """Return a process-wide Razorpay client, building it on first use."""
    global _client
    if _client is None:
        _client = razorpay.Client(auth=(get_key_id(), get_key_secret()))
        _client.set_app_details({"title": "Vidhan.ai", "version": "1.0.0"})
    return _client
