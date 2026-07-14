"""
Local test helper: simulate a Razorpay subscription webhook against the running
backend so you can verify Pro activation WITHOUT a public tunnel (ngrok).

It builds a real `subscription.charged` (or `.activated` / `.halted` /
`.cancelled`) event, signs it with RAZORPAY_WEBHOOK_SECRET exactly like Razorpay
does (HMAC-SHA256), and POSTs it to /api/webhook/razorpay. The server verifies
the signature and — for a paid event — flips the owning user's plan to "pro".

The subscription must already exist in the `subscriptions` collection, i.e. the
user (or the UI) has called POST /api/subscribe. Pass that subscription id.

Usage (from backend/, venv active, backend running on :8000):
    # 1. create a subscription first (via the Pricing page, or):
    #    curl -X POST :8000/api/subscribe -H "Authorization: Bearer <token>" -d '{"plan":"monthly"}'
    # 2. then simulate the payment webhook for it:
    python scripts/simulate_webhook.py --subscription-id sub_XXXXXXXX
    python scripts/simulate_webhook.py --subscription-id sub_XXXXXXXX --event subscription.cancelled
"""
import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request

from dotenv import load_dotenv

_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))

# Import the subscriptions collection so we can look up the owner and report the
# resulting plan_status.
sys.path.insert(0, os.path.join(_HERE, ".."))
from app.db.connection import subscriptions_collection, users_collection  # noqa: E402

BACKEND = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
WEBHOOK_PATH = "/api/webhook/razorpay"


def build_event(event_type: str, sub_id: str, customer_id: str) -> dict:
    now = int(time.time())
    entity = {
        "id": sub_id,
        "entity": "subscription",
        "status": "active" if event_type in (
            "subscription.activated", "subscription.charged") else "cancelled",
        "customer_id": customer_id,
        "current_end": now + 30 * 24 * 3600,  # ~30 days out
    }
    payload = {"subscription": {"entity": entity}}
    if event_type == "subscription.charged":
        payload["payment"] = {"entity": {
            "id": f"pay_TEST{now}",
            "entity": "payment",
            "invoice_id": f"inv_TEST{now}",
            "amount": 29900,
            "status": "captured",
        }}
    return {"entity": "event", "event": event_type, "payload": payload,
            "created_at": now}


def main() -> None:
    parser = argparse.ArgumentParser(description="Simulate a Razorpay webhook locally.")
    parser.add_argument("--subscription-id", required=True,
                        help="sub_xxx that already exists (call /api/subscribe first).")
    parser.add_argument("--event", default="subscription.charged",
                        choices=["subscription.charged", "subscription.activated",
                                 "subscription.halted", "subscription.cancelled"],
                        help="Event type to send. Default: subscription.charged (grants Pro).")
    args = parser.parse_args()

    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")
    if not secret:
        sys.exit("[ERROR] RAZORPAY_WEBHOOK_SECRET is empty in backend/.env. Set it first.")

    doc = subscriptions_collection.find_one(
        {"razorpay_subscription_id": args.subscription_id})
    if not doc:
        sys.exit(f"[ERROR] No subscription record for {args.subscription_id}. "
                 "Call POST /api/subscribe first (via the Pricing page or curl).")
    owner = doc.get("user_email")
    customer_id = doc.get("razorpay_customer_id") or "cust_TEST"
    print(f"Subscription {args.subscription_id} owned by: {owner}")

    event = build_event(args.event, args.subscription_id, customer_id)
    raw = json.dumps(event, separators=(",", ":")).encode("utf-8")
    signature = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()

    req = urllib.request.Request(
        BACKEND + WEBHOOK_PATH, method="POST", data=raw,
        headers={"Content-Type": "application/json",
                 "X-Razorpay-Signature": signature})
    print(f"POST {BACKEND}{WEBHOOK_PATH}  event={args.event}")
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        print("  ->", resp.status, resp.read().decode(errors="replace"))
    except urllib.error.HTTPError as e:
        print("  ->", e.code, e.read().decode(errors="replace"))
        sys.exit("[FAIL] Webhook rejected. Is the backend running with the SAME "
                 "RAZORPAY_WEBHOOK_SECRET it was started with?")

    if owner:
        u = users_collection.find_one({"email": owner}, {"plan_status": 1}) or {}
        print(f"\nUser {owner} plan_status is now: {u.get('plan_status')!r}")


if __name__ == "__main__":
    main()
