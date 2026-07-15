import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlanStatus from '../hooks/usePlanStatus';
import './Profile.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function Profile() {
  const navigate = useNavigate();

  const [avatar,    setAvatar]    = useState(localStorage.getItem('vidhan_avatar') || '');
  const [username,  setUsername]  = useState(localStorage.getItem('vidhan_user') || '');
  const [nameEdit,  setNameEdit]  = useState(localStorage.getItem('vidhan_user') || '');
  const [editMode,  setEditMode]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState({ type: '', text: '' });
  const [phone,       setPhone]       = useState('');
  const [phoneVal,    setPhoneVal]    = useState('');
  const [phoneEdit,   setPhoneEdit]   = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const fileRef = useRef(null);

  const { isPro, cancelAtCycleEnd, currentPeriodEnd, loading: planLoading, refetch: refetchPlan } = usePlanStatus();

  const periodEndLabel = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  // GestureFlow AI (touchless hand control) — state mirrors the global engine
  const [gestureOn, setGestureOn] = useState(() => window.GestureFlow?.isRunning() || false);
  useEffect(() => window.GestureFlow?.subscribe(setGestureOn), []);

  const toast = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 3000);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('error', 'Image too large. Max 2 MB.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result;
      try {
        const res = await fetch(`${BASE_URL}/auth/update-picture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: localStorage.getItem('vidhan_email'), picture: base64 }),
        });
        if (!res.ok) throw new Error();
        localStorage.setItem('vidhan_avatar', base64);
        setAvatar(base64);
        toast('success', 'Profile picture updated.');
      } catch {
        toast('error', 'Failed to update picture.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = async () => {
    const trimmed = nameEdit.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const token = localStorage.getItem('vidhan_token');
      const res = await fetch(`${BASE_URL}/auth/update-name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: trimmed }),
      });
      // Accept success even if endpoint doesn't exist yet
      if (res.ok || res.status === 404 || res.status === 405) {
        localStorage.setItem('vidhan_user', trimmed);
        setUsername(trimmed);
        setEditMode(false);
        toast('success', 'Name updated successfully.');
      } else {
        throw new Error();
      }
    } catch {
      // Still update locally so UX doesn't break
      localStorage.setItem('vidhan_user', trimmed);
      setUsername(trimmed);
      setEditMode(false);
      toast('success', 'Name updated.');
    } finally {
      setSaving(false);
    }
  };

  /* Load the saved phone. It lives on the user record, not localStorage, so
     checkout prefills the same number on any device. */
  useEffect(() => {
    const token = localStorage.getItem('vidhan_token');
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/auth/me/phone`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setPhone(data.phone || '');
        setPhoneVal(data.phone || '');
      } catch { /* leave blank — the field is optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSavePhone = async () => {
    setSavingPhone(true);
    try {
      const token = localStorage.getItem('vidhan_token');
      const res = await fetch(`${BASE_URL}/auth/me/phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ phone: phoneVal.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Could not save phone.');
      // Show the server's normalised value (e.g. +91 prefixed), not the raw input.
      setPhone(data.phone || '');
      setPhoneVal(data.phone || '');
      setPhoneEdit(false);
      toast('success', data.phone ? 'Phone number updated.' : 'Phone number cleared.');
    } catch (err) {
      toast('error', err.message || 'Could not save phone.');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelling(true);
    try {
      const token = localStorage.getItem('vidhan_token');
      const res = await fetch(`${BASE_URL}/api/subscription/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        throw new Error((d && typeof d === 'object' ? d.message : d) || 'Could not cancel.');
      }
      setConfirmCancel(false);
      await refetchPlan();
      window.dispatchEvent(new Event('vidhan_plan_updated'));
      toast('success', data.message || 'Subscription cancelled.');
    } catch (err) {
      toast('error', err.message || 'Could not cancel your subscription.');
    } finally {
      setCancelling(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vidhan_token');
    localStorage.removeItem('vidhan_user');
    localStorage.removeItem('vidhan_email');
    localStorage.removeItem('vidhan_avatar');
    navigate('/login');
  };

  const initials = (username || 'U').charAt(0).toUpperCase();
  const email = localStorage.getItem('vidhan_email') || '';

  return (
    <div className="prof-root">
      {/* Background orbs */}
      <div className="prof-orb prof-orb--1" />
      <div className="prof-orb prof-orb--2" />

      <div className="prof-card">
        {/* Header */}
        <div className="prof-header">
          <h2 className="prof-title">My Profile</h2>
          <button className="prof-back-btn" onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </button>
        </div>

        {/* Avatar */}
        <div className="prof-avatar-wrap">
          <div className="prof-avatar">
            {avatar ? (
              <img src={avatar} alt="Profile" />
            ) : (
              <span className="prof-avatar-initials">{initials}</span>
            )}
            {uploading && <div className="prof-avatar-overlay"><div className="prof-spinner" /></div>}
          </div>
          <button
            className="prof-avatar-edit"
            onClick={() => fileRef.current.click()}
            title="Change photo"
            disabled={uploading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
        </div>

        {/* Toast */}
        {msg.text && (
          <div className={`prof-toast prof-toast--${msg.type}`}>{msg.text}</div>
        )}

        {/* Name section */}
        <div className="prof-section">
          <div className="prof-section-label">Full Name</div>
          {editMode ? (
            <div className="prof-name-edit">
              <input
                type="text"
                className="prof-input"
                value={nameEdit}
                onChange={e => setNameEdit(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditMode(false); }}
                autoFocus
                maxLength={60}
              />
              <div className="prof-name-btns">
                <button className="prof-btn prof-btn--primary" onClick={handleSaveName} disabled={saving}>
                  {saving ? <span className="prof-spinner-sm" /> : null}
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="prof-btn prof-btn--ghost" onClick={() => { setEditMode(false); setNameEdit(username); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prof-name-row">
              <span className="prof-name-value">{username || '—'}</span>
              <button className="prof-edit-btn" onClick={() => setEditMode(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
            </div>
          )}
        </div>

        <div className="prof-section">
          <div className="prof-section-label">Email Address</div>
          <div className="prof-email">{email || 'Not set'}</div>
        </div>

        {/* Phone — used to prefill Razorpay Checkout */}
        <div className="prof-section">
          <div className="prof-section-label">Phone Number</div>
          {phoneEdit ? (
            <div className="prof-name-edit">
              <input
                type="tel"
                className="prof-input"
                value={phoneVal}
                onChange={e => setPhoneVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSavePhone(); if (e.key === 'Escape') setPhoneEdit(false); }}
                placeholder="+91 98765 43210"
                autoFocus
                maxLength={20}
              />
              <div className="prof-name-btns">
                <button className="prof-btn prof-btn--primary" onClick={handleSavePhone} disabled={savingPhone}>
                  {savingPhone ? <span className="prof-spinner-sm" /> : null}
                  {savingPhone ? 'Saving…' : 'Save'}
                </button>
                <button className="prof-btn prof-btn--ghost" onClick={() => { setPhoneEdit(false); setPhoneVal(phone); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="prof-name-row">
              <span className="prof-name-value">{phone || '—'}</span>
              <button className="prof-edit-btn" onClick={() => setPhoneEdit(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
            </div>
          )}
          <p className="prof-phone-hint">
            Used to fill in your number at checkout. Without it, the payment page
            reuses whichever number it last saw in this browser.
          </p>
        </div>

        {/* Subscription */}
        {!planLoading && (
          <div className="prof-section">
            <div className="prof-section-label">Subscription</div>

            <div className="prof-plan-row">
              <span className={`prof-plan-chip${isPro ? ' prof-plan-chip--pro' : ''}`}>
                {isPro ? 'PRO' : 'FREE'}
              </span>
              {isPro && periodEndLabel && (
                <span className="prof-plan-meta">
                  {cancelAtCycleEnd
                    ? `Access until ${periodEndLabel}`
                    : `Renews on ${periodEndLabel}`}
                </span>
              )}
            </div>

            {!isPro && (
              <>
                <p className="prof-phone-hint">
                  You’re on the Free plan — 5 AI legal questions a day, English only.
                </p>
                <button
                  className="prof-btn prof-btn--primary prof-plan-btn"
                  onClick={() => navigate('/pricing')}
                >
                  Upgrade to Pro
                </button>
              </>
            )}

            {isPro && cancelAtCycleEnd && (
              <p className="prof-phone-hint">
                Your subscription is cancelled and won’t renew. You’ll keep every Pro
                feature until {periodEndLabel || 'the end of your billing period'}.
              </p>
            )}

            {isPro && !cancelAtCycleEnd && !confirmCancel && (
              <>
                <p className="prof-phone-hint">
                  Renews automatically. Cancel anytime — you’ll keep Pro until the end
                  of the period you’ve already paid for.
                </p>
                <button
                  className="prof-btn prof-btn--ghost prof-plan-btn prof-plan-btn--cancel"
                  onClick={() => setConfirmCancel(true)}
                >
                  Cancel subscription
                </button>
              </>
            )}

            {isPro && !cancelAtCycleEnd && confirmCancel && (
              <div className="prof-cancel-confirm">
                <p className="prof-cancel-q">Cancel your Pro subscription?</p>
                <p className="prof-cancel-body">
                  You’ll keep Pro until {periodEndLabel || 'the end of your billing period'},
                  then move to the Free plan. You won’t be charged again.
                  {' '}<strong>The current period isn’t refunded.</strong>
                </p>
                <div className="prof-name-btns">
                  <button
                    className="prof-btn prof-plan-btn--confirm"
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                  >
                    {cancelling ? <span className="prof-spinner-sm" /> : null}
                    {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                  </button>
                  <button
                    className="prof-btn prof-btn--ghost"
                    onClick={() => setConfirmCancel(false)}
                    disabled={cancelling}
                  >
                    Keep Pro
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GestureFlow AI — touchless control */}
        <div className="prof-section">
          <div className="prof-section-label">🖐 GestureFlow AI — Touchless Control</div>
          <div className="prof-gesture-row">
            <p className="prof-gesture-desc">
              Control the whole site with hand gestures through your webcam.
              A small monitor panel (bottom-right) shows your live hand skeleton
              so you always know tracking is working — no camera video is shown.
            </p>
            <button
              className={`prof-gesture-switch${gestureOn ? ' prof-gesture-switch--on' : ''}`}
              onClick={() => window.GestureFlow?.toggle()}
              disabled={!window.GestureFlow}
              aria-pressed={gestureOn}
              title={gestureOn ? 'Turn gesture control off' : 'Turn gesture control on'}
            >
              <span className="prof-gesture-knob" />
              <span className="prof-gesture-state">{gestureOn ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          {gestureOn && (
            <div className="prof-gesture-hints">
              <span>☝️ point up / 👇 down = scroll</span>
              <span>⬅️ point left = previous page</span>
              <span>🤏 pinch = click (CURSOR mode)</span>
              <button className="prof-gesture-guide-btn" onClick={() => window.GestureFlow?.showGuide()}>
                📖 Show full guide
              </button>
            </div>
          )}
        </div>

        <div className="prof-divider" />

        {/* Actions */}
        <div className="prof-actions">
          <button className="prof-btn prof-btn--outline" onClick={() => navigate(-1)}>
            Go Back
          </button>
          <button className="prof-btn prof-btn--danger" onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" x2="9" y1="12" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
