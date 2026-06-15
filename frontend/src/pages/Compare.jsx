/**
 * Compare.jsx — /compare
 * IPC 1860 vs BNS 2023 live comparison powered by RAG + Groq.
 * Design matches the VidhanAI screenshot: dark theme, bullet panels, sidebar.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './Compare.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const QUICK_CHIPS = [
  { label: 'All',              q: '',                    icon: '⚖️' },
  { label: 'Murder',           q: 'murder',              icon: '⚔️' },
  { label: 'Theft',            q: 'theft',               icon: '🎭' },
  { label: 'Rape',             q: 'rape',                icon: '🛡️' },
  { label: 'Fraud / Cheating', q: 'cheating fraud',      icon: '🎪' },
  { label: 'Domestic Violence',q: 'domestic violence',   icon: '🏠' },
  { label: 'Stalking',         q: 'stalking',            icon: '👁️' },
  { label: 'Kidnapping',       q: 'kidnapping',          icon: '🚨' },
  { label: 'Extortion',        q: 'extortion',           icon: '💰' },
  { label: 'Cybercrime',       q: 'cyber crime',         icon: '💻' },
  { label: 'Poisoning',        q: 'poisoning',           icon: '☠️' },
];

const ICON_MAP = {
  message: '💬',
  people:  '👥',
  clock:   '⏰',
  shield:  '🛡️',
  scale:   '⚖️',
  star:    '⭐',
  check:   '✅',
};

const ICON_COLOR = {
  message: '#3b82f6',
  people:  '#f97316',
  clock:   '#8b5cf6',
  shield:  '#0ea5e9',
  scale:   '#22c55e',
  star:    '#eab308',
  check:   '#10b981',
};

export default function Compare() {
  const [searchParams] = useSearchParams();
  const initialTopic = searchParams.get('topic') || 'murder';
  const [query,      setQuery]      = useState('');
  const [activeChip, setActiveChip] = useState(initialTopic);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [searched,   setSearched]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    doSearch(initialTopic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSearch = async (q) => {
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setResult(null);
    try {
      const res  = await fetch(`${BASE_URL}/compare-search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setResult(data.ipc_section !== 'N/A' || data.bns_section !== 'N/A' ? data : null);
    } catch {
      setResult(null);
    }
    setLoading(false);
  };

  const handleChip = (chip) => {
    if (!chip.q) {
      setActiveChip('');
      setQuery('');
      doSearch('murder');
      setActiveChip('murder');
      return;
    }
    setQuery(chip.label);
    setActiveChip(chip.q);
    doSearch(chip.q);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      setActiveChip(q.toLowerCase());
      doSearch(q);
    }
  };

  return (
    <div className="vcmp-root">
      <Navbar />

      {/* ── Hero ── */}
      <section className="vcmp-hero">
        <div className="vcmp-orb vcmp-orb-1" />
        <div className="vcmp-orb vcmp-orb-2" />
        <div className="vcmp-orb vcmp-orb-3" />

        <div className="vcmp-hero-inner">
          <div className="vcmp-live-pill">
            <span className="vcmp-live-dot" />
            LIVE COMPARISON
          </div>

          <h1 className="vcmp-title">
            IPC 1860 <span className="vcmp-vs-word">vs</span>{' '}
            <span className="vcmp-bns-grad">BNS 2023</span>
          </h1>

          <p className="vcmp-subtitle">
            See exactly how India's criminal law has evolved. Compare the old Indian Penal Code
            with the new Bharatiya Nyaya Sanhita — what changed, what's better, what's new.
          </p>

          {/* Search */}
          <form className="vcmp-form" onSubmit={handleSubmit}>
            <div className="vcmp-searchbar">
              <svg className="vcmp-search-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="vcmp-input"
                type="text"
                placeholder='Search a crime or law e.g. "murder", "theft", "rape"…'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" className="vcmp-clear" onClick={() => setQuery('')}>✕</button>
              )}
              <button type="submit" className="vcmp-compare-btn" disabled={loading}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 6 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Compare
              </button>
            </div>
          </form>

          {/* Quick chips */}
          <div className="vcmp-chips">
            {QUICK_CHIPS.map((c, i) => (
              <button
                key={c.q || 'all'}
                className={`vcmp-chip${activeChip === c.q ? ' vcmp-chip-active' : ''}`}
                onClick={() => handleChip(c)}
              >
                {i === 0 && (
                  <span className="vcmp-chip-count">{QUICK_CHIPS.length - 1}</span>
                )}
                <span className="vcmp-chip-icon">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="vcmp-body">

        {loading && (
          <div className="vcmp-loading">
            <div className="vcmp-spinner" />
            <p className="vcmp-loading-text">Analysing laws with AI…</p>
          </div>
        )}

        {!loading && result && (
          <ComparisonResult result={result} navigate={navigate} />
        )}

        {!loading && searched && !result && (
          <div className="vcmp-empty">
            <div className="vcmp-empty-icon">⚖️</div>
            <h3>No comparison found</h3>
            <p>Try a different search term or select a chip above.</p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

// ── Comparison Result ──────────────────────────────────────────────────────────
function ComparisonResult({ result, navigate }) {
  return (
    <div className="vcmp-result">

      {/* ── Main Grid: [IPC | VS | BNS] + [Sidebar] ── */}
      <div className="vcmp-main-grid">

        {/* Panels */}
        <div className="vcmp-panels">

          {/* IPC 1860 */}
          <div className="vcmp-panel vcmp-panel-ipc">
            <div className="vcmp-panel-hd vcmp-panel-hd-ipc">
              <div className="vcmp-book-icon vcmp-book-icon-ipc">📚</div>
              <div>
                <div className="vcmp-law-name vcmp-law-name-ipc">IPC 1860</div>
                <div className="vcmp-law-full">Indian Penal Code, 1860</div>
              </div>
            </div>

            <div className="vcmp-sec-label vcmp-sec-label-ipc">
              Section {result.ipc_section} – {result.ipc_title}
            </div>

            <ul className="vcmp-bullets">
              {(result.ipc_bullets || []).map((b, i) => (
                <li key={i} className="vcmp-bullet">
                  <span className="vcmp-dot vcmp-dot-ipc">●</span>
                  <span>
                    <strong className="vcmp-bullet-label">{b.label}:</strong>{' '}
                    <span className="vcmp-bullet-val">{b.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* VS Divider */}
          <div className="vcmp-vs-col">
            <div className="vcmp-vs-bubble">VS</div>
          </div>

          {/* BNS 2023 */}
          <div className="vcmp-panel vcmp-panel-bns">
            <div className="vcmp-panel-hd vcmp-panel-hd-bns">
              <div className="vcmp-book-icon vcmp-book-icon-bns">📗</div>
              <div>
                <div className="vcmp-law-name vcmp-law-name-bns">BNS 2023</div>
                <div className="vcmp-law-full">Bharatiya Nyaya Sanhita, 2023</div>
              </div>
            </div>

            <div className="vcmp-sec-label vcmp-sec-label-bns">
              Section {result.bns_section} – {result.bns_title}
            </div>

            <ul className="vcmp-bullets">
              {(result.bns_bullets || []).map((b, i) => (
                <li key={i} className="vcmp-bullet">
                  <span className="vcmp-dot vcmp-dot-bns">✓</span>
                  <span>
                    <strong className="vcmp-bullet-label">{b.label}:</strong>{' '}
                    <span className="vcmp-bullet-val">{b.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* What Changed Sidebar */}
        <div className="vcmp-sidebar">
          <h3 className="vcmp-sidebar-title">What Changed?</h3>
          <div className="vcmp-sidebar-list">
            {(result.what_changed || []).map((item, i) => (
              <div key={i} className="vcmp-change-row">
                <div
                  className="vcmp-change-icon"
                  style={{
                    background: `${ICON_COLOR[item.icon] || '#6366f1'}20`,
                    border: `1px solid ${ICON_COLOR[item.icon] || '#6366f1'}40`,
                  }}
                >
                  {ICON_MAP[item.icon] || '⚖️'}
                </div>
                <div className="vcmp-change-body">
                  <div className="vcmp-change-title">{item.title}</div>
                  <div className="vcmp-change-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="vcmp-stats">
        {[
          { icon: '📚', num: '511', label: 'Sections in IPC 1860', color: '#ef4444' },
          { icon: '📗', num: '358', label: 'Sections in BNS 2023', color: '#22c55e' },
          { icon: '⚖️', num: '25+', label: 'Major Structural Changes', color: '#8b5cf6' },
          { icon: '🛡️', num: '100%', label: 'Future Ready Law',     color: '#6366f1' },
        ].map((s) => (
          <div key={s.label} className="vcmp-stat">
            <div className="vcmp-stat-icon">{s.icon}</div>
            <div className="vcmp-stat-num" style={{ color: s.color }}>{s.num}</div>
            <div className="vcmp-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Example Comparison ── */}
      <div className="vcmp-example">
        <div className="vcmp-example-left">
          <span className="vcmp-example-icon">⚖️</span>
          <div>
            <div className="vcmp-example-tag">Example Comparison</div>
          </div>
        </div>

        <div className="vcmp-example-ipc">
          <div className="vcmp-example-law" style={{ color: '#ef4444' }}>IPC 1860</div>
          <div className="vcmp-example-sec">Section 378 – Theft</div>
          <div className="vcmp-example-desc">Whoever, intending to take dishonestly any movable property...</div>
        </div>

        <div className="vcmp-example-arrows">›‹›</div>

        <div className="vcmp-example-bns">
          <div className="vcmp-example-law" style={{ color: '#22c55e' }}>BNS 2023</div>
          <div className="vcmp-example-sec">Section 303 – Theft</div>
          <div className="vcmp-example-desc">Whoever dishonestly moves any movable property...</div>
        </div>

        <button
          className="vcmp-example-btn"
          onClick={() => navigate('/compare-detail/303?ipc=378')}
        >
          View Full Comparison →
        </button>
      </div>

    </div>
  );
}
