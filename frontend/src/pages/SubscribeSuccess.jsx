import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './SubscribeSuccess.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;
// Re-ask Razorpay directly every Nth poll. The webhook usually wins the race;
// this is the fallback for when it never arrives (no public tunnel in local dev,
// or a dropped delivery), so a paid user is never stuck on "Processing".
const RECONCILE_EVERY = 3;

/**
 * Post-payment confirmation screen.
 * Polls /api/user/plan-status until the user is Pro — granted either by the
 * webhook or by reconciling against the Razorpay API — then shows the invoice.
 */
export default function SubscribeSuccess() {
  const [params] = useSearchParams();
  const subscriptionId = params.get('subscription_id');

  const [phase, setPhase] = useState('processing'); // processing | confirmed | timeout | error
  const [invoice, setInvoice] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('vidhan_token');
    if (!token) {
      setPhase('error');
      return;
    }

    const start = Date.now();
    let cancelled = false;

    async function fetchInvoice() {
      if (!subscriptionId) return;
      try {
        const res = await fetch(
          `${BASE_URL}/api/subscription/invoice/${subscriptionId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setInvoice(data.invoice || null);
        }
      } catch { /* invoice is best-effort */ }
    }

    /* Ask the backend to re-pull the real status from Razorpay. */
    async function reconcile() {
      if (!subscriptionId) return false;
      try {
        const res = await fetch(
          `${BASE_URL}/api/subscription/reconcile/${subscriptionId}`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.is_pro;
      } catch {
        return false;
      }
    }

    function confirm() {
      if (cancelled) return;
      setPhase('confirmed');
      // Tell the navbar to re-read the plan so the PRO badge appears now,
      // rather than only after the next full page load.
      window.dispatchEvent(new Event('vidhan_plan_updated'));
      fetchInvoice();
    }

    let attempt = 0;
    async function poll() {
      if (cancelled) return;
      attempt += 1;

      try {
        const res = await fetch(`${BASE_URL}/api/user/plan-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.is_pro) return confirm();
      } catch { /* keep polling */ }

      // Webhook hasn't landed yet — go ask Razorpay ourselves.
      if (attempt === 1 || attempt % RECONCILE_EVERY === 0) {
        if (await reconcile()) return confirm();
      }

      if (Date.now() - start > POLL_TIMEOUT_MS) {
        if (!cancelled) setPhase('timeout');
        return;
      }
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [subscriptionId]);

  return (
    <div className="subsuccess-root">
      <Navbar />
      <main className="subsuccess-main">
        <div className="subsuccess-card">
          {phase === 'processing' && (
            <>
              <div className="subsuccess-spinner" aria-hidden="true" />
              <h1 className="subsuccess-title">Confirming your payment…</h1>
              <p className="subsuccess-text">
                We’re confirming your payment with Razorpay and activating Pro.
                This usually takes just a few seconds.
              </p>
            </>
          )}

          {phase === 'confirmed' && (
            <>
              <div className="subsuccess-check" aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="subsuccess-title">Welcome to Pro 🎉</h1>
              <p className="subsuccess-text">
                Your subscription is active and every Pro feature is unlocked.
                A receipt is on its way to your email.
              </p>

              {invoice ? (
                <a className="subsuccess-invoice" href={invoice.short_url}
                  target="_blank" rel="noreferrer">
                  View invoice{invoice.invoice_number ? ` #${invoice.invoice_number}` : ''}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17 17 7M8 7h9v9" />
                  </svg>
                </a>
              ) : (
                <p className="subsuccess-hint">Invoice link will appear here once generated.</p>
              )}

              <div className="subsuccess-actions">
                <Link to="/pro" className="subsuccess-btn subsuccess-btn--primary">Go to Pro features</Link>
                <Link to="/" className="subsuccess-btn">Back to home</Link>
              </div>
            </>
          )}

          {phase === 'timeout' && (
            <>
              <h1 className="subsuccess-title">Almost there…</h1>
              <p className="subsuccess-text">
                Your payment went through, but Razorpay hasn’t confirmed it just yet.
                Pro unlocks automatically as soon as it does — there’s nothing more
                to do, and you won’t be charged again.
              </p>
              <div className="subsuccess-actions">
                <button className="subsuccess-btn subsuccess-btn--primary"
                  onClick={() => window.location.reload()}>Check again</button>
                <Link to="/" className="subsuccess-btn">Back to home</Link>
              </div>
            </>
          )}

          {phase === 'error' && (
            <>
              <h1 className="subsuccess-title">Please log in</h1>
              <p className="subsuccess-text">We couldn’t verify your session.</p>
              <div className="subsuccess-actions">
                <Link to="/login" className="subsuccess-btn subsuccess-btn--primary">Log in</Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
