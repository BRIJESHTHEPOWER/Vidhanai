"""
One-time script: create the Razorpay monthly Plan for the Vidhan.ai Pro tier.

Run ONCE (test mode), then paste the printed plan_id into backend/.env as
RAZORPAY_PLAN_ID. Re-running creates a brand new plan each time.

Usage (from the backend/ directory, with your venv active):
    python scripts/create_razorpay_plan.py                      # ₹299 / month (default)
    python scripts/create_razorpay_plan.py --period yearly      # ₹2388 / year (annual)
    python scripts/create_razorpay_plan.py --amount-paise 100   # ₹1 for cheap testing

Requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.
"""
import argparse
import os
import sys

from dotenv import load_dotenv
import razorpay

# Windows consoles default to cp1252, which can't encode "₹". Force UTF-8 so the
# script prints cleanly everywhere.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# Load backend/.env regardless of where the script is invoked from.
_HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_HERE, "..", ".env"))

# Defaults match the Pro card on the Pricing page.
DEFAULT_MONTHLY_PAISE = 29900   # ₹299.00 / month
DEFAULT_ANNUAL_PAISE  = 238800  # ₹2388.00 / year (₹199/mo billed annually)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a Razorpay plan for the Pro tier.")
    parser.add_argument("--period", choices=["monthly", "yearly"], default="monthly",
                        help="Billing period. 'monthly' (default) or 'yearly' (annual).")
    parser.add_argument("--amount-paise", type=int, default=None,
                        help="Amount in paise. Defaults to ₹299/mo or ₹2388/yr for the period.")
    parser.add_argument("--name", default=None,
                        help="Plan/item display name.")
    args = parser.parse_args()

    is_annual = args.period == "yearly"
    amount = args.amount_paise if args.amount_paise is not None else (
        DEFAULT_ANNUAL_PAISE if is_annual else DEFAULT_MONTHLY_PAISE)
    name = args.name or f"Vidhan.ai Pro ({'Annual' if is_annual else 'Monthly'})"
    env_var = "RAZORPAY_PLAN_ID_ANNUAL" if is_annual else "RAZORPAY_PLAN_ID_MONTHLY"
    unit = "year" if is_annual else "month"

    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        sys.exit("[ERROR] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing in backend/.env")

    client = razorpay.Client(auth=(key_id, key_secret))

    rupees = amount / 100
    print(f"Creating {args.period} plan '{name}' at ₹{rupees:.2f} ({amount} paise)...")

    plan = client.plan.create({
        "period": args.period,
        "interval": 1,
        "item": {
            "name": name,
            "amount": amount,
            "currency": "INR",
            "description": "Unlimited AI legal questions, all languages, tutor, quizzes & comics.",
        },
        "notes": {"tier": "pro", "app": "vidhan.ai", "period": args.period},
    })

    print("\n[OK] Plan created.")
    print(f"     plan_id : {plan['id']}")
    print(f"     amount  : ₹{rupees:.2f} / {unit}")
    print("\nNext step -> add this line to backend/.env :")
    print(f"     {env_var}={plan['id']}")


if __name__ == "__main__":
    main()
