import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import './sections.css';

const COLORS = ['#6366f1','#06b6d4','#22c55e','#f59e0b','#ef4444','#a78bfa'];
const getColor = (str) => COLORS[(str || '?').charCodeAt(0) % COLORS.length];

export default function UsersPanel() {
  const [data, setData]       = useState({ users: [], total: 0, pages: 1 });
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [searchVal, setSearchVal] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.users(page, 20, search);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchVal); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchVal]);

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await api.deleteUser(id);
      setData(d => ({ ...d, users: d.users.filter(u => u.id !== id), total: d.total - 1 }));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="sec-header">
        <h1 className="sec-title">Users</h1>
        <p className="sec-sub">Manage all registered Vidhan.ai users</p>
      </div>

      <div className="panel-box">
        <div className="panel-box-header">
          <span className="panel-box-title">
            All Users
            <span className="adm-badge adm-badge--indigo" style={{ marginLeft: 10 }}>{data.total}</span>
          </span>
          <div className="adm-toolbar">
            <div className="adm-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                placeholder="Search by name or email..."
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /><p>Loading users...</p></div>
        ) : data.users.length === 0 ? (
          <div className="adm-empty"><div className="adm-empty-icon">👤</div><h3>No users found</h3></div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map(u => {
                    const color    = getColor(u.name || u.email);
                    const initials = (u.name || u.email || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    const joined   = u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    return (
                      <tr
                        key={u.id}
                        className="adm-row-clickable"
                        title={`View queries from ${u.name || u.email}`}
                        onClick={() => navigate(`/queries?email=${encodeURIComponent(u.email)}`)}
                      >
                        <td>
                          <div className="adm-cell-user">
                            <div className="adm-avatar" style={{ background: `linear-gradient(135deg, ${color}cc, ${color}44)` }}>{initials}</div>
                            <div className="adm-cell-user-info">
                              <span className="adm-cell-name">{u.name || '—'}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-faint)' }}>{u.email}</td>
                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{joined}</td>
                        <td><span className="adm-badge adm-badge--green">Active</span></td>
                        <td>
                          <button
                            className="adm-delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.name || u.email); }}
                            disabled={deleting === u.id}
                            title="Delete user"
                          >
                            {deleting === u.id
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
