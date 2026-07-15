"""
Razorpay Subscriptions (TEST MODE) for the Vidhan.ai Pro plan — UPI Autopay + card.

Flow
----
1. POST /api/subscribe            (Bearer) -> create a test subscription, return
                                    { subscription_id, key_id, is_test_mode }.
2. checkout.js completes -> POST /api/verify-subscription (Bearer)
                                    -> verify checkout HMAC, then RECONCILE:
                                       ask the Razorpay API for the real status
                                       and grant Pro if it is authenticated/active.
3. POST /api/webhook/razorpay      (Razorpay signature) -> lifecycle source of truth.
       subscription.activated / charged  -> users.plan_status = "pro"
       subscription.halted / cancelled   -> users.plan_status = "free" (downgrade)
4. GET  /api/user/plan-status      (Bearer) -> current plan for gating.
5. POST /api/subscription/reconcile/{sub_id} (Bearer) -> re-pull status from
                                    Razorpay; the fallback when no webhook lands.
6. GET  /api/subscription/invoice/{sub_id} (Bearer) -> latest invoice + short_url.

Security: Pro is never granted from data the browser sends. It is granted either
by a signature-verified webhook, or by fetching the subscription straight from
the Razorpay API with our secret key. The checkout HMAC is verified too, but it
only decides whether we bother to reconcile.

Why reconcile exists: webhooks need a public URL. On localhost (no ngrok), or if
a delivery is dropped/retried late, the webhook never lands and the user is stuck
on "Processing" forever despite having paid. Reconciliation closes that gap.

TEST MODE ONLY — razorpay_client rejects non-`rzp_test_` keys.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from app.db.connection import subscriptions_collection, users_collection
from app.routers import get_current_user_email
from app.services.razorpay_client import (
    get_client, get_plan_id, get_key_id, get_webhook_secret, is_test_mode,
)

router = APIRouter(prefix="/api", tags=["Subscriptions"])

# Billing cycles the mandate authorises before renewal, per period.
# Monthly: 12 cycles = 1 year. Annual: 5 cycles = 5 years.
_TOTAL_COUNT = {"monthly": 12, "annual": 5}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else None


def _set_user_plan(user_email: str, plan_status: str, **extra) -> None:
    """Update the fast-gate fields on the user document."""
    fields = {"plan_status": plan_status, "plan_updated_at": _now()}
    fields.update({k: v for k, v in extra.items() if v is not None})
    users_collection.update_one({"email": user_email}, {"$set": fields})


# Razorpay subscription statuses, grouped by what they mean for our gate.
# "authenticated" = mandate registered and the first payment went through at
# checkout; "active" = billing cycle running. Both mean the user has paid.
_PAID_STATUSES = {"authenticated", "active"}
# Terminal/failed states that must revoke Pro. "pending" is deliberately absent:
# it means a renewal charge failed and Razorpay is still retrying, so the user
# keeps access until it becomes "halted".
_DEAD_STATUSES = {"halted", "cancelled", "expired", "completed"}


def _require(fn):
    """Call a razorpay_client config accessor, converting missing-config
    RuntimeErrors into a clean HTTP 503. This keeps the response inside the
    CORS/exception middleware (an uncaught RuntimeError becomes a 500 that
    bypasses CORS and shows up in the browser as a misleading CORS error)."""
    try:
        return fn()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── Request models ────────────────────────────────────────────────────────────
class SubscribePayload(BaseModel):
    # Billing period chosen on the Pricing page toggle. Defaults to monthly.
    plan: str = "monthly"


class VerifyPayload(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


# ── 1. Create subscription ────────────────────────────────────────────────────
@router.post("/subscribe")
async def subscribe(
    payload: SubscribePayload | None = None,
    user_email: str = Depends(get_current_user_email),
):
    """Create a Razorpay test subscription for the current user and return the
    id checkout.js needs. Honours the monthly/annual billing period."""
    period = (payload.plan if payload else "monthly") or "monthly"
    period = period.strip().lower()
    if period not in _TOTAL_COUNT:
        period = "monthly"
    plan_id = _require(lambda: get_plan_id(period))
    client = _require(get_client)

    user = users_collection.find_one({"email": user_email})
    user_id = str(user["_id"]) if user else None

    if user and user.get("plan_status") == "pro":
        raise HTTPException(status_code=409, detail="You already have an active Pro subscription.")

    # A phone number is required to subscribe. Without one, Checkout falls back to
    # whichever number it remembered in this browser, and the mandate ends up
    # authorised against a number that has nothing to do with this account.
    phone = (user or {}).get("phone") or ""
    if not phone:
        raise HTTPException(status_code=400, detail={
            "error": "phone_required",
            "message": "Add your phone number in Profile before subscribing to Pro.",
        })

    # One number = one Pro subscription. Checked against plan_status rather than
    # the subscriptions collection so abandoned "created" records never block a
    # legitimate upgrade.
    taken_by = users_collection.find_one(
        {"phone": phone, "email": {"$ne": user_email}, "plan_status": "pro"},
        {"email": 1},
    )
    if taken_by:
        raise HTTPException(status_code=409, detail={
            "error": "phone_in_use",
            "message": (
                "This phone number already has an active Pro subscription on "
                "another account. Use a different number, or cancel the other "
                "subscription first."
            ),
        })

    try:
        sub = client.subscription.create({
            "plan_id": plan_id,
            "total_count": _TOTAL_COUNT[period],
            "customer_notify": 1,
            "notes": {"user_email": user_email, "user_id": user_id or "", "period": period},
        })
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Razorpay subscription creation failed: {e}")

    # Starting a new subscription clears any earlier cancellation, otherwise the
    # UI would show "won't renew" against a brand-new subscription.
    users_collection.update_one(
        {"email": user_email}, {"$unset": {"cancel_at_cycle_end": ""}}
    )

    now = _now()
    subscriptions_collection.update_one(
        {"razorpay_subscription_id": sub["id"]},
        {"$set": {
            "user_email":               user_email,
            "user_id":                  user_id,
            "razorpay_subscription_id": sub["id"],
            "razorpay_customer_id":     sub.get("customer_id"),
            "plan_id":                  plan_id,
            "period":                   period,
            "status":                   "created",
            "current_period_end":       None,
            "last_invoice_id":          None,
            "last_payment_id":          None,
            "short_url":                sub.get("short_url"),
            "is_test_mode":             is_test_mode(),
            "updated_at":               now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )

    return {
        "subscription_id": sub["id"],
        "key_id": _require(get_key_id),
        "is_test_mode": is_test_mode(),
        # Authoritative identity for checkout, taken from the JWT user — never
        # from localStorage. Without an explicit contact, Checkout falls back to
        # whichever number it remembered in this browser, which is how a stale
        # phone number ends up shown next to a different account's email.
        "prefill": {
            "name":    (user or {}).get("name") or "",
            "email":   user_email,
            "contact": (user or {}).get("phone") or "",
        },
    }


# ── 2. Verify checkout signature (UI feedback only) ───────────────────────────
@router.post("/verify-subscription")
async def verify_subscription(
    payload: VerifyPayload,
    user_email: str = Depends(get_current_user_email),
):
    """Verify the HMAC signature returned by checkout.js, then reconcile against
    the Razorpay API — which is what actually decides whether Pro is granted."""
    client = _require(get_client)
    try:
        client.utility.verify_subscription_payment_signature({
            "razorpay_payment_id":      payload.razorpay_payment_id,
            "razorpay_subscription_id": payload.razorpay_subscription_id,
            "razorpay_signature":       payload.razorpay_signature,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    doc = subscriptions_collection.find_one(
        {"razorpay_subscription_id": payload.razorpay_subscription_id}
    )
    if not doc or doc.get("user_email") != user_email:
        raise HTTPException(status_code=404, detail="Subscription not found for this user.")

    subscriptions_collection.update_one(
        {"razorpay_subscription_id": payload.razorpay_subscription_id},
        {"$set": {
            "last_payment_id": payload.razorpay_payment_id,
            "signature_verified": True,
            "updated_at": _now(),
        }},
    )

    # The signature proves the browser isn't lying; this call is what grants Pro.
    result = _reconcile(payload.razorpay_subscription_id, user_email)
    return {
        "status": "verified",
        "plan_status": result["plan_status"],
        "subscription_status": result["subscription_status"],
        "message": (
            "Payment verified — Pro is active."
            if result["plan_status"] == "pro"
            else "Payment authenticated. Pro activates once Razorpay confirms the charge."
        ),
    }


def _reconcile(sub_id: str, user_email: str) -> dict:
    """Ask the Razorpay API what `sub_id` actually is, and sync our records.

    This is the non-webhook grant path. It is safe because the answer comes from
    Razorpay over an authenticated API call with our secret key — the browser
    cannot influence it. Returns {plan_status, subscription_status}.
    """
    client = _require(get_client)
    try:
        sub = client.subscription.fetch(sub_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch subscription: {e}")

    status = sub.get("status") or "created"

    sub_update = {"status": status, "updated_at": _now()}
    if sub.get("customer_id"):
        sub_update["razorpay_customer_id"] = sub["customer_id"]

    period_end = None
    if sub.get("current_end"):
        period_end = datetime.fromtimestamp(sub["current_end"], tz=timezone.utc)
        sub_update["current_period_end"] = period_end

    subscriptions_collection.update_one(
        {"razorpay_subscription_id": sub_id}, {"$set": sub_update}
    )

    if status in _PAID_STATUSES:
        plan_status = "pro"
    elif status in _DEAD_STATUSES:
        # Only let a dead subscription revoke Pro if it is the one the user is
        # actually on. A user can have older cancelled subscriptions alongside a
        # live one; reconciling a stale id must not strip their access.
        current = (users_collection.find_one(
            {"email": user_email}, {"razorpay_subscription_id": 1}
        ) or {}).get("razorpay_subscription_id")
        if current and current != sub_id:
            return {"plan_status": "pro", "subscription_status": status}
        plan_status = "free"
    else:
        # created / pending — nothing decided yet, leave the gate untouched.
        user = users_collection.find_one({"email": user_email}, {"plan_status": 1}) or {}
        return {"plan_status": user.get("plan_status", "free"),
                "subscription_status": status}

    _set_user_plan(
        user_email,
        plan_status,
        razorpay_subscription_id=sub_id,
        razorpay_customer_id=sub.get("customer_id"),
        current_period_end=period_end,
        is_test_mode=is_test_mode(),
    )
    return {"plan_status": plan_status, "subscription_status": status}


# ── 3. Webhook — SOURCE OF TRUTH ──────────────────────────────────────────────
# Maps event -> (subscription status, user plan_status)
_EVENT_MAP = {
    "subscription.activated": ("active",    "pro"),
    "subscription.charged":   ("active",    "pro"),
    "subscription.halted":    ("halted",    "free"),
    "subscription.cancelled": ("cancelled", "free"),
}


@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request):
    """Handle Razorpay subscription webhooks. The raw-body signature is verified
    before anything is trusted. Along with _reconcile() this is one of the two
    server-side paths allowed to change plan_status; it is the only one that sees
    renewals and cancellations, which nobody is on-screen for."""
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")

    client = _require(get_client)
    webhook_secret = _require(get_webhook_secret)
    try:
        client.utility.verify_webhook_signature(
            raw_body.decode("utf-8"), signature, webhook_secret
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    event = json.loads(raw_body)
    event_type = event.get("event")

    mapped = _EVENT_MAP.get(event_type)
    if not mapped:
        # e.g. subscription.authenticated / pending — ack so Razorpay stops retrying.
        return {"status": "ignored", "event": event_type}

    sub_status, plan_status = mapped
    sub_entity = (event.get("payload", {}).get("subscription", {}) or {}).get("entity", {}) or {}
    sub_id = sub_entity.get("id")
    if not sub_id:
        raise HTTPException(status_code=400, detail="Webhook missing subscription id.")

    # Update the subscription record.
    sub_update = {"status": sub_status, "updated_at": _now()}
    customer_id = sub_entity.get("customer_id")
    if customer_id:
        sub_update["razorpay_customer_id"] = customer_id

    current_end = sub_entity.get("current_end")
    period_end = None
    if current_end:
        period_end = datetime.fromtimestamp(current_end, tz=timezone.utc)
        sub_update["current_period_end"] = period_end

    last_invoice_id = None
    last_payment_id = None
    if event_type == "subscription.charged":
        pay_entity = (event.get("payload", {}).get("payment", {}) or {}).get("entity", {}) or {}
        last_payment_id = pay_entity.get("id")
        last_invoice_id = pay_entity.get("invoice_id")
        if last_payment_id:
            sub_update["last_payment_id"] = last_payment_id
        if last_invoice_id:
            sub_update["last_invoice_id"] = last_invoice_id

    subscriptions_collection.update_one(
        {"razorpay_subscription_id": sub_id}, {"$set": sub_update}
    )

    # Update the user's plan_status (the gate). Find the owning user via our record.
    doc = subscriptions_collection.find_one({"razorpay_subscription_id": sub_id})
    user_email = (doc or {}).get("user_email")
    if user_email:
        _set_user_plan(
            user_email,
            plan_status,
            razorpay_subscription_id=sub_id,
            razorpay_customer_id=customer_id,
            current_period_end=period_end,
            last_invoice_id=last_invoice_id,
            is_test_mode=is_test_mode(),
        )

    return {"status": "ok", "event": event_type, "plan_status": plan_status}


# ── 4. Plan status (gate) ─────────────────────────────────────────────────────
@router.get("/user/plan-status")
async def plan_status(user_email: str = Depends(get_current_user_email)):
    """Return the user's current plan. `plan_status` defaults to 'free' when unset."""
    from app.services.plan_gate import question_usage

    user = users_collection.find_one({"email": user_email}) or {}
    status = user.get("plan_status", "free")
    return {
        "plan_status":        status,
        "is_pro":             status == "pro",
        "usage":              question_usage(user_email),
        "current_period_end": _iso(user.get("current_period_end")),
        "last_invoice_id":    user.get("last_invoice_id"),
        "razorpay_subscription_id": user.get("razorpay_subscription_id"),
        # True once cancelled: still Pro, but won't renew at period end.
        "cancel_at_cycle_end": bool(user.get("cancel_at_cycle_end")),
        "is_test_mode":       user.get("is_test_mode", is_test_mode()),
    }


