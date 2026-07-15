# Razorpay Subscriptions — TEST MODE Setup & Local Testing

UPI Autopay + card subscriptions for the Vidhan.ai **Pro** plan. **Test mode only** —
the backend refuses any key that isn't `rzp_test_...`, and no real money is ever charged.

## What was added

**Backend**
- `app/services/razorpay_client.py` — SDK client, **test-key guard**, `is_test_mode()`
- `app/routers/subscriptions.py` — `/api/*` routes (registered in `app/main.py`)
- `app/routers/__init__.py` — `get_current_user_email` (required-auth) dependency
- `app/db/connection.py` — `subscriptions_collection`
- `scripts/create_razorpay_plan.py` — one-time plan creator
- `requirements.txt` — `razorpay`;  `.env` — `RAZORPAY_*` keys

**Frontend**
- `src/components/SubscribeButton.jsx` (+ `.css`) — checkout + **🧪 TEST MODE badge**
- `src/pages/SubscribeSuccess.jsx` (+ `.css`) — confirmation screen, polls until webhook confirms, shows invoice link
- `src/components/ProRoute.jsx` — Pro-only route wrapper (mirrors `ProtectedRoute`)
- `src/hooks/usePlanStatus.js` — shared plan-status fetch
- `src/pages/ProDemo.jsx` — demo Pro-gated page at `/pro`
- `src/App.jsx` — routes `/subscribe/success` and `/pro`
- `src/pages/Pricing.jsx` — Pro CTA uses `SubscribeButton`

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/subscribe` | Bearer | Create test subscription → `{ subscription_id, key_id, is_test_mode }` |
| POST | `/api/verify-subscription` | Bearer | Verify checkout HMAC. **UI feedback only — grants nothing** |
| POST | `/api/webhook/razorpay` | Razorpay sig | **SOURCE OF TRUTH.** `activated`/`charged` → `pro`; `halted`/`cancelled` → `free` |
| GET  | `/api/user/plan-status` | Bearer | `{ plan_status, is_pro, current_period_end, last_invoice_id, is_test_mode }` |
| GET  | `/api/subscription/invoice/{subscription_id}` | Bearer | Latest invoice details + hosted `short_url` |

**Pro access is granted only by the webhook**, never by the client handler. Both the
checkout signature and the webhook signature are verified.

## MongoDB

**`users` doc** gains the fast-gate fields (missing `plan_status` = `"free"`):
```jsonc
plan_status: "free" | "pro",
razorpay_subscription_id, razorpay_customer_id,
current_period_end, last_invoice_id,
is_test_mode: true, plan_updated_at
```
**`subscriptions` collection** keeps the full audit record (status, invoice/payment ids,
short_url, timestamps). The webhook writes both.

---

## localhost vs ngrok — what needs what

| Step | Works on plain localhost | Needs ngrok |
|---|---|---|
| `POST /api/subscribe` | ✅ | |
| Razorpay checkout.js (UPI test VPA) | ✅ | |
| `POST /api/verify-subscription` | ✅ | |
| `GET /api/subscription/invoice/...` | ✅ | |
| `GET /api/user/plan-status` | ✅ | |
| **Initial upgrade → grant Pro** | ✅ via reconcile | |
| **Renewals / cancellations / halts** | | ✅ **required** |

Pro is granted by whichever of these confirms the charge first:

1. **The webhook** (`POST /api/webhook/razorpay`) — Razorpay pushes to us. Needs a
   public URL, so on localhost it needs ngrok.
2. **Reconcile** (`POST /api/subscription/reconcile/{sub_id}`) — we pull the real
   status from the Razorpay API with our secret key. Works anywhere, no tunnel.
   The post-checkout screen calls this automatically.

Both are server-side and equally trustworthy; Pro is never granted from browser data.

> Reconcile means the **initial upgrade works without ngrok**. But nobody is on the
> success page when a renewal is charged or a mandate is cancelled months later —
> only the webhook catches those. So ngrok is still needed to test the full
> lifecycle locally, and a real webhook is **required in production**.

### ngrok is about the BACKEND, not the frontend

Webhooks travel Razorpay → your backend. Where the *frontend* runs (localhost,
Vercel, or `vidhanai.me`) is irrelevant to them.

| Backend runs on | Webhook URL to register |
|---|---|
| localhost:8000 (dev) | `https://<your>.ngrok-free.app/api/webhook/razorpay` |
| Render (prod) | `https://<your-render-host>/api/webhook/razorpay` |

