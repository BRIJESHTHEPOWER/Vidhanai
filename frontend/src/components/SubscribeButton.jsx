import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './SubscribeButton.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/* Inject checkout.js once and resolve when it's ready. */
function loadCheckoutScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => reject(new Error('checkout.js failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('checkout.js failed to load'));
    document.body.appendChild(script);
  });
}

/**
 * "Subscribe to Pro" button (TEST MODE).
 *
 * On success it verifies the checkout signature (UI feedback only) and then
 * navigates to /subscribe/success, which polls plan-status until the WEBHOOK
 * confirms Pro. Access is never granted from this client handler.
 *
 * Props:
 *   className - extra classes (e.g. reuse the page's CTA styles)
 *   children  - button label (defaults to "Subscribe to Pro")
 *   plan      - billing period: "monthly" (default) or "annual"
 */
export default function SubscribeButton({ className = '', children, plan = 'monthly' }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsPhone, setNeedsPhone] = useState(false);

  const handleClick = useCallback(async () => {
    setError('');
    setNeedsPhone(false);
    const token = localStorage.getItem('vidhan_token');
    if (!token) {
      navigate('/login');
      return;
    }

    setBusy(true);
    try {
      await loadCheckoutScript();

      // 1. Create the subscription (for the chosen billing period).
      const createRes = await fetch(`${BASE_URL}/api/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        // `detail` is a plain string for simple errors, or {error, message} for
        // the ones the UI reacts to (phone_required / phone_in_use).
        const detail = data.detail;
        const structured = detail && typeof detail === 'object' ? detail : null;
        if (structured?.error === 'phone_required') setNeedsPhone(true);
        throw new Error(
          structured?.message || (typeof detail === 'string' && detail) ||
          'Could not start the subscription.',
        );
      }
      const { subscription_id, key_id, prefill } = await createRes.json();

      // 2. Open Razorpay test checkout.
      //    Identity comes from the server (the JWT user), not localStorage.
      //    Passing contact explicitly stops Checkout falling back to a phone
      //    number it remembered from an earlier, unrelated session in this
      //    browser. Email is locked because Pro is granted to the logged-in
      //    account regardless of what's typed here — letting it be edited only
      //    creates the illusion that another account is being upgraded.
      const rzp = new window.Razorpay({
        key: key_id,
        subscription_id,
        name: 'Vidhan.ai',
        description: `Pro ${plan === 'annual' ? 'Annual' : 'Monthly'} — TEST MODE · simulated payment, no real money is charged`,
        prefill: {
          name: prefill?.name || '',
          email: prefill?.email || localStorage.getItem('vidhan_email') || '',
          contact: prefill?.contact || '',
        },
        readonly: { email: true },
        theme: { color: '#6d28d9' },
        handler: async (response) => {
          // 3. Verify signature (UI feedback only — does NOT grant Pro).
          try {
            const verifyRes = await fetch(`${BASE_URL}/api/verify-subscription`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const data = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) throw new Error(data.detail || 'Verification failed.');
            // 4. Go to the confirmation screen; it waits for the webhook.
            navigate(`/subscribe/success?subscription_id=${response.razorpay_subscription_id}`);
          } catch (err) {
            setError(err.message || 'Verification failed.');
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      rzp.on('payment.failed', (resp) => {
        setError(resp?.error?.description || 'Payment failed. Please try again.');
        setBusy(false);
      });

      rzp.open();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setBusy(false);
    }
  }, [navigate, plan]);

  return (
    <div className="subscribe-wrap">
      <button
        type="button"
        className={`subscribe-btn ${className}`}
        onClick={handleClick}
        disabled={busy}
      >
        {busy ? 'Opening checkout…' : (children || 'Subscribe to Pro')}
      </button>
      <span className="subscribe-testmode" title="This is a sandbox. Razorpay simulates the payment — no real money is charged and no bank/UPI is debited.">
        🧪 TEST MODE — simulated payment, no real money is charged
      </span>
      {error && (
        <p className="subscribe-btn-error" role="alert">
          {error}
          {needsPhone && (
            <button
              type="button"
              className="subscribe-btn-link"
              onClick={() => navigate('/profile')}
            >
              Add phone number
            </button>
          )}
        </p>
      )}
    </div>
  );
}
