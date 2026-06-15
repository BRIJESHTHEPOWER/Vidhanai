import React from 'react';
import './sections.css';

const COLORS = ['#6366f1','#06b6d4','#22c55e','#f59e0b','#ef4444','#a78bfa','#ec4899'];

function getColor(str) {
  if (!str) return COLORS[0];
  return COLORS[str.charCodeAt(0) % COLORS.length];
}

export default function Overview({ stats }) {
  if (!stats) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  const cards = [
    {
      label: 'Total Users',
      value: stats.total_users,
      icon: '👥',
      color: '#6366f1',
      trend: stats.new_users_week > 0 ? `+${stats.new_users_week} this week` : null,
    },
    {
      label: 'Total Reviews',
      value: stats.total_reviews,
      icon: '⭐',
      color: '#06b6d4',
      trend: `${stats.avg_rating} avg rating`,
    },
    {
      label: 'AI Queries',
      value: stats.total_queries,
      icon: '💬',
      color: '#22c55e',
      trend: 'Lifetime total',
    },
    {
      label: 'Laws in DB',
      value: stats.total_laws,
      icon: '📚',
      color: '#f59e0b',
      trend: 'IPC + BNS',
    },
  ];

  return (
    <div>
      <div className="sec-header">
        <h1 className="sec-title">Dashboard Overview</h1>
        <p className="sec-sub">Real-time statistics for Vidhan.ai</p>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {cards.map((c, i) => (
          <div className="stat-card" key={c.label} style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="stat-card-glow" style={{ background: `radial-gradient(circle, ${c.color}, transparent 70%)` }} />
            <div className="stat-card-icon" style={{ background: `${c.color}18`, border: `1px solid ${c.color}30` }}>
              {c.icon}
            </div>
            <div className="stat-card-value gradient-text">{c.value.toLocaleString()}</div>
            <div className="stat-card-label">{c.label}</div>
            {c.trend && <span className="stat-card-trend stat-card-trend--up">{c.trend}</span>}
          </div>
        ))}
      </div>

      <div className="sec-grid-2">
        {/* Rating distribution */}
        <div className="panel-box">
          <div className="panel-box-header">
            <span className="panel-box-title">⭐ Rating Distribution</span>
            <span className="adm-badge adm-badge--cyan">{stats.avg_rating} avg</span>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[5, 4, 3, 2, 1].map(s => {
              const count = stats.rating_dist?.[String(s)] || 0;
              const pct = stats.total_reviews > 0 ? (count / stats.total_reviews * 100) : 0;
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-faint)', width: 32, textAlign: 'right', flexShrink: 0 }}>{s} ★</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--surface)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #06b6d4)', borderRadius: 9999, transition: 'width 0.8s var(--ease)' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-faint)', width: 28, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Laws by category */}
        <div className="panel-box">
          <div className="panel-box-header">
            <span className="panel-box-title">📚 Laws by Category</span>
            <span className="adm-badge adm-badge--indigo">{stats.total_laws} total</span>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(stats.laws_by_category || {}).slice(0, 6).map(([cat, count], i) => {
              const color = COLORS[i % COLORS.length];
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent reviews */}
      <div className="panel-box">
        <div className="panel-box-header">
          <span className="panel-box-title">🕒 Recent Reviews</span>
          <span className="adm-badge adm-badge--green">Live</span>
        </div>
        {stats.recent_reviews?.length === 0 ? (
          <div className="adm-empty"><div className="adm-empty-icon">💬</div><h3>No reviews yet</h3></div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr><th>User</th><th>Rating</th><th>Review</th><th>Date</th></tr>
            </thead>
            <tbody>
              {stats.recent_reviews?.map((r, i) => {
                const color = getColor(r.name);
                const initials = (r.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <tr key={i}>
                    <td>
                      <div className="adm-cell-user">
                        <div className="adm-avatar" style={{ background: `linear-gradient(135deg, ${color}cc, ${color}55)` }}>{initials}</div>
                        <span className="adm-cell-name">{r.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="adm-stars">
                        {[1,2,3,4,5].map(s => <span key={s} className={`adm-star${s <= r.rating ? ' adm-star--on' : ''}`}>★</span>)}
                      </div>
                    </td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
