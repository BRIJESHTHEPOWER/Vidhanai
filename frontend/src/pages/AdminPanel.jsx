import React, { useState, useEffect, useCallback } from 'react';
import './AdminPanel.css';

const API = 'http://localhost:8000/admin';

// ── Helpers ───────────────────────────────────────────────────────────────────
function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

function StarRating({ n }) {
  return <span className="ap-stars">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="ap-pagination">
      <button disabled={page <= 1}         onClick={() => onChange(page - 1)}>‹ Prev</button>
      <span>Page {page} / {pages}</span>
      <button disabled={page >= pages}     onClick={() => onChange(page + 1)}>Next ›</button>
    </div>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  if (!msg) return null;
  return <div className={`ap-toast ap-toast--${type}`}>{msg}</div>;
}

// ── Law Form Modal ─────────────────────────────────────────────────────────────
const EMPTY_LAW = {
  title: '', description: '', section_number: '', ipc_section: '', bns_section: '',
  category: '', chapter: '', punishment: '', bns_punishment: '', bailable: '',
  cognizable: '', keywords: '', simple_explanation: '', real_life_example: '',
};

function LawModal({ law, source, onSave, onClose }) {
  const [form, setForm] = useState(() => law
    ? { ...EMPTY_LAW, ...law, keywords: (law.keywords || []).join(', ') }
    : { ...EMPTY_LAW }
  );
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) return alert('Title is required.');
    setSaving(true);
    await onSave({ ...form, keywords: form.keywords.split(',').map(k => k.trim()).filter(Boolean) });
    setSaving(false);
  };

  const fields = [
    { key: 'title',               label: 'Title *',           span: 2 },
    { key: 'section_number',      label: 'Section Number',    span: 1 },
    { key: source === 'bns' ? 'bns_section' : 'ipc_section',
                                  label: source === 'bns' ? 'BNS Section' : 'IPC Section', span: 1 },
    { key: 'category',            label: 'Category',          span: 1 },
    { key: 'chapter',             label: 'Chapter',           span: 1 },
    { key: 'punishment',          label: 'Punishment',        span: 2 },
    { key: 'bailable',            label: 'Bailable',          span: 1 },
    { key: 'cognizable',          label: 'Cognizable',        span: 1 },
    { key: 'keywords',            label: 'Keywords (comma-separated)', span: 2 },
  ];
  const textareas = [
    { key: 'description',         label: 'Description' },
    { key: 'simple_explanation',  label: 'Simple Explanation' },
    { key: 'real_life_example',   label: 'Real-Life Example' },
  ];

  return (
    <div className="ap-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ap-modal">
        <div className="ap-modal-head">
          <h3>{law ? 'Edit' : 'Add'} {source.toUpperCase()} Law</h3>
          <button className="ap-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="ap-modal-body">
          <div className="ap-form-grid">
            {fields.map(f => (
              <div key={f.key} className={`ap-field ap-field--span${f.span}`}>
                <label>{f.label}</label>
                <input value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
              </div>
            ))}
            {textareas.map(f => (
              <div key={f.key} className="ap-field ap-field--span2">
                <label>{f.label}</label>
                <textarea rows={3} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
        <div className="ap-modal-foot">
          <button className="ap-btn ap-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="ap-btn ap-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Law'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ msg, onConfirm, onCancel }) {
  return (
    <div className="ap-modal-overlay">
      <div className="ap-confirm">
        <p>{msg}</p>
        <div className="ap-confirm-btns">
          <button className="ap-btn ap-btn--ghost" onClick={onCancel}>Cancel</button>
          <button className="ap-btn ap-btn--danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── LOGIN PAGE ─────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [err,   setErr]   = useState('');
  const [busy,  setBusy]  = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      localStorage.setItem('vidhan_admin_token', data.access_token);
      localStorage.setItem('vidhan_admin_name',  data.name);
      onLogin(data.access_token, data.name);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="ap-login-wrap">
      <div className="ap-login-card">
        <div className="ap-login-logo">⚖️</div>
        <h2 className="ap-login-title">Vidhan Admin</h2>
        <p className="ap-login-sub">Sign in to manage the platform</p>
        {err && <div className="ap-login-err">{err}</div>}
        <form onSubmit={handleSubmit} className="ap-login-form">
          <input type="email"    placeholder="Admin email"    value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password"       value={pass}  onChange={e => setPass(e.target.value)}  required />
          <button type="submit" className="ap-btn ap-btn--primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="ap-login-hint">Default: admin@vidhan.ai / admin@123</p>
      </div>
    </div>
  );
}

// ── DASHBOARD TAB ─────────────────────────────────────────────────────────────
function DashboardTab({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/stats`, { headers: authHeaders(token) })
      .then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="ap-loading">Loading stats…</div>;
  if (!stats)  return <div className="ap-empty">Could not load stats.</div>;

  const cards = [
    { label: 'Total Users',   value: stats.total_users,   icon: '👥', color: '#6366f1' },
    { label: 'BNS Laws',      value: stats.bns_laws,      icon: '📗', color: '#10b981' },
    { label: 'IPC Laws',      value: stats.ipc_laws,      icon: '📘', color: '#3b82f6' },
    { label: 'Reviews',       value: stats.total_reviews, icon: '⭐', color: '#f59e0b' },
    { label: 'AI Queries',    value: stats.total_queries, icon: '💬', color: '#8b5cf6' },
    { label: 'New Users (7d)',value: stats.new_users_week,icon: '📈', color: '#06b6d4' },
    { label: 'Active (7d)',   value: stats.active_users_week, icon: '🟢', color: '#22c55e' },
    { label: 'Avg Rating',    value: `${stats.avg_rating}★`,  icon: '🏆', color: '#f97316' },
  ];

  return (
    <div className="ap-tab-content">
      <div className="ap-stat-grid">
        {cards.map(c => (
          <div key={c.label} className="ap-stat-card" style={{ borderColor: c.color }}>
            <span className="ap-stat-icon">{c.icon}</span>
            <div>
              <div className="ap-stat-val" style={{ color: c.color }}>{c.value}</div>
              <div className="ap-stat-lbl">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ap-section-title">Rating Distribution</div>
      <div className="ap-rating-bars">
        {[5,4,3,2,1].map(r => {
          const count = stats.rating_dist?.[String(r)] || 0;
          const pct   = stats.total_reviews ? Math.round((count / stats.total_reviews) * 100) : 0;
          return (
            <div key={r} className="ap-rating-row">
              <span>{r}★</span>
              <div className="ap-rating-bar-wrap"><div className="ap-rating-bar" style={{ width: `${pct}%` }} /></div>
              <span>{count}</span>
            </div>
          );
        })}
      </div>

      <div className="ap-section-title">Recent Reviews</div>
      <div className="ap-recent-list">
        {(stats.recent_reviews || []).map((r, i) => (
          <div key={i} className="ap-recent-row">
            <StarRating n={r.rating} />
            <span className="ap-recent-name">{r.name}</span>
            <span className="ap-recent-text">{r.text}</span>
            <span className="ap-recent-date">{fmt(r.created_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────
function UsersTab({ token, toast }) {
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback((p = 1, q = search) => {
    setLoading(true);
    fetch(`${API}/users?page=${p}&limit=20&search=${encodeURIComponent(q)}`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => { setUsers(d.users || []); setTotal(d.total || 0); setPages(d.pages || 1); setPage(p); })
      .finally(() => setLoading(false));
  }, [token, search]);

  useEffect(() => { load(1, ''); }, [token]);

  const handleDelete = async id => {
    const res = await fetch(`${API}/users/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    const data = await res.json();
    toast(data.message || 'Deleted', res.ok ? 'success' : 'error');
    if (res.ok) load(page);
    setConfirm(null);
  };

  return (
    <div className="ap-tab-content">
      {confirm && <ConfirmDialog msg="Delete this user permanently?" onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />}
      <div className="ap-toolbar">
        <input className="ap-search" placeholder="Search name or email…" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1, search)} />
        <button className="ap-btn ap-btn--outline" onClick={() => load(1, search)}>Search</button>
        <span className="ap-total">{total} users</span>
      </div>
      {loading ? <div className="ap-loading">Loading…</div> : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead><tr>
              <th>Name</th><th>Email</th><th>Provider</th>
              <th>Joined</th><th>Last Login</th><th>Last Logout</th><th>Action</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.name || '—'}</td>
                  <td>{u.email}</td>
                  <td><span className={`ap-badge ap-badge--${u.auth_provider || 'email'}`}>{u.auth_provider || 'email'}</span></td>
                  <td>{fmt(u.created_at)}</td>
                  <td className="ap-ts">{fmt(u.last_login)}</td>
                  <td className="ap-ts">{fmt(u.last_logout)}</td>
                  <td><button className="ap-btn ap-btn--danger ap-btn--sm" onClick={() => setConfirm(u.id)}>Delete</button></td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan={7} className="ap-empty-cell">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} onChange={p => load(p)} />
    </div>
  );
}

