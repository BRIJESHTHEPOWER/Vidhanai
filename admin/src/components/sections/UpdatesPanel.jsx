import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import './sections.css';

const TAGS  = ['New Feature', 'Improvement', 'Bug Fix', 'Coming Soon'];
const PLANS = [
  { value: 'all',  label: 'All users' },
  { value: 'free', label: 'Free plan' },
  { value: 'pro',  label: 'Pro plan'  },
];

const TAG_COLORS = {
  'New Feature': '#818cf8',
  'Improvement': '#34d399',
  'Bug Fix':     '#f87171',
  'Coming Soon': '#fbbf24',
};

export default function UpdatesPanel() {
  const [items, setItems]       = useState([]);
  const [subCount, setSubCount] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [posting, setPosting]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice]     = useState(null);   // { type: 'ok'|'err', text }

  const [title, setTitle]     = useState('');
  const [message, setMessage] = useState('');
  const [tag, setTag]         = useState(TAGS[0]);
  const [plan, setPlan]       = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.announcements();
      setItems(res.announcements || []);
      setSubCount(res.subscriber_count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handlePost() {
    if (title.trim().length < 3)   { setNotice({ type: 'err', text: 'Title must be at least 3 characters.' }); return; }
    if (message.trim().length < 3) { setNotice({ type: 'err', text: 'Message must be at least 3 characters.' }); return; }
    setPosting(true);
    setNotice(null);
    try {
      await api.createAnnouncement({ title: title.trim(), message: message.trim(), feature_tag: tag, plan });
      setTitle(''); setMessage(''); setTag(TAGS[0]); setPlan('all');
      setNotice({ type: 'ok', text: `Update posted — live on the website bell for 7 days, emailing ${subCount} subscriber${subCount === 1 ? '' : 's'} in the background.` });
      // brief delay so the background email status has a chance to land
      setTimeout(load, 1200);
    } catch (e) {
      setNotice({ type: 'err', text: e.message });
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(id, t) {
    if (!window.confirm(`Delete update "${t}"? It will disappear from the bell and this history.`)) return;
    setDeleting(id);
    try {
      await api.deleteAnnouncement(id);
      setItems(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  }

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      + ' · '
      + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div className="sec-header">
        <h1 className="sec-title">Updates</h1>
        <p className="sec-sub">
          Post product updates — they appear in the website bell for 7 days and are emailed to
          newsletter subscribers. Full history is kept here forever.
        </p>
      </div>

      {/* ── Post a new update ── */}
      <div className="panel-box" style={{ marginBottom: 24 }}>
        <div className="panel-box-header">
          <span className="panel-box-title">Post an Update</span>
          <span className="adm-badge adm-badge--cyan">{subCount} newsletter subscriber{subCount === 1 ? '' : 's'}</span>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div className="adm-form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
            <div className="adm-form-group">
              <label>Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Voice input now supports Malayalam"
                maxLength={120}
              />
            </div>
            <div className="adm-form-group">
              <label>Tag</label>
              <select value={tag} onChange={e => setTag(e.target.value)}>
                {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="adm-form-group">
              <label>Audience</label>
              <select value={plan} onChange={e => setPlan(e.target.value)}>
                {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="adm-form-group adm-form-group--full" style={{ marginTop: 12 }}>
            <label>Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Short description shown in the bell and in the subscriber email…"
              rows={3}
              maxLength={1000}
            />
          </div>

          {notice && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: notice.type === 'ok' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
              color:      notice.type === 'ok' ? '#34d399' : '#f87171',
              border: `1px solid ${notice.type === 'ok' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
            }}>
              {notice.text}
            </div>
          )}

          <button
            className="adm-btn-primary"
            style={{ marginTop: 14 }}
            onClick={handlePost}
            disabled={posting}
          >
            {posting ? 'Posting…' : '📢 Post Update'}
          </button>
        </div>
      </div>

      {/* ── Full history ── */}
      <div className="panel-box">
        <div className="panel-box-header">
          <span className="panel-box-title">
            Update History
            <span className="adm-badge adm-badge--cyan" style={{ marginLeft: 10 }}>{items.length}</span>
          </span>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /><p>Loading updates...</p></div>
        ) : items.length === 0 ? (
          <div className="adm-empty"><div className="adm-empty-icon">📢</div><h3>No updates posted yet</h3></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table">
              <thead>
                <tr><th>Tag</th><th>Update</th><th>Audience</th><th>Date &amp; Time</th><th>Bell</th><th>Email</th><th></th></tr>
              </thead>
              <tbody>
                {items.map(a => (
                  <tr key={a.id}>
                    <td>
                      <span className="adm-badge" style={{
                        background: `${TAG_COLORS[a.feature_tag] || '#818cf8'}22`,
                        color: TAG_COLORS[a.feature_tag] || '#818cf8',
                        whiteSpace: 'nowrap',
                      }}>
                        {a.feature_tag}
                      </span>
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.message}>
                        {a.message}
                      </div>
                    </td>
                    <td><span className="adm-badge adm-badge--indigo">{(PLANS.find(p => p.value === a.plan) || {}).label || a.plan}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(a.created_at)}</td>
                    <td>
                      {a.live_on_bell
                        ? <span style={{ color: '#34d399', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>● Live</span>
                        : <span style={{ color: 'var(--text-faint)', fontSize: 12, whiteSpace: 'nowrap' }}>Expired</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-faint)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.email_status}>
                      {a.email_status}
                    </td>
                    <td>
                      <button
                        className="adm-delete-btn"
                        onClick={() => handleDelete(a.id, a.title)}
                        disabled={deleting === a.id}
                      >
                        {deleting === a.id
                          ? <div className="adm-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
