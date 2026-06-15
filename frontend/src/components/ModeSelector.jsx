import React, { useState } from 'react';
import LearnMode from './LearnMode';
import QuizMode from './QuizMode';
import ExploreMode from './ExploreMode';
import './ModeSelector.css';

const MODES = [
  {
    key: 'learn',
    icon: '🎭',
    title: 'Learn with Scenario',
    desc: 'Follow a real-life story step-by-step. Watch how the law unfolds in a realistic situation.',
    color: '#6366f1',
    badge: 'Story-Based',
    highlights: ['4-step scenario', 'Simple language', 'IPC highlighted', 'Ask AI follow-up'],
  },
  {
    key: 'quiz',
    icon: '📝',
    title: 'Take a Quiz',
    desc: 'Test your knowledge with auto-generated MCQ questions. Get instant feedback and explanations.',
    color: '#06b6d4',
    badge: 'Interactive',
    highlights: ['10 questions', 'A/B/C/D options', 'Score tracking', 'Explanations'],
  },
  {
    key: 'explore',
    icon: '📖',
    title: 'Explore Full Law',
    desc: 'Read the complete legal text with IPC vs BNS comparison, key terms highlighted, and AI explanations.',
    color: '#8b5cf6',
    badge: 'Deep Dive',
    highlights: ['Full legal text', 'IPC vs BNS', 'Key terms', 'Explain Simply'],
  },
];

export default function ModeSelector({ topic, initialMode, onClose }) {
  const [activeMode, setActiveMode] = useState(initialMode || null);

  if (activeMode === 'learn') {
    return (
      <LearnMode
        topic={topic}
        onBack={() => setActiveMode(null)}
        onClose={onClose}
      />
    );
  }
  if (activeMode === 'quiz') {
    return (
      <QuizMode
        topic={topic}
        onBack={() => setActiveMode(null)}
        onClose={onClose}
      />
    );
  }
  if (activeMode === 'explore') {
    return (
      <ExploreMode
        topic={topic}
        onBack={() => setActiveMode(null)}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="ms-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ms-panel">
        {/* Header */}
        <div className="ms-header">
          <div className="ms-header-info">
            <span className="ms-header-ipc">IPC {topic.ipc_section}</span>
            <h2 className="ms-header-title">{topic.title}</h2>
            <p className="ms-header-sub">Choose how you want to learn this topic</p>
          </div>
          <button className="ms-close" onClick={onClose} id="mode-selector-close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Mode Cards */}
        <div className="ms-modes">
          {MODES.map(mode => (
            <button
              key={mode.key}
              className="ms-mode-card"
              style={{ '--mode-color': mode.color }}
              onClick={() => setActiveMode(mode.key)}
              id={`mode-select-${mode.key}`}
            >
              <div className="ms-mode-top">
                <span className="ms-mode-icon">{mode.icon}</span>
                <span className="ms-mode-badge">{mode.badge}</span>
              </div>
              <h3 className="ms-mode-title">{mode.title}</h3>
              <p className="ms-mode-desc">{mode.desc}</p>
              <div className="ms-mode-highlights">
                {mode.highlights.map(h => (
                  <span key={h} className="ms-highlight">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                    {h}
                  </span>
                ))}
              </div>
              <div className="ms-mode-arrow">
                Start →
                <div className="ms-mode-glow" />
              </div>
            </button>
          ))}
        </div>

        {/* Punishment quick view */}
        <div className="ms-footer-info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Punishment under IPC {topic.ipc_section}:</span>
          <strong>{topic.punishment}</strong>
          <span className={`ms-bail-badge ${topic.bailable ? 'ms-bail-badge--yes' : 'ms-bail-badge--no'}`}>
            {topic.bailable ? 'Bailable' : 'Non-Bailable'}
          </span>
        </div>
      </div>
    </div>
  );
}