// ── LAWS TAB (shared for BNS + IPC) ──────────────────────────────────────────
function LawsTab({ token, source, toast }) {
  const [laws,    setLaws]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);   // null | 'add' | law-object
  const [confirm, setConfirm] = useState(null);

  const endpoint = source === 'bns' ? `${API}/laws` : `${API}/ipc-laws`;

  const load = useCallback((p = 1, q = search) => {
    setLoading(true);
    fetch(`${endpoint}?page=${p}&limit=20&search=${encodeURIComponent(q)}`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => { setLaws(d.laws || []); setTotal(d.total || 0); setPages(d.pages || 1); setPage(p); })
      .finally(() => setLoading(false));
  }, [token, source, search, endpoint]);

  useEffect(() => { setSearch(''); load(1, ''); }, [source]);

  const handleSave = async (form) => {
    const isEdit = modal && modal !== 'add';
    const url    = isEdit ? `${endpoint}/${modal.id}` : endpoint;
    const method = isEdit ? 'PUT' : 'POST';
    const res    = await fetch(url, { method, headers: authHeaders(token), body: JSON.stringify(form) });
    const data   = await res.json();
    toast(data.message || (res.ok ? 'Saved' : 'Error'), res.ok ? 'success' : 'error');
    if (res.ok) { setModal(null); load(page); }
  };

  const handleDelete = async id => {
    const res  = await fetch(`${endpoint}/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    const data = await res.json();
    toast(data.message || 'Deleted', res.ok ? 'success' : 'error');
    if (res.ok) load(page);
    setConfirm(null);
  };

  const label = source === 'bns' ? 'BNS Section' : 'IPC Section';
  const secKey = source === 'bns' ? 'bns_section' : 'ipc_section';

  return (
    <div className="ap-tab-content">
      {confirm && <ConfirmDialog msg={`Delete this ${source.toUpperCase()} law permanently?`} onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />}
      {modal && <LawModal law={modal === 'add' ? null : modal} source={source} onSave={handleSave} onClose={() => setModal(null)} />}

      <div className="ap-toolbar">
        <input className="ap-search" placeholder={`Search ${source.toUpperCase()} laws…`} value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1, search)} />
        <button className="ap-btn ap-btn--outline" onClick={() => load(1, search)}>Search</button>
        <span className="ap-total">{total} laws</span>
        <button className="ap-btn ap-btn--primary ap-ml-auto" onClick={() => setModal('add')}>+ Add {source.toUpperCase()} Law</button>
      </div>

      {loading ? <div className="ap-loading">Loading…</div> : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead><tr>
              <th>{label}</th><th>Title</th><th>Category</th><th>Bailable</th><th>Punishment</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {laws.map(law => (
                <tr key={law.id}>
                  <td><span className={`ap-badge ap-badge--${source}`}>{law[secKey] || law.section_number || '—'}</span></td>
                  <td className="ap-law-title">{law.title}</td>
                  <td>{law.category || law.chapter || '—'}</td>
                  <td>{law.bailable || '—'}</td>
                  <td className="ap-punishment">{(law.punishment || '—').slice(0, 60)}{(law.punishment || '').length > 60 ? '…' : ''}</td>
                  <td className="ap-actions">
                    <button className="ap-btn ap-btn--outline ap-btn--sm" onClick={() => setModal(law)}>Edit</button>
                    <button className="ap-btn ap-btn--danger  ap-btn--sm" onClick={() => setConfirm(law.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!laws.length && <tr><td colSpan={6} className="ap-empty-cell">No laws found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} onChange={p => load(p)} />
    </div>
  );
}

// ── REVIEWS TAB ───────────────────────────────────────────────────────────────
function ReviewsTab({ token, toast }) {
  const [reviews, setReviews] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [ratingF, setRatingF] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback((p = 1, q = search, r = ratingF) => {
    setLoading(true);
    fetch(`${API}/reviews?page=${p}&limit=20&search=${encodeURIComponent(q)}&rating=${r}`, { headers: authHeaders(token) })
      .then(res => res.json())
      .then(d => { setReviews(d.reviews || []); setTotal(d.total || 0); setPages(d.pages || 1); setPage(p); })
      .finally(() => setLoading(false));
  }, [token, search, ratingF]);

  useEffect(() => { load(); }, [token]);

  const handleDelete = async id => {
    const res  = await fetch(`${API}/reviews/${id}`, { method: 'DELETE', headers: authHeaders(token) });
    const data = await res.json();
    toast(data.message || 'Deleted', res.ok ? 'success' : 'error');
    if (res.ok) load(page);
    setConfirm(null);
  };

  const handleToggleFeatured = async (r) => {
    const next = !r.featured;
    const res  = await fetch(`${API}/reviews/${r.id}/feature`, {
      method: 'PATCH',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: next }),
    });
    const data = await res.json();
    if (res.ok) {
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, featured: next } : x));
      toast(next ? 'Review featured on showcase' : 'Review unfeatured', 'success');
    } else {
      toast(data.detail || 'Failed to update', 'error');
    }
  };

  return (
    <div className="ap-tab-content">
      {confirm && <ConfirmDialog msg="Delete this review permanently?" onConfirm={() => handleDelete(confirm)} onCancel={() => setConfirm(null)} />}
      <div className="ap-toolbar">
        <input className="ap-search" placeholder="Search reviews…" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1, search)} />
        <select className="ap-select" value={ratingF} onChange={e => { setRatingF(+e.target.value); load(1, search, +e.target.value); }}>
          <option value={0}>All Ratings</option>
          {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Star</option>)}
        </select>
        <span className="ap-total">{total} reviews</span>
      </div>
      {loading ? <div className="ap-loading">Loading…</div> : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead><tr><th>Name</th><th>Rating</th><th>Review</th><th>Role</th><th>Date</th><th>Featured</th><th>Action</th></tr></thead>
            <tbody>
              {reviews.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td><StarRating n={r.rating} /></td>
                  <td className="ap-review-text">{r.text}</td>
                  <td>{r.role || '—'}</td>
                  <td>{fmt(r.created_at)}</td>
                  <td>
                    <button
                      className={`ap-btn ap-btn--sm ${r.featured ? 'ap-btn--success' : 'ap-btn--outline'}`}
                      onClick={() => handleToggleFeatured(r)}
                      title={r.featured ? 'Shown on public showcase — click to unfeature' : 'Not shown publicly — click to feature on showcase'}
                    >
                      {r.featured ? '★ Featured' : '☆ Feature'}
                    </button>
                  </td>
                  <td><button className="ap-btn ap-btn--danger ap-btn--sm" onClick={() => setConfirm(r.id)}>Delete</button></td>
                </tr>
              ))}
              {!reviews.length && <tr><td colSpan={7} className="ap-empty-cell">No reviews found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} onChange={p => load(p)} />
    </div>
  );
}

// ── QUERIES TAB ────────────────────────────────────────────────────────────────
function QueriesTab({ token }) {
  const [queries, setQueries] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback((p = 1, q = search) => {
    setLoading(true);
    fetch(`${API}/queries?page=${p}&limit=30&search=${encodeURIComponent(q)}`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => { setQueries(d.queries || []); setTotal(d.total || 0); setPages(d.pages || 1); setPage(p); })
      .finally(() => setLoading(false));
  }, [token, search]);

  useEffect(() => { load(); }, [token]);

  return (
    <div className="ap-tab-content">
      <div className="ap-toolbar">
        <input className="ap-search" placeholder="Search queries…" value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1, search)} />
        <button className="ap-btn ap-btn--outline" onClick={() => load(1, search)}>Search</button>
        <span className="ap-total">{total} queries</span>
      </div>
      {loading ? <div className="ap-loading">Loading…</div> : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead><tr><th>Question</th><th>Mode</th><th>Language</th><th>User</th><th>Date</th></tr></thead>
            <tbody>
              {queries.map(q => (
                <tr key={q.id}>
                  <td className="ap-query-q">{q.question}</td>
                  <td><span className="ap-badge ap-badge--mode">{q.mode || 'rag'}</span></td>
                  <td>{q.language || 'English'}</td>
                  <td>{q.email || '—'}</td>
                  <td>{fmt(q.timestamp || q.created_at)}</td>
                </tr>
              ))}
              {!queries.length && <tr><td colSpan={5} className="ap-empty-cell">No queries found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pages={pages} onChange={p => load(p)} />
    </div>
  );
}

// ── PLATFORM TAB ───────────────────────────────────────────────────────────────
function PlatformTab({ token, toast }) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch(`${API}/platform-status`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => setEnabled(d.enabled))
      .finally(() => setLoading(false));
  }, [token]);

  const handleToggle = async () => {
    if (!window.confirm(`${enabled ? 'Disable' : 'Enable'} the platform? This affects ALL users.`)) return;
    setToggling(true);
    const res  = await fetch(`${API}/platform/toggle`, { method: 'POST', headers: authHeaders(token) });
    const data = await res.json();
    setEnabled(data.enabled);
    toast(data.message, res.ok ? 'success' : 'error');
    setToggling(false);
  };

  if (loading) return <div className="ap-loading">Loading…</div>;

  return (
    <div className="ap-tab-content">
      <div className="ap-platform-card">
        <div className={`ap-platform-status ${enabled ? 'ap-platform-status--on' : 'ap-platform-status--off'}`}>
          <span className="ap-platform-dot" />
          <span className="ap-platform-label">{enabled ? 'Platform is LIVE' : 'Platform is DOWN'}</span>
        </div>
        <p className="ap-platform-desc">
          {enabled
            ? 'All users can access Vidhan AI normally. Toggle below to enable maintenance mode.'
            : 'Maintenance mode is ON. All non-admin API calls return 503. Users see a maintenance message.'}
        </p>
        <button
          className={`ap-btn ap-platform-btn ${enabled ? 'ap-btn--danger' : 'ap-btn--primary'}`}
          onClick={handleToggle}
          disabled={toggling}
        >
          {toggling ? 'Updating…' : enabled ? '🔴 Stop Platform (Maintenance Mode)' : '🟢 Start Platform (Go Live)'}
        </button>
        <div className="ap-platform-warn">
          ⚠️ Stopping the platform will block ALL user-facing endpoints. Admin panel remains accessible.
        </div>
      </div>
    </div>
  );
}

// ── MAIN ADMIN PANEL ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'users',     label: '👥 Users' },
  { id: 'bns',       label: '📗 BNS Laws' },
  { id: 'ipc',       label: '📘 IPC Laws' },
  { id: 'reviews',   label: '⭐ Reviews' },
  { id: 'queries',   label: '💬 Queries' },
  { id: 'platform',  label: '⚙️ Platform' },
];

export default function AdminPanel() {
  const [token,  setToken]  = useState(() => localStorage.getItem('vidhan_admin_token') || '');
  const [name,   setName]   = useState(() => localStorage.getItem('vidhan_admin_name')  || 'Admin');
  const [tab,    setTab]    = useState('dashboard');
  const [toast,  setToast]  = useState({ msg: '', type: 'success' });

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  const handleLogin = (tok, n) => { setToken(tok); setName(n); };

  const handleLogout = () => {
    localStorage.removeItem('vidhan_admin_token');
    localStorage.removeItem('vidhan_admin_name');
    setToken('');
  };

  if (!token) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="ap-root">
      <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: 'success' })} />

      {/* Sidebar */}
      <aside className="ap-sidebar">
        <div className="ap-sidebar-brand">
          <span className="ap-sidebar-logo">⚖️</span>
          <span className="ap-sidebar-name">Vidhan Admin</span>
        </div>
        <nav className="ap-nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`ap-nav-item ${tab === t.id ? 'ap-nav-item--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ap-sidebar-footer">
          <span className="ap-admin-name">👤 {name}</span>
          <button className="ap-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      {/* Main */}
      <main className="ap-main">
        <div className="ap-main-header">
          <h1 className="ap-main-title">{TABS.find(t => t.id === tab)?.label}</h1>
        </div>

        {tab === 'dashboard' && <DashboardTab  token={token} />}
        {tab === 'users'     && <UsersTab      token={token} toast={showToast} />}
        {tab === 'bns'       && <LawsTab       token={token} source="bns" toast={showToast} />}
        {tab === 'ipc'       && <LawsTab       token={token} source="ipc" toast={showToast} />}
        {tab === 'reviews'   && <ReviewsTab    token={token} toast={showToast} />}
        {tab === 'queries'   && <QueriesTab    token={token} />}
        {tab === 'platform'  && <PlatformTab   token={token} toast={showToast} />}
      </main>
    </div>
  );
}
