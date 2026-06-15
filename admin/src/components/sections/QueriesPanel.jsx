import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import './sections.css';

export default function QueriesPanel() {
  const [data, setData]           = useState({ queries: [], total: 0, pages: 1 });
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [loading, setLoading]     = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const userEmail = searchParams.get('email') || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.queries(page, 30, search, userEmail);
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, userEmail]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchVal); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchVal]);

  useEffect(() => { setPage(1); }, [userEmail]);

  const clearUserFilter = () => setSearchParams({});

  return (
    <div>
      <div className="sec-header">
        <h1 className="sec-title">AI Queries</h1>
        <p className="sec-sub">Browse all queries submitted to Vidhan.ai</p>
      </div>

      {userEmail && (
        <div className="adm-filter-banner" style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 16px', borderRadius: 10,
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
          fontSize: 13, color: 'var(--text-muted)',
        }}>
          <span>Showing queries for <strong style={{ color: 'var(--text)' }}>{userEmail}</strong></span>
          <button className="adm-pag-btn" onClick={clearUserFilter}>Show all queries</button>
        </div>
      )}

      <div className="panel-box">
        <div className="panel-box-header">
          <span className="panel-box-title">
            Query Log
            <span className="adm-badge adm-badge--green" style={{ marginLeft: 10 }}>{data.total}</span>
          </span>
          <div className="adm-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input placeholder="Search queries..." value={searchVal} onChange={e => setSearchVal(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /><p>Loading queries...</p></div>
        ) : data.queries.length === 0 ? (
          <div className="adm-empty">
            <div className="adm-empty-icon">💬</div>
            <h3>{userEmail ? `No queries from ${userEmail} yet` : 'No queries logged yet'}</h3>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="adm-table">
                <thead>
                  <tr><th>#</th><th>Question</th><th>Language</th><th>Mode</th><th>Timestamp</th></tr>
                </thead>
                <tbody>
                  {data.queries.map((q, i) => (
                    <tr key={q.id}>
                      <td style={{ color: 'var(--text-faint)', fontSize: 12, width: 40 }}>{(page - 1) * 30 + i + 1}</td>
                      <td style={{ maxWidth: 380 }}>
                        <span title={q.question} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text)' }}>
                          {q.question}
                        </span>
                      </td>
                      <td>
                        {q.language
                          ? <span className="adm-badge adm-badge--cyan">{q.language}</span>
                          : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        {q.mode
                          ? <span className="adm-badge adm-badge--indigo">{q.mode}</span>
                          : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                        {q.created_at ? new Date(q.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-pagination">
              <span>Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, data.total)} of {data.total}</span>
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
