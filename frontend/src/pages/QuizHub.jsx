/**
 * QuizHub — /quiz
 * Standalone knowledge-testing hub.
 * One card per law (BNS 2023 / IPC 1860). Each quiz asks up to
 * 10 shuffled questions drawn from the whole law's dataset, with already-seen
 * questions excluded so nothing repeats across attempts.
 */
import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import QuizMode from '../components/QuizMode';
import Footer from '../components/Footer';
import './QuizHub.css';

const QUIZZES = [
  {
    key: 'bns_only',
    label: 'BNS 2023',
    icon: '🟢',
    color: '#22c55e',
    badge: 'Current Law',
    sections: '358 sections',
    desc: 'The Bharatiya Nyaya Sanhita 2023 — India\'s current criminal law. Sections, chapters, offences, and punishments.',
  },
  {
    key: 'ipc_only',
    label: 'IPC 1860',
    icon: '📚',
    color: '#ef4444',
    badge: 'Historical',
    sections: '511 sections',
    desc: 'The Indian Penal Code 1860 — the original criminal law. Sections, chapters, offences, and punishments.',
  },
];

/* ── Stats Banner ── */
function StatsBanner() {
  return (
    <div className="qh-stats">
      <div className="qh-stat">
        {/* IPC 1860 officially has 511 sections; the dataset's 577 documents
            include sub-sections (120A, 120B, …) stored as separate entries. */}
        <span className="qh-stat-num" style={{ color: '#ef4444' }}>511</span>
        <span className="qh-stat-lbl">IPC 1860 Sections</span>
      </div>
      <div className="qh-stat">
        <span className="qh-stat-num" style={{ color: '#22c55e' }}>358</span>
        <span className="qh-stat-lbl">BNS 2023 Sections</span>
      </div>
      <div className="qh-stat">
        <span className="qh-stat-num">10</span>
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
  const [active, setActive] = useState(null);

  /* ── Active Quiz View ── */
  if (active) {
    return (
      <QuizMode
        topic={active}
        onBack={() => setActive(null)}
        onClose={() => setActive(null)}
      />
    );
  }

  /* ── Quiz Picker ── */
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
            Questions generated from the real IPC 1860 &amp; BNS 2023 dataset ·
            10 shuffled MCQs per quiz · No repeats · Instant feedback
          </p>

          {/* How it works */}
          <div className="qh-how-it-works" style={{ marginTop: '30px' }}>
            {[
              { step: '1', label: 'Pick IPC or BNS' },
              { step: '2', label: 'Answer 10 Questions' },
              { step: '3', label: 'Review Your Score' },
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

        {/* ── One card per law ── */}
        <div className="qh-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {QUIZZES.map(q => (
            <div
              key={q.key}
              className="qh-topic-card"
              style={{ '--cat-color': q.color, borderTop: `4px solid ${q.color}` }}
            >
              <div className="qh-topic-header">
                <span className="qh-topic-emoji" style={{ fontSize: '2.5rem', background: 'transparent' }}>{q.icon}</span>
                <div className="qh-topic-badges">
                  <span
                    className="qh-ipc-badge"
                    style={{ background: `${q.color}22`, color: q.color, border: `1px solid ${q.color}55` }}
                  >
                    {q.badge}
                  </span>
                </div>
              </div>

              <h3 className="qh-topic-title" style={{ fontSize: '1.4rem', marginTop: '10px' }}>
                {q.label} Quiz
              </h3>

              <p className="qh-topic-desc" style={{ fontSize: '0.95rem', minHeight: '72px' }}>
                {q.desc}
              </p>

              <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 12px' }}>
                {q.sections} · 10 questions · shuffled, no repeats
              </p>

              <button
                className="qh-start-btn"
                onClick={() => setActive({ category: '', title: q.label, quizMode: q.key })}
                style={{ background: `linear-gradient(135deg, ${q.color}22, transparent)`, borderColor: `${q.color}44` }}
              >
                <span>{q.icon}</span>
                Start {q.label} Quiz
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
              { icon: '📚', title: 'Dataset Questions', desc: 'All questions are generated from the real IPC 1860 and BNS 2023 dataset — not hallucinated.' },
              { icon: '⏱️', title: '20s Timer',         desc: 'Each question has a 20-second countdown. An unanswered question counts as wrong.' },
              { icon: '🔍', title: 'Review Answers',    desc: 'After each answer, read the full explanation grounded in real IPC/BNS section data.' },
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
