import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { validateName, validateEmail, validatePassword, getPasswordStrength } from '../utils/authValidation';
import './Login.css';

const BASE_URL = 'http://localhost:8000';

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" x2="23" y1="1" y2="23"/>
  </svg>
);

export default function Signup() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const nameError     = validateName(name);
  const emailError    = validateEmail(email);
  const passwordError = validatePassword(password);
  const confirmError  = confirm && confirm !== password ? 'Passwords do not match' : '';
  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (validateName(name))         { setError(validateName(name)); return; }
    if (validateEmail(email))       { setError(validateEmail(email)); return; }
    if (validatePassword(password)) { setError(validatePassword(password)); return; }
    if (password !== confirm)       { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Signup failed');

      setSuccess('Account created! Redirecting to verification...');
      setTimeout(() => navigate('/verify-otp', { state: { email, justSignedUp: true } }), 1200);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-root">
      {/* ── Left panel: Law visual ── */}
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
                <div className="auth-scale-pan">
                  <span>IPC</span>
                </div>
              </div>
              <div className="auth-scale-arm auth-scale-arm--right">
                <div className="auth-scale-chain" />
                <div className="auth-scale-pan">
                  <span>BNS</span>
                </div>
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

      {/* ── Right panel: Form ── */}
      <div className="auth-right">
        <Link to="/" className="auth-back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Home
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
            <h1 className="auth-card-title">Create account</h1>
            <p className="auth-card-sub">Join thousands of legal learners</p>
          </div>

          {error && (
            <div className="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="auth-field-hint auth-field-hint--success" style={{ marginBottom: 16, fontSize: 13 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {success}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Full name</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                className={nameError ? 'auth-input--invalid' : ''}
                required disabled={loading} placeholder="Your name" autoFocus
              />
              {nameError && (
                <span className="auth-field-hint auth-field-hint--error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {nameError}
                </span>
              )}
            </div>

            <div className="auth-field">
              <label>Email address</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                className={emailError ? 'auth-input--invalid' : ''}
                required disabled={loading} placeholder="you@example.com"
              />
              {emailError && (
                <span className="auth-field-hint auth-field-hint--error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {emailError}
                </span>
              )}
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="auth-input-wrap">
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className={passwordError ? 'auth-input--invalid' : ''}
                  required disabled={loading} placeholder="Minimum 6 characters"
                />
                <button type="button" className="auth-eye-btn" tabIndex={-1}
                  onClick={() => setShowPw(p => !p)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {password && (
                <div className="auth-pw-strength">
                  <div className="auth-pw-strength-bar">
                    <div className="auth-pw-strength-fill" style={{ width: `${strength.percent}%`, backgroundColor: strength.color }} />
                  </div>
                  <span className="auth-pw-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                </div>
              )}
              {passwordError && (
                <span className="auth-field-hint auth-field-hint--error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {passwordError}
                </span>
              )}
            </div>

            <div className="auth-field">
              <label>Confirm password</label>
              <div className="auth-input-wrap">
                <input
                  type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                  className={confirmError ? 'auth-input--invalid' : confirm && !confirmError ? 'auth-input--valid' : ''}
                  required disabled={loading} placeholder="Re-enter your password"
                />
                <button type="button" className="auth-eye-btn" tabIndex={-1}
                  onClick={() => setShowConfirm(p => !p)} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {confirm && (
                confirmError ? (
                  <span className="auth-field-hint auth-field-hint--error">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {confirmError}
                  </span>
                ) : (
                  <span className="auth-field-hint auth-field-hint--success">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    Passwords match
                  </span>
                )
              )}
            </div>

            <div className="auth-security-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Your password is encrypted and never shared.
            </div>

            <button type="submit" className="auth-submit auth-submit--cyan" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="auth-toggle">
            Already have an account?
            <Link to="/login">Sign in</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
