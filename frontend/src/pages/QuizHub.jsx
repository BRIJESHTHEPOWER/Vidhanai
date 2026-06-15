/**
 * QuizHub — /quiz
 * Standalone knowledge-testing hub.
 * Browse by category → pick a topic → take the quiz inline.
 */
import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import QuizMode from '../components/QuizMode';
import Footer from '../components/Footer';
import './QuizHub.css';

const API = 'http://localhost:8000';

const CATEGORIES = [
  { key: 'crimes_against_body',         label: 'Body Crimes',    icon: '🩺', color: '#ef4444', desc: 'Murder, hurt, assault, kidnapping, and other offences affecting human life.' },
  { key: 'crimes_against_women',        label: "Women's Rights", icon: '👩', color: '#ec4899', desc: 'Laws protecting women against violence, dowry, stalking, and harassment.' },
  { key: 'crimes_against_property',     label: 'Property',       icon: '🏠', color: '#f59e0b', desc: 'Theft, extortion, robbery, dacoity, criminal misappropriation, and mischief.' },
  { key: 'crimes_against_children',     label: 'Child Safety',   icon: '🧒', color: '#8b5cf6', desc: 'Provisions ensuring safety of minors against exploitation and cruelty.' },
  { key: 'cyber_crimes',                label: 'Cyber Crime',    icon: '💻', color: '#06b6d4', desc: 'Offences involving computers, digital fraud, and online identity theft.' },
  { key: 'rights_during_arrest',        label: 'Arrest Rights',  icon: '⚖️', color: '#22c55e', desc: 'Bail, police procedures, and fundamental rights when facing detention.' },
  { key: 'public_order',                label: 'Public Order',   icon: '🏙️', color: '#64748b', desc: 'Unlawful assembly, rioting, public nuisance, and state security.' },
];

const LAW_TABS = [
  {
    key: 'ipc_only',
    label: 'IPC 1860',
    icon: '📚',
    color: '#ef4444',
    badge: 'Historical',
    desc: 'Test your knowledge of the Indian Penal Code 1860 — the original criminal law.',
  },
  {
    key: 'bns_only',
    label: 'BNS 2023',
    icon: '🟢',
    color: '#22c55e',
    badge: 'Current Law',
    desc: 'Test your knowledge of the Bharatiya Nyaya Sanhita 2023 — India\'s new law.',
  },
  {
    key: 'enriched_only',
    label: 'IPC vs BNS',
    icon: '⚖️',
    color: '#6366f1',
    badge: 'Compare',
    desc: 'Compare old IPC with new BNS — cross-reference questions from the dataset.',
  },
];



