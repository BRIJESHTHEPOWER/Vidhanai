// frontend/src/pages/AdminAnnouncements.jsx

import React, { useState, useEffect } from 'react';
import './AdminAnnouncements.css';

const API_BASE  = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const ADMIN_KEY = 'VIDHAN_ADMIN_2024';

const FEATURE_TAGS = ['New Feature', 'Improvement', 'Bug Fix', 'Coming Soon'];

const PLANS = [
  { label: 'All users', value: 'all' },
  { label: 'Free only', value: 'free' },
  { label: 'Pro only',  value: 'pro'  },
  { label: 'Max only',  value: 'max'  },
];

const TAG_CLASS = {
  'New Feature': 'aa-tag--new-feature',
  'Improvement': 'aa-tag--improvement',
  'Bug Fix':     'aa-tag--bug-fix',
  'Coming Soon': 'aa-tag--coming-soon',
};

function planLabel(v) {
  return { all: 'All users', free: 'Free plan', pro: 'Pro plan', max: 'Max plan' }[v] || v;
}

function TagPill({ tag }) {
  return <span className={`aa-tag-pill ${TAG_CLASS[tag] || TAG_CLASS['New Feature']}`}>{tag}</span>;
}

export default function AdminAnnouncements() {
  const [featureTag,     setFeatureTag]     = useState('New Feature');
  const [plan,           setPlan]           = useState('all');
  const [title,          setTitle]          = useState('');
  const [message,        setMessage]        = useState('');
  const [loading,        setLoading]        = useState(false);
  const [successMsg,     setSuccessMsg]     = useState('');
  const [errorMsg,       setErrorMsg]       = useState('');
  const [announcements,  setAnnouncements]  = useState([]);
  const [deleting,       setDeleting]       = useState(null);

  const fetchList = async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/announcements`);
      const data = await res.json();
      if (Array.isArray(data)) setAnnouncements(data);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchList(); }, []);

  const handlePublish = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!title.trim())   { setErrorMsg('Title is required.'); return; }
    if (!message.trim()) { setErrorMsg('Message is required.'); return; }

    setLoading(true);
    try {
      const res  = await fetch(
        `${API_BASE}/api/admin/announcements?admin_key=${ADMIN_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            title:       title.trim(),
            message:     message.trim(),
            plan,
            feature_tag: featureTag,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('✅ Announcement published! Users will see it in their notification bell.');
        setTitle('');
        setMessage('');
        setFeatureTag('New Feature');
        setPlan('all');
        fetchList();
      } else {
        setErrorMsg(data.detail || 'Failed to publish. Please try again.');
      }
    } catch {
      setErrorMsg('Network error. Check your backend connection.');
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    setDeleting(id);
    try {
      await fetch(
        `${API_BASE}/api/admin/announcements/${id}?admin_key=${ADMIN_KEY}`,
        { method: 'DELETE' }
      );
      setAnnouncements(prev => prev.filter(a => a._id !== id));
    } catch {
      alert('Delete failed. Please try again.');
    }
    setDeleting(null);
  };

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const clearFeedback = () => { setErrorMsg(''); setSuccessMsg(''); };

  return (
    <div className="aa-root">
      <div className="aa-container">

        {/* ── Page header ── */}
        <div className="aa-page-header">
          <h1 className="aa-page-title">📢 Publish Announcement</h1>
          <p className="aa-page-sub">
            Post here → automatically saves to MongoDB → users see it in bell instantly
          </p>
        </div>

        {/* ── Form card ── */}
        <div className="aa-card">

          {/* Feature tag selector */}
          <div className="aa-field">
            <label className="aa-label">Feature Tag</label>
            <div className="aa-btn-group">
              {FEATURE_TAGS.map(tag => (
                <button
                  key={tag}
                  className={`aa-toggle ${featureTag === tag ? 'aa-toggle--on' : ''}`}
                  onClick={() => { setFeatureTag(tag); clearFeedback(); }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Plan selector */}
          <div className="aa-field">
            <label className="aa-label">Target Plan</label>
            <div className="aa-btn-group">
              {PLANS.map(p => (
                <button
                  key={p.value}
                  className={`aa-toggle ${plan === p.value ? 'aa-toggle--on' : ''}`}
                  onClick={() => { setPlan(p.value); clearFeedback(); }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="aa-field">
            <label className="aa-label">Title</label>
            <input
              className="aa-input"
              placeholder="e.g. New Quiz Categories are now live"
              value={title}
              onChange={e => { setTitle(e.target.value); clearFeedback(); }}
              maxLength={120}
            />
          </div>

          {/* Message */}
          <div className="aa-field">
            <label className="aa-label">Message</label>
            <textarea
              className="aa-textarea"
              rows={4}
              placeholder="Describe what is new. Keep it short and clear for users."
              value={message}
              onChange={e => { setMessage(e.target.value); clearFeedback(); }}
              maxLength={400}
            />
            <span className="aa-char-count">{message.length}/400</span>
          </div>

          {/* Live preview */}
          {title.trim() && (
            <div className="aa-preview-wrap">
              <p className="aa-preview-label">Preview — how users will see it in the bell</p>
              <div className="aa-preview-card">
                <div className="aa-preview-row">
                  <TagPill tag={featureTag} />
                  <span className="aa-badge-new">NEW</span>
                </div>
                <p className="aa-preview-title">{title}</p>
                {message.trim() && <p className="aa-preview-msg">{message}</p>}
                <p className="aa-preview-meta">{todayStr} · {planLabel(plan)}</p>
              </div>
            </div>
          )}

          {/* Feedback */}
          {errorMsg   && <div className="aa-error">{errorMsg}</div>}
          {successMsg && <div className="aa-success">{successMsg}</div>}

          {/* Publish button */}
          <button
            className="aa-publish-btn"
            onClick={handlePublish}
            disabled={loading}
          >
            {loading ? 'Publishing…' : '🚀 Publish to all users'}
          </button>
        </div>

        {/* ── Published list ── */}
        <section className="aa-list-section">
          <h2 className="aa-list-heading">Published announcements</h2>

          {announcements.length === 0 ? (
            <p className="aa-empty-state">No announcements published yet.</p>
          ) : (
            <div className="aa-list">
              {announcements.map(ann => (
                <div key={ann._id} className="aa-ann-card">
                  <div className="aa-ann-top">
                    <div className="aa-ann-left-badges">
                      <TagPill tag={ann.feature_tag} />
                      <span className="aa-plan-badge">{planLabel(ann.plan)}</span>
                      {ann.is_new && <span className="aa-live-badge">LIVE</span>}
                    </div>
                    <div className="aa-ann-right">
                      <span className="aa-ann-date">{ann.date}</span>
                      <button
                        className="aa-delete-btn"
                        onClick={() => handleDelete(ann._id)}
                        disabled={deleting === ann._id}
                      >
                        {deleting === ann._id ? '…' : '🗑 Delete'}
                      </button>
                    </div>
                  </div>
                  <p className="aa-ann-title">{ann.title}</p>
                  <p className="aa-ann-message">{ann.message}</p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