# ── 5. Reconcile (webhook fallback) ───────────────────────────────────────────
@router.post("/subscription/reconcile/{subscription_id}")
async def reconcile_subscription(
    subscription_id: str,
    user_email: str = Depends(get_current_user_email),
):
    """Re-pull a subscription's status from Razorpay and sync the gate.

    Used by the post-checkout screen when the webhook hasn't landed (no public
    tunnel in local dev, a dropped delivery, or Razorpay retrying late), so a
    paid user is never stuck on "Processing"."""
    doc = subscriptions_collection.find_one(
        {"razorpay_subscription_id": subscription_id}
    )
    if not doc or doc.get("user_email") != user_email:
        raise HTTPException(status_code=404, detail="Subscription not found for this user.")

    result = _reconcile(subscription_id, user_email)
    return {**result, "is_pro": result["plan_status"] == "pro"}


# ── 6. Cancel ─────────────────────────────────────────────────────────────────
@router.post("/subscription/cancel")
async def cancel_subscription(user_email: str = Depends(get_current_user_email)):
    """Cancel the user's subscription at the END of the paid billing cycle.

    No refund is issued, so the user keeps Pro for the period they already paid
    for and simply isn't billed again. Cancelling immediately instead would take
    the money and remove access the same second.

    plan_status stays "pro" here on purpose — it flips to "free" when Razorpay
    sends subscription.cancelled at the cycle end (or when _reconcile next sees
    the cancelled status), so access ends exactly when the paid period does.
    """
    user = users_collection.find_one({"email": user_email}) or {}
    sub_id = user.get("razorpay_subscription_id")
    if not sub_id or user.get("plan_status") != "pro":
        raise HTTPException(status_code=404, detail="You don't have an active subscription.")

    client = _require(get_client)
    try:
        sub = client.subscription.cancel(sub_id, {"cancel_at_cycle_end": 1})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not cancel the subscription: {e}")

    # Prefer Razorpay's own end date over anything we cached.
    end_ts = sub.get("current_end") or sub.get("end_at")
    access_until = datetime.fromtimestamp(end_ts, tz=timezone.utc) if end_ts else None

    now = _now()
    subscriptions_collection.update_one(
        {"razorpay_subscription_id": sub_id},
        {"$set": {
            "status": sub.get("status") or "active",
            "cancel_at_cycle_end": True,
            "cancelled_requested_at": now,
            **({"current_period_end": access_until} if access_until else {}),
            "updated_at": now,
        }},
    )
    users_collection.update_one(
        {"email": user_email},
        {"$set": {
            "cancel_at_cycle_end": True,
            **({"current_period_end": access_until} if access_until else {}),
        }},
    )

    return {
        "status": "cancelled",
        "subscription_status": sub.get("status"),
        "access_until": _iso(access_until),
        "refund_issued": False,
        "message": (
            "Your subscription is cancelled and won't renew. You'll keep Pro "
            "until the end of your current billing period."
        ),
    }