/* ── Stats Banner ── */
function StatsBanner() {
  return (
    <div className="qh-stats">
      <div className="qh-stat">
        <span className="qh-stat-num" style={{ color: '#ef4444' }}>511</span>
        <span className="qh-stat-lbl">IPC 1860 Sections</span>
      </div>
      <div className="qh-stat">
        <span className="qh-stat-num" style={{ color: '#22c55e' }}>358</span>
        <span className="qh-stat-lbl">BNS 2023 Sections</span>
      </div>
      <div className="qh-stat">
        <span className="qh-stat-num">7</span>
        <span className="qh-stat-lbl">Qs Per Quiz</span>
      </div>
      <div className="qh-stat">
        <span className="qh-stat-num">20s</span>
        <span className="qh-stat-lbl">Per Question</span>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function QuizHub() {
  const [active,      setActive]      = useState(null);
  const [activeTab,   setActiveTab]   = useState('bns_only'); // 'ipc_only' | 'bns_only' | 'enriched_only'

  const currentTab = LAW_TABS.find(t => t.key === activeTab) || LAW_TABS[1];

  const handleStartCategory = (cat) => {
    setActive({ category: cat.key, title: cat.label, quizMode: activeTab });
  };

  /* ── Active Quiz View ── */
  if (active) {
    return (
      <QuizMode
        topic={{ ...active, quizMode: activeTab }}
        onBack={() => setActive(null)}
        onClose={() => setActive(null)}
      />
    );
  }

  /* ── Topic Browser ── */
  return (
    <div className="qh-root">
      <Navbar />

      {/* ── Hero ── */}
      <section className="qh-hero">
        <div className="qh-hero-orb qh-hero-orb--1" />
        <div className="qh-hero-orb qh-hero-orb--2" />
        <div className="qh-hero-orb qh-hero-orb--3" />
        <div className="qh-hero-content">
          <div className="qh-hero-pill">
            <span className="qh-hero-dot" />
            Dataset-Powered Legal Quiz Engine
          </div>
          <h1 className="qh-hero-title">
            Test Your <span className="qh-gradient-text">Legal Knowledge</span>
          </h1>
          <p className="qh-hero-sub">
            Questions generated from real IPC 1860 &amp; BNS 2023 dataset ·
            7 MCQs per topic · Instant feedback · Score tracking
          </p>

          {/* How it works */}
          <div className="qh-how-it-works" style={{ marginTop: '30px' }}>
            {[
              { step: '1', label: 'Pick IPC or BNS' },
              { step: '2', label: 'Choose a Topic' },
              { step: '3', label: 'Answer 7 Questions' },
            ].map(s => (
              <div key={s.step} className="qh-step">
                <div className="qh-step-num">{s.step}</div>
                <div className="qh-step-lbl">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="qh-body">
        {/* Stats */}
        <StatsBanner />

        {/* ── Law Tabs ── */}
        <div className="qh-law-tabs">
          {LAW_TABS.map(tab => (
            <button
              key={tab.key}
              className={`qh-law-tab${activeTab === tab.key ? ' qh-law-tab--active' : ''}`}
              style={{ '--tab-color': tab.color }}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="qh-law-tab-icon">{tab.icon}</span>
              <div className="qh-law-tab-text">
                <span className="qh-law-tab-label">{tab.label}</span>
                <span
                  className="qh-law-tab-badge"
                  style={{ background: `${tab.color}22`, color: tab.color, border: `1px solid ${tab.color}44` }}
                >
                  {tab.badge}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p className="qh-tab-desc">{currentTab.desc}</p>

        {/* ── Category Cards ── */}
        <div className="qh-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {CATEGORIES.map(cat => (
            <div
              key={cat.key}
              className="qh-topic-card"
              style={{ '--cat-color': cat.color, borderTop: `4px solid ${cat.color}` }}
            >
              <div className="qh-topic-header">
                <span className="qh-topic-emoji" style={{ fontSize: '2.5rem', background: 'transparent' }}>{cat.icon}</span>
                <div className="qh-topic-badges">
                  <span
                    className="qh-ipc-badge"
                    style={{ background: `${currentTab.color}22`, color: currentTab.color, border: `1px solid ${currentTab.color}55` }}
                  >
                    {currentTab.label}
                  </span>
                </div>
              </div>

              <h3 className="qh-topic-title" style={{ fontSize: '1.4rem', marginTop: '10px' }}>{cat.label}</h3>

              <p className="qh-topic-desc" style={{ fontSize: '0.95rem', minHeight: '60px' }}>
                {cat.desc}
              </p>

              <button
                className="qh-start-btn"
                onClick={() => handleStartCategory(cat)}
                style={{ background: `linear-gradient(135deg, ${currentTab.color}22, transparent)`, borderColor: `${currentTab.color}44` }}
              >
                <span>{currentTab.icon}</span>
                Start {currentTab.label} Quiz
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="qh-tips">
          <h2 className="qh-tips-title">Quiz Tips for Better Learning</h2>
          <div className="qh-tips-grid">
            {[
              { icon: '📚', title: 'Dataset Questions', desc: 'All questions are generated from real IPC 1860 and BNS 2023 dataset — not hallucinated.' },
              { icon: '⏱️', title: '20s Timer',         desc: 'Each question has a 20-second countdown. An unanswered question counts as wrong.' },
              { icon: '🔍', title: 'Review Answers',    desc: 'After each answer, read the full explanation grounded in real IPC/BNS section text.' },
              { icon: '⌨️', title: 'Keyboard Shortcuts', desc: 'Press A/B/C/D to answer instantly. Press Enter to go to the next question.' },
            ].map(t => (
              <div key={t.title} className="qh-tip-card">
                <div className="qh-tip-icon">{t.icon}</div>
                <div className="qh-tip-title">{t.title}</div>
                <div className="qh-tip-desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
