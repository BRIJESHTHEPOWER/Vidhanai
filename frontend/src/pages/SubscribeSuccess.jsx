import React, { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './SubscribeSuccess.css';

const BASE_URL = 'http://localhost:8000';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90000; // give the webhook up to 90s to land

/**
 * Post-payment confirmation screen.
 * Polls /api/user/plan-status until the WEBHOOK flips the user to Pro, then
 * fetches and shows the invoice link. If the webhook never arrives (e.g. ngrok
 * not running), it surfaces a clear "still processing" message.
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

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`${BASE_URL}/api/user/plan-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.is_pro) {
          if (cancelled) return;
          setPhase('confirmed');
          fetchInvoice();
          return;
        }
      } catch { /* keep polling */ }

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
          <span className="subsuccess-testmode">🧪 TEST MODE — this was a simulated payment. No real money was charged and no bank/UPI account was debited.</span>

          {phase === 'processing' && (
            <>
              <div className="subsuccess-spinner" aria-hidden="true" />
              <h1 className="subsuccess-title">Processing your subscription…</h1>
              <p className="subsuccess-text">
                This was a <strong>simulated test payment</strong> — no real money was charged.
                We’re waiting for Razorpay’s signed webhook to confirm the (test) charge —
                that verified webhook is the only thing that grants Pro access.
              </p>
              <p className="subsuccess-hint">
                In local dev the webhook needs an <strong>ngrok</strong> tunnel. If Pro
                doesn’t activate, check that ngrok is running and the webhook URL is set.
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
              <h1 className="subsuccess-title">You’re Pro! 🎉</h1>
              <p className="subsuccess-text">
                Your subscription is active and all Pro features are unlocked.
                This is a <strong>test-mode</strong> subscription — no real money was charged.
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
              <h1 className="subsuccess-title">Still processing…</h1>
              <p className="subsuccess-text">
                The simulated test payment completed, but we haven’t received the Razorpay
                webhook confirmation yet. Pro unlocks automatically once it arrives — no real
                money was charged.
              </p>
              <p className="subsuccess-hint">
                Dev note: make sure <strong>ngrok</strong> is running and the webhook URL
                (<code>/api/webhook/razorpay</code>) is configured in the Razorpay dashboard.
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
