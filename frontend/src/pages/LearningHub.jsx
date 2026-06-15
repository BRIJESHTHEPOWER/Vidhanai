import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ModeSelector from '../components/ModeSelector';
import Footer from '../components/Footer';
import './LearningHub.css';

const API = 'http://localhost:8000';

const CATEGORIES = [
  { key: null,                          label: 'All Topics',       icon: '🔍' },
  { key: 'crimes_against_body',         label: 'Body Crimes',      icon: '🩺' },
  { key: 'crimes_against_women',        label: "Women's Rights",   icon: '👩' },
  { key: 'crimes_against_property',     label: 'Property',         icon: '🏠' },
  { key: 'crimes_against_children',     label: 'Child Safety',     icon: '🧒' },
  { key: 'cyber_crimes',                label: 'Cyber Crime',      icon: '💻' },
  { key: 'public_order',                label: 'Public Order',     icon: '🏛️' },
  { key: 'offences_against_reputation', label: 'Reputation',       icon: '🗣️' },
  { key: 'rights_during_arrest',        label: 'Arrest Rights',    icon: '⚖️' },
];

/* ── Topic Card ── */
function TopicCard({ topic, onSelect, onQuiz }) {
  return (
    <div
      className="hub-card"
      style={{ '--cat-color': topic.category_color }}
      id={`topic-${topic.ipc_section}`}
    >
      {/* Header */}
      <div className="hub-card-header">
        <span className="hub-card-emoji">{topic.category_icon}</span>
        <div className="hub-card-meta">
          <span className="hub-card-ipc">{topic.display_code || 'IPC'} {topic.display_section || topic.ipc_section}</span>
          <span className="hub-card-cat">{topic.category_label}</span>
        </div>
        <div
          className={`hub-card-badge ${topic.bailable ? 'hub-card-badge--bail' : 'hub-card-badge--nobail'}`}
          title={topic.bailable ? 'Bailable' : 'Non-Bailable'}
        >
          {topic.bailable ? 'Bailable' : 'Non-Bailable'}
        </div>
      </div>

      {/* Title */}
      <h3 className="hub-card-title">{topic.title}</h3>

      {/* Excerpt — truncate on card for readability */}
      <p className="hub-card-desc">
        {topic.simple_explanation
          ? topic.simple_explanation.slice(0, 110) + (topic.simple_explanation.length > 110 ? '…' : '')
          : ''}
      </p>

      {/* Punishment */}
      <div className="hub-card-punishment">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        {topic.punishment}
      </div>

      {/* Keywords */}
      <div className="hub-card-keywords">
        {topic.keywords.slice(0, 3).map(k => (
          <span key={k} className="hub-kw">{k}</span>
        ))}
      </div>

      {/* Mode Buttons */}
      <div className="hub-card-modes">
        <button
          className="hub-mode-btn hub-mode-btn--learn"
          onClick={() => onSelect(topic, 'learn')}
          id={`btn-learn-${topic.ipc_section}`}
        >
          <span>🎭</span> Learn
        </button>
        {/* Quiz now opens the dedicated /quiz page */}
        <button
          className="hub-mode-btn hub-mode-btn--quiz"
          onClick={() => onQuiz(topic.ipc_section)}
          id={`btn-quiz-${topic.ipc_section}`}
        >
          <span>📝</span> Quiz
        </button>
        <button
          className="hub-mode-btn hub-mode-btn--explore"
          onClick={() => onSelect(topic, 'explore')}
          id={`btn-explore-${topic.ipc_section}`}
        >
          <span>📖</span> Explore
        </button>
      </div>
    </div>
  );
}

/* ── Skeleton loader ── */
function SkeletonCard() {
  return (
    <div className="hub-card hub-card--skeleton">
      <div className="skel skel-row" />
      <div className="skel skel-title" />
      <div className="skel skel-line" />
      <div className="skel skel-line skel-line--short" />
      <div className="skel skel-btns" />
    </div>
  );
}

