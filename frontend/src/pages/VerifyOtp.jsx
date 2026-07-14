import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import './Login.css';

const BASE_URL = 'http://localhost:8000';
const RESEND_COOLDOWN = 30; // seconds — matches the backend's own cooldown

export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const redirectTo = location.state?.redirectTo || '/';

  const [digits, setDigits]   = useState(['', '', '', '', '', '']);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState(location.state?.justSignedUp ? 'We emailed a 6-digit code to your address.' : '');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef([]);

  // No email in state (e.g. user landed here directly) — nothing to verify.
  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const focusInput = (i) => inputsRef.current[i]?.focus();

  const handleDigitChange = (i, val) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const next = [...digits];
      next[i] = '';
      setDigits(next);
      return;
    }
    // Handle paste of the full code into one box.
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split('');
      const next = [...digits];
      chars.forEach((c, idx) => { if (i + idx < 6) next[i + idx] = c; });
      setDigits(next);
      focusInput(Math.min(i + chars.length, 5));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (i < 5) focusInput(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) focusInput(i - 1);
  };

  const code = digits.join('');

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Enter the full 6-digit code.'); return; }
    setError(''); setInfo(''); setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Verification failed.');

      localStorage.setItem('vidhan_token', data.access_token);
      localStorage.setItem('vidhan_user', data.name);
      localStorage.setItem('vidhan_email', data.email);
      navigate(redirectTo);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(''); setInfo(''); setResending(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not resend code.');
      setInfo(data.message || 'A new code has been sent.');
      setDigits(['', '', '', '', '', '']);
      focusInput(0);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-left">
        <div className="auth-left-inner">
          <div className="auth-scales">
            <div className="auth-scales-top">
              <div className="auth-scales-beam" />
              <div className="auth-scales-pivot" />
            </div>
            <div className="auth-scales-arms">
              <div className="auth-scale-arm auth-scale-arm--left">
                <div className="auth-scale-chain" />
                <div className="auth-scale-pan"><span>IPC</span></div>
              </div>
              <div className="auth-scale-arm auth-scale-arm--right">
                <div className="auth-scale-chain" />
                <div className="auth-scale-pan"><span>BNS</span></div>
              </div>
            </div>
          </div>
          <div className="auth-left-brand">
            <div className="auth-left-logo">
              <img src="/vidhan-logo.png" alt="Vidhan.ai" />
            </div>
            <h2 className="auth-left-title">Vidhan.ai</h2>
            <p className="auth-left-sub">India's AI-Powered Legal Platform</p>
          </div>
          <ul className="auth-left-features">
            <li><span className="auth-feat-icon">⚖️</span> IPC 1860 &amp; BNS 2023 side-by-side</li>
            <li><span className="auth-feat-icon">🤖</span> AI legal assistant in your language</li>
            <li><span className="auth-feat-icon">📚</span> Interactive quizzes &amp; law comics</li>
          </ul>
        </div>
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
      </div>

      <div className="auth-right">
        <Link to="/login" className="auth-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Login
        </Link>

        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="auth-card-header">
            <div className="auth-card-logo">
              <img src="/vidhan-logo.png" alt="Vidhan.ai" />
            </div>
            <h1 className="auth-card-title">Verify your email</h1>
            <p className="auth-card-sub">
              Enter the 6-digit code we sent to<br /><strong>{email}</strong>
            </p>
          </div>

          {error && (
            <div className="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          {info && !error && (
            <div className="auth-field-hint auth-field-hint--success" style={{ marginBottom: 16, fontSize: 13 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {info}
            </div>
          )}

          <form className="auth-form" onSubmit={handleVerify}>
            <div className="otp-input-row">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => (inputsRef.current[i] = el)}
                  className="otp-digit-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={d}
                  autoFocus={i === 0}
                  disabled={loading}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                />
              ))}
            </div>

            <button type="submit" className="auth-submit auth-submit--cyan" disabled={loading || code.length !== 6}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? 'Verifying…' : 'Verify Email'}
            </button>
          </form>

          <div className="auth-toggle">
            Didn't get the code?
            <button type="button" onClick={handleResend} disabled={cooldown > 0 || resending}>
              {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
