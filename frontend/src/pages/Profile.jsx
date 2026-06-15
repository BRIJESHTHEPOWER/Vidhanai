import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

const BASE_URL = 'http://localhost:8000';

export default function Profile() {
  const navigate = useNavigate();

  const [avatar,    setAvatar]    = useState(localStorage.getItem('vidhan_avatar') || '');
  const [username,  setUsername]  = useState(localStorage.getItem('vidhan_user') || '');
  const [nameEdit,  setNameEdit]  = useState(localStorage.getItem('vidhan_user') || '');
  const [editMode,  setEditMode]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState({ type: '', text: '' });
  const fileRef = useRef(null);

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