export default function LearningHub() {
  const [topics, setTopics]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeCategory, setCategory] = useState(null);
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState(null); // { topic, mode }
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const url = activeCategory
      ? `${API}/learn/topics?category=${activeCategory}`
      : `${API}/learn/topics`;
    fetch(url)
      .then(r => r.json())
      .then(data => { setTopics(data.topics || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [activeCategory]);

  const handleSelect = (topic, mode) => setSelected({ topic, mode });
  const handleClose  = () => setSelected(null);
  // Quiz navigates to dedicated /quiz page
  const handleQuiz   = (ipc_section) => navigate(`/quiz?section=${ipc_section}`);

  const filtered = topics.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.ipc_section.includes(search) ||
    t.keywords.some(k => k.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="hub-root">
      <Navbar />

      <main className="hub-main">
        {/* Hero */}
        <div className="hub-hero">
          <div className="hub-hero-bg" />
          <div className="hub-hero-orb hub-hero-orb--1" />
          <div className="hub-hero-orb hub-hero-orb--2" />
          <div className="hub-hero-content">
            <div className="hub-hero-label">
              <span className="hub-hero-dot" />
              Interactive Legal Learning
            </div>
            <h1 className="hub-hero-title">
              Learn Indian Law <span className="gradient-text">Interactively</span>
            </h1>
            <p className="hub-hero-sub">
              Choose any topic → Pick your learning mode → Understand the law in minutes.
            </p>

            {/* Search */}
            <div className="hub-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                id="hub-search-input"
                type="text"
                placeholder="Search by law name, IPC section, or keyword…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button className="hub-search-clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>
          </div>
        </div>

        {/* Category filter */}
        <div className="hub-categories">
          <div className="container">
            <div className="hub-cat-scroll">
              {CATEGORIES.map(cat => (
                <button
                  key={String(cat.key)}
                  className={`hub-cat-btn${activeCategory === cat.key ? ' hub-cat-btn--active' : ''}`}
                  onClick={() => setCategory(cat.key)}
                  id={`cat-${cat.key || 'all'}`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="container">
          <div className="hub-stats-row">
            <div className="hub-stat-chip">
              <span className="hub-stat-num">{topics.length}</span>
              <span className="hub-stat-lbl">Laws Available</span>
            </div>
            <div className="hub-stat-chip">
              <span className="hub-stat-num">3</span>
              <span className="hub-stat-lbl">Learning Modes</span>
            </div>
            <div className="hub-stat-chip">
              <span className="hub-stat-num">AI</span>
              <span className="hub-stat-lbl">Powered</span>
            </div>
            {search && (
              <div className="hub-stat-chip hub-stat-chip--result">
                <span className="hub-stat-num">{filtered.length}</span>
                <span className="hub-stat-lbl">Results for "{search}"</span>
              </div>
            )}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="hub-grid">
              {Array(9).fill(0).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="hub-empty">
              <div className="hub-empty-icon">🔍</div>
              <h3>No results found</h3>
              <p>Try a different search term or category</p>
              <button className="btn btn-outline" onClick={() => { setSearch(''); setCategory(null); }}>
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="hub-grid">
              {filtered.map(topic => (
                <TopicCard
                  key={topic.ipc_section}
                  topic={topic}
                  onSelect={handleSelect}
                  onQuiz={handleQuiz}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mode guide */}
        <div className="hub-mode-guide container">
          <h2 className="hub-mode-guide-title">How to Learn with Vidhan.ai</h2>
          <div className="hub-mode-guide-grid">
            {[
              { icon: '🎭', title: 'Learn — Scenario', color: '#6366f1',
                steps: ['Pick any law topic', 'A real-life story unfolds step by step', 'See how police, courts, and victims are involved', 'Understand the outcome and IPC section'] },
              { icon: '📝', title: 'Quiz — Test Yourself', color: '#06b6d4',
                steps: ['10 auto-generated questions from the law dataset', '4 options per question (A/B/C/D)', 'Immediate feedback + explanation after each answer', 'See your final score at the end'] },
              { icon: '📖', title: 'Explore — Full Law', color: '#8b5cf6',
                steps: ['See the complete legal text', 'Understand IPC vs BNS difference', 'Key terms are highlighted', 'Ask AI for any follow-up question'] },
            ].map(m => (
              <div key={m.title} className="hub-guide-card" style={{ '--g-color': m.color }}>
                <div className="hub-guide-icon">{m.icon}</div>
                <h3 className="hub-guide-title">{m.title}</h3>
                <ol className="hub-guide-steps">
                  {m.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />

      {/* Mode Selector overlay */}
      {selected && (
        <ModeSelector
          topic={selected.topic}
          initialMode={selected.mode}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
