import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleLogin } from "@react-oauth/google";
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

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const nameError    = !isLogin ? validateName(name) : '';
  const emailError   = !isLogin ? validateEmail(email) : '';
  const passwordError = !isLogin ? validatePassword(password) : '';
  const confirmError = !isLogin && confirm && confirm !== password ? 'Passwords do not match' : '';
  const strength = getPasswordStrength(password);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await fetch(`${BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      const data = await res.json();
      localStorage.setItem('vidhan_token', data.access_token);
      localStorage.setItem('vidhan_user', data.name);
      localStorage.setItem('vidhan_email', data.email);
      localStorage.setItem('vidhan_avatar', data.picture || '');
      navigate('/');
    } catch {
      setError('Google sign-in failed. Please try again.');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Authentication failed');
      localStorage.setItem('vidhan_token', data.access_token);
      localStorage.setItem('vidhan_user', data.name);
      localStorage.setItem('vidhan_email', email);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (validateName(name))      { setError(validateName(name)); return; }
    if (validateEmail(email))    { setError(validateEmail(email)); return; }
    if (validatePassword(password)) { setError(validatePassword(password)); return; }
    if (password !== confirm)    { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Signup failed');
      localStorage.setItem('vidhan_token', data.access_token || 'demo_token');
      localStorage.setItem('vidhan_user', name);
      localStorage.setItem('vidhan_email', email);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* ── Left panel: Law visual ── */}
      <div className="auth-left">
        <div className="auth-left-inner">
          {/* Animated scales of justice */}
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
            <li><span className="auth-feat-icon">🔍</span> Detective case simulator</li>
          </ul>
        </div>
        {/* decorative orbs */}
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
          key={isLogin ? 'login' : 'signup'}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="auth-card-header">
            <div className="auth-card-logo">
              <img src="/vidhan-logo.png" alt="Vidhan.ai" />
            </div>
            <h1 className="auth-card-title">{isLogin ? 'Welcome back' : 'Create account'}</h1>
            <p className="auth-card-sub">
              {isLogin ? 'Sign in to your Vidhan.ai account' : 'Join thousands of legal learners'}
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

          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleLoginSubmit}
                className="auth-form"
              >
                <div className="auth-field">
                  <label>Email address</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required disabled={loading} placeholder="you@example.com"
                  />
                </div>
                <div className="auth-field">
                  <label>Password</label>
                  <div className="auth-input-wrap">
                    <input
                      type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      required disabled={loading} placeholder="Enter your password"
                    />
                    <button type="button" className="auth-eye-btn" tabIndex={-1}
                      onClick={() => setShowPw(p => !p)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                      {showPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
                <button type="submit" className="auth-submit" disabled={loading}>
                  {loading ? <span className="auth-spinner" /> : null}
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>

                <div className="auth-divider"><span>or continue with</span></div>
                <div className="auth-google-wrap">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google sign-in failed.')}
                  />
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="signup-form"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                onSubmit={handleSignupSubmit}
                className="auth-form"
              >
                <div className="auth-field">
                  <label>Full name</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    className={nameError ? 'auth-input--invalid' : ''}
                    required disabled={loading} placeholder="Your name"
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
              </motion.form>
            )}
          </AnimatePresence>

          <div className="auth-toggle">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
            <button type="button" onClick={() => {
              setIsLogin(!isLogin); setError('');
              setConfirm(''); setShowPw(false); setShowConfirm(false);
            }}>
              {isLogin ? 'Sign up free' : 'Sign in'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
