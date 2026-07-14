import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import './sections.css';

const COLORS = ['#6366f1','#06b6d4','#22c55e','#f59e0b','#ef4444','#a78bfa'];
const getColor = (str) => COLORS[(str || '?').charCodeAt(0) % COLORS.length];

export default function ReviewsPanel() {
  const [data, setData]         = useState({ reviews: [], total: 0, pages: 1 });
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [ratingFilter, setRatingFilter] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [featuring, setFeaturing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.reviews(page, 20, search, ratingFilter);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, ratingFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchVal); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchVal]);

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete review by "${name}"?`)) return;
    setDeleting(id);
    try {
      await api.deleteReview(id);
      setData(d => ({ ...d, reviews: d.reviews.filter(r => r.id !== id), total: d.total - 1 }));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleFeature(id, current) {
    const next = !current;
    setFeaturing(id);
    try {
      await api.featureReview(id, next);
      setData(d => ({ ...d, reviews: d.reviews.map(r => r.id === id ? { ...r, featured: next } : r) }));
    } catch (e) {
      alert(e.message);
    } finally {
      setFeaturing(null);
    }
  }

  return (
    <div>
      <div className="sec-header">
        <h1 className="sec-title">Reviews</h1>
        <p className="sec-sub">Moderate and manage all user reviews</p>
      </div>

      <div className="panel-box">
        <div className="panel-box-header">
          <span className="panel-box-title">
            All Reviews
            <span className="adm-badge adm-badge--cyan" style={{ marginLeft: 10 }}>{data.total}</span>
          </span>
          <div className="adm-toolbar">
            <div className="adm-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input placeholder="Search reviews..." value={searchVal} onChange={e => setSearchVal(e.target.value)} />
            </div>
            <select className="adm-select" value={ratingFilter} onChange={e => { setRatingFilter(+e.target.value); setPage(1); }}>
              <option value={0}>All Ratings</option>
              {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} Stars</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /><p>Loading reviews...</p></div>
        ) : data.reviews.length === 0 ? (
          <div className="adm-empty"><div className="adm-empty-icon">⭐</div><h3>No reviews found</h3></div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="adm-table">
                <thead>
                  <tr><th>Author</th><th>Rating</th><th>Review</th><th>Role</th><th>Date</th><th>Homepage</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {data.reviews.map(r => {
                    const color    = getColor(r.name);
                    const initials = (r.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    const date     = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="adm-cell-user">
                            <div className="adm-avatar" style={{ background: `linear-gradient(135deg, ${color}cc, ${color}44)` }}>{initials}</div>
                            <span className="adm-cell-name">{r.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="adm-stars">
                            {[1,2,3,4,5].map(s => <span key={s} className={`adm-star${s <= r.rating ? ' adm-star--on' : ''}`}>★</span>)}
                          </div>
                        </td>
                        <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                          <span title={r.text}>"{r.text}"</span>
                        </td>
                        <td>
                          {r.role
                            ? <span className="adm-badge adm-badge--indigo">{r.role}</span>
                            : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>
                          }
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{date}</td>
                        <td>
                          <button
                            className="adm-feature-btn"
                            onClick={() => handleToggleFeature(r.id, r.featured)}
                            disabled={featuring === r.id}
                            title={r.featured ? 'Shown on homepage — click to remove' : 'Not shown publicly — click to show on homepage'}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                              cursor: featuring === r.id ? 'default' : 'pointer',
                              border: `1px solid ${r.featured ? '#f59e0b' : 'var(--border, rgba(255,255,255,0.12))'}`,
                              background: r.featured ? 'rgba(245,158,11,0.15)' : 'transparent',
                              color: r.featured ? '#f59e0b' : 'var(--text-faint)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {featuring === r.id
                              ? <div className="adm-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                              : <>{r.featured ? '★ Featured' : '☆ Feature'}</>
                            }
                          </button>
                        </td>
                        <td>
                          <button
                            className="adm-delete-btn"
                            onClick={() => handleDelete(r.id, r.name)}
                            disabled={deleting === r.id}
                          >
                            {deleting === r.id
                              ? <div className="adm-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="adm-pagination">
              <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</span>
              <div className="adm-pagination-btns">
                <button className="adm-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                {Array.from({ length: Math.min(data.pages, 5) }, (_, i) => i + 1).map(p => (
                  <button key={p} className={`adm-pag-btn${p === page ? ' adm-pag-btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="adm-pag-btn" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