Razorpay allows **multiple webhooks**, so register both and leave them both active —
the dev tunnel and production don't conflict.

> Tip: a free ngrok static domain avoids re-editing the dashboard on every restart:
> `ngrok http 8000 --domain=your-name.ngrok-free.app`

---

## 1. Get TEST keys
Razorpay Dashboard → **Test Mode** → **Settings → API Keys → Generate Test Key**.
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx      # must start with rzp_test_
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx
```

## 2. Install deps & create the plan
```bash
cd backend
venv/Scripts/python.exe -m pip install razorpay
venv/Scripts/python.exe scripts/create_razorpay_plan.py            # ₹299/mo
# cheap test amount:  ... scripts/create_razorpay_plan.py --amount-paise 100
```
Paste the printed id:
```
RAZORPAY_PLAN_ID=plan_xxxxxxxxxxxxx
```

## 3. Run backend + frontend
```bash
cd backend && uvicorn main:app --reload      # http://localhost:8000
cd frontend && npm run dev                    # http://localhost:5173
```

## 4. Expose the webhook with ngrok (for the full lifecycle)
Install once (`winget install ngrok`), add your authtoken from the ngrok dashboard
(`ngrok config add-authtoken <token>`), then:
```bash
ngrok http 8000
```
Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**:
- **URL**: `https://<random>.ngrok-free.app/api/webhook/razorpay`
- **Secret**: choose any string, put it in `.env` and **restart uvicorn**:
  ```
  RAZORPAY_WEBHOOK_SECRET=whsec_your_chosen_secret
  ```
- **Active Events** — tick exactly:
  `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`

> Restarting ngrok changes the URL — update it in the dashboard again, or claim a
> free static domain and pass `--domain=` so the URL never changes.

The same secret must be set on Render for the production webhook. If the secret in
`.env` doesn't match the dashboard, the signature check fails and the webhook is
rejected with a 400 — reconcile will still grant the initial upgrade, which can mask
a misconfigured webhook. Check the backend log for rejected webhooks.

**No tunnel handy?** `scripts/simulate_webhook.py --subscription-id sub_xxx` signs a
real event with your secret and POSTs it locally — the only way to exercise
`subscription.cancelled` / `.halted` without ngrok.

## 5. Test end-to-end (no real money)
1. Log in, open **Pricing**, click **Subscribe to Pro** (note the 🧪 TEST MODE badge).
2. In checkout pick **UPI** and enter a dummy VPA:
   - `success@razorpay` → mandate succeeds → `subscription.activated`/`charged` webhook → `plan_status = pro`
   - `failure@razorpay` → mandate fails
3. You land on **/subscribe/success** → "Processing…" → flips to **"You're Pro!"** with an invoice link once the webhook arrives.
4. Visit **/pro** — the `ProRoute`-gated demo page renders only for Pro users (others are redirected to /pricing).
5. Downgrade: from the dashboard cancel the subscription (or wait for `halted`) → webhook sets `plan_status = free`.

Quick check:
```bash
curl http://localhost:8000/api/user/plan-status -H "Authorization: Bearer <your_jwt>"
```

## Notes
- Mandate authorises 12 monthly cycles (`_TOTAL_COUNT` in `subscriptions.py`).
- `is_test_mode` is stored on every record so live-mode subscriptions stay distinguishable if you add live mode later.
- Never commit real keys — `backend/.env` is gitignored.
