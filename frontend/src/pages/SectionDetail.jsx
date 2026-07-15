/**
 * SectionDetail — /section/:id
 * L3: Proper breadcrumb navigation
 * A3: SkeletonExploreLaw loading state
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { SkeletonExploreLaw } from '../components/Skeleton';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const CATEGORY_LABELS = {
  crimes_against_body:         '🩸 Body Crime',
  crimes_against_women:        '👩 Women Safety',
  crimes_against_property:     '🏛️ Property Crime',
  crimes_against_children:     '🧒 Child Protection',
  cyber_crimes:                '💻 Cyber Crime',
  rights_during_arrest:        '⚖️ Arrest Rights',
  public_order:                '🟡 Public Order',
  offences_against_reputation: '🗣️ Reputation',
  general_provisions:          '📜 General Law',
};

// ── L3: Breadcrumb component ──────────────────────────────────────────────────
function Breadcrumb({ law }) {
  const categoryLabel = law ? (CATEGORY_LABELS[law.category] || law.category) : null;
  return (
    <nav className="sd-breadcrumb" aria-label="Breadcrumb">
      <ol className="sd-breadcrumb-list">
        <li>
          <Link to="/" className="sd-breadcrumb-link">Home</Link>
          <span className="sd-breadcrumb-sep" aria-hidden="true">›</span>
        </li>
        {law?.category && (
          <li>
            <Link to={`/?category=${law.category}`} className="sd-breadcrumb-link">
              {categoryLabel}
            </Link>
            <span className="sd-breadcrumb-sep" aria-hidden="true">›</span>
          </li>
        )}
        <li>
          <span className="sd-breadcrumb-current" aria-current="page">
            {law ? `IPC ${law.ipc_section} — ${law.title}` : 'Loading…'}
          </span>
        </li>
      </ol>
    </nav>
  );
}

export default function SectionDetail() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const [law,   setLaw]   = useState(null);
  const [error, setError] = useState(false);
  const [user,  setUser]  = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('vidhan_token');
    const name  = localStorage.getItem('vidhan_user');
    if (token && name) setUser({ name, token });
  }, []);

  useEffect(() => {
    if (!id) return;
    setLaw(null);
    setError(false);
    fetch(`${BASE_URL}/get-section/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(data => {
        setLaw(data);
        // Update page title for SEO
        document.title = `IPC ${data.ipc_section} — ${data.title} | Vidhan.ai`;
      })
      .catch(() => {
        setError(true);
        document.title = 'Section Not Found | Vidhan.ai';
      });
  }, [id]);

  const handleLogout = () => {
    localStorage.removeItem('vidhan_token');
    localStorage.removeItem('vidhan_user');
    setUser(null);
  };

  if (error) {
    return (
      <div className="page-wrap">
        <Navbar user={user} onLogout={handleLogout} />
        <div className="container section-detail" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⚖️</div>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.75rem' }}>Section Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            The requested law section could not be found in the database.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="action-chip primary" onClick={() => navigate(-1)}>
              ← Go Back
            </button>
            <Link to="/" className="action-chip">
              Search Laws
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!law) {
    return (
      <div className="page-wrap">
        <Navbar user={user} onLogout={handleLogout} />
        {/* A3: Skeleton loading state */}
        <div className="container section-detail" style={{ paddingTop: '1.5rem' }}>
          {/* Skeleton breadcrumb */}
          <div className="sd-breadcrumb" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="sk-bar" style={{ width: '50px', height: '12px' }} />
              <span style={{ color: 'var(--text-faint)' }}>›</span>
              <div className="sk-bar" style={{ width: '80px', height: '12px' }} />
              <span style={{ color: 'var(--text-faint)' }}>›</span>
              <div className="sk-bar" style={{ width: '160px', height: '12px' }} />
            </div>
          </div>
          <SkeletonExploreLaw />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="container section-detail">

        {/* L3: Breadcrumb */}
        <Breadcrumb law={law} />

        {/* Back + actions row */}
        <div className="sd-back-row">
          <button className="sd-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
          <div className="sd-back-actions">
            <Link to={`/?q=${encodeURIComponent(law.title)}`} className="sd-action-link">
              🤖 Ask AI
            </Link>
            <Link to="/compare" className="sd-action-link">
              ⚖️ Compare
            </Link>
          </div>
        </div>

        {/* Header card */}
        <div className="detail-card" style={{ marginBottom: '1.5rem' }}>
          <div className="detail-card-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
              <div>
                <div className="law-sections" style={{ marginBottom: '0.6rem' }}>
                  {law.ipc_section && (
                    <span className="section-badge badge-ipc" style={{ fontSize: '1rem', padding: '0.35rem 0.9rem' }}>
                      IPC {law.ipc_section}
                    </span>
                  )}
                  {law.bns_section && !String(law.bns_section).startsWith('IT') && (
                    <span className="section-badge badge-bns" style={{ fontSize: '1rem', padding: '0.35rem 0.9rem' }}>
                      BNS {law.bns_section}
                    </span>
                  )}
                </div>
                <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 800, color: 'var(--text)' }}>
                  {law.title}
                </h1>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {law.category && (
                  <span style={{
                    fontSize: '0.8rem', padding: '0.3rem 0.8rem',
                    borderRadius: 20, background: 'rgba(59,130,246,0.1)',
                    color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)'
                  }}>
                    {CATEGORY_LABELS[law.category] || law.category}
                  </span>
                )}
                {law.bailable !== undefined && (
                  <span className={`bail-chip ${law.bailable ? 'bail-yes' : 'bail-no'}`}
                    style={{ fontSize: '0.82rem' }}>
                    {law.bailable ? '✓ Bailable' : '✗ Non-Bailable'}
                  </span>
                )}
                {law.cognizable !== undefined && (
                  <span className={`bail-chip ${law.cognizable ? 'cog-yes' : ''}`}
                    style={!law.cognizable ? { background: 'rgba(148,163,184,0.1)', color: 'var(--text-dim)' } : {}}>
                    {law.cognizable ? '🔍 Cognizable' : '○ Non-Cognizable'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="detail-card-body">
            {/* Simple explanation */}
            {law.simple_explanation && (
              <div style={{
                background: 'var(--primary-faint)',
                border: '1px solid var(--border-strong)',
                borderLeft: '4px solid var(--primary)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                marginBottom: '1.75rem'
              }}>
                <div className="detail-label" style={{ color: 'var(--primary)', marginBottom: '0.4rem' }}>
                  💡 Simple Explanation (What this means for you)
                </div>
                <p style={{ fontSize: '1rem', color: 'var(--text)', lineHeight: 1.7 }}>
                  {law.simple_explanation}
                </p>
              </div>
            )}

            {/* Punishment comparison */}
            <div className="punishment-compare" style={{ marginBottom: '1.5rem' }}>
              <div className="punishment-box punit-ipc">
                <div className="punit-label">IPC Punishment (Old Law)</div>
                <div className="punit-val" style={{ fontSize: '0.95rem', color: 'var(--old-law)', fontWeight: 600 }}>
                  {law.punishment}
                </div>
              </div>
              <div className="punishment-box punit-bns">
                <div className="punit-label">BNS Punishment (New Law)</div>
                <div className="punit-val" style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {law.bns_punishment || law.punishment}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* IPC vs BNS description */}
        <div className="compare-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="compare-panel ipc-panel">
            <div className="compare-panel-label label-ipc">
              📜 IPC – Indian Penal Code 1860
            </div>
            <div className="compare-field">
              <div className="compare-field-label">Full Legal Text</div>
              <div className="compare-field-val">{law.description}</div>
            </div>
          </div>
          <div className="compare-panel bns-panel">
            <div className="compare-panel-label label-bns">
              🟢 BNS – Bharatiya Vidhan Sanhita 2023
            </div>
            <div className="compare-field">
              <div className="compare-field-label">Full Legal Text</div>
              <div className="compare-field-val">{law.bns_description || law.description}</div>
            </div>
          </div>
        </div>

        {/* Differences */}
        {law.differences && (
          <div className="differences-box" style={{ marginBottom: '1.5rem' }}>
            <div className="diff-label">🔄 Key Differences: IPC → BNS</div>
            <div className="diff-text">{law.differences}</div>
          </div>
        )}

        {/* Real-life example */}
        {law.real_life_example && (
          <div className="example-card" style={{ marginBottom: '1.5rem' }}>
            <div className="detail-label" style={{ color: 'var(--primary)', marginBottom: '0.4rem' }}>
              📖 Real-Life Example
            </div>
            <p style={{ fontSize: '0.93rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              {law.real_life_example}
            </p>
          </div>
        )}

        {/* Keywords */}
        {law.keywords?.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div className="detail-label" style={{ marginBottom: '0.6rem' }}>🏷️ Keywords</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {law.keywords.map(k => (
                <Link
                  key={k}
                  to={`/?q=${encodeURIComponent(k)}`}
                  style={{
                    padding: '0.3rem 0.75rem',
                    borderRadius: 20,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    transition: 'all 0.2s',
                    textDecoration: 'none'
                  }}
                >
                  #{k}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related laws */}
        {law.related_laws?.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div className="detail-label" style={{ marginBottom: '0.6rem' }}>🔗 Related Laws</div>
            <div className="related-laws-row">
              {law.related_laws.map(r => (
                <Link key={r} to={`/section/${r}`} className="related-chip">
                  {r}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          textAlign: 'center',
          marginBottom: '3rem'
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Want a detailed AI explanation of this law?
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to={`/?q=${encodeURIComponent(law.title)}`} className="action-chip primary">
              🤖 Ask AI About This Law
            </Link>
            <Link to="/compare" className="action-chip">
              ⚖️ Compare More Laws
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