# ── 7. Invoice ────────────────────────────────────────────────────────────────
@router.get("/subscription/invoice/{subscription_id}")
async def get_invoice(
    subscription_id: str,
    user_email: str = Depends(get_current_user_email),
):
    """Fetch the latest invoice (details + hosted short_url) for the user's
    subscription from the Razorpay API."""
    doc = subscriptions_collection.find_one(
        {"razorpay_subscription_id": subscription_id}
    )
    if not doc or doc.get("user_email") != user_email:
        raise HTTPException(status_code=404, detail="Subscription not found for this user.")

    client = _require(get_client)
    try:
        invoices = client.invoice.all({"subscription_id": subscription_id})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch invoices: {e}")

    items = invoices.get("items", []) if isinstance(invoices, dict) else []
    if not items:
        return {"invoice": None, "message": "No invoice generated yet."}

    # Most recent first.
    inv = sorted(items, key=lambda i: i.get("created_at", 0), reverse=True)[0]
    return {
        "invoice": {
            "id":         inv.get("id"),
            "status":     inv.get("status"),
            "amount":     inv.get("amount"),
            "currency":   inv.get("currency"),
            "short_url":  inv.get("short_url"),
            "invoice_number": inv.get("invoice_number"),
            "issued_at":  _iso(datetime.fromtimestamp(inv["issued_at"], tz=timezone.utc))
                          if inv.get("issued_at") else None,
        },
        "is_test_mode": is_test_mode(),
    }
