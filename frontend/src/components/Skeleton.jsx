/**
 * M6: Skeleton loader components for async data states.
 * Used in LearnMode, QuizMode, ExploreMode, and any card grids.
 */
import React from 'react';
import './Skeleton.css';

/* ── Single shimmer bar ── */
export function SkeletonBar({ width = '100%', height = '14px', style = {} }) {
  return (
    <div
      className="sk-bar"
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/* ── Card-shaped skeleton (for law cards, topic cards) ── */
export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="sk-card" aria-hidden="true">
      <div className="sk-card-header">
        <SkeletonBar width="60px" height="12px" />
        <SkeletonBar width="80px" height="12px" />
      </div>
      <SkeletonBar width="75%" height="18px" style={{ marginBottom: '12px' }} />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBar key={i} width={i % 2 === 0 ? '100%' : '85%'} height="12px" style={{ marginBottom: '8px' }} />
      ))}
      <div className="sk-card-footer">
        <SkeletonBar width="90px" height="32px" style={{ borderRadius: '8px' }} />
        <SkeletonBar width="70px" height="32px" style={{ borderRadius: '8px' }} />
      </div>
    </div>
  );
}

/* ── Grid of skeleton cards ── */
export function SkeletonCardGrid({ count = 6 }) {
  return (
    <div className="sk-grid" aria-busy="true" aria-label="Loading content…">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} rows={2} />
      ))}
    </div>
  );
}

/* ── Scenario / Learn step skeleton ── */
export function SkeletonLearnStep() {
  return (
    <div className="sk-learn" aria-hidden="true">
      {/* Step pills */}
      <div className="sk-pills">
        {[1, 2, 3, 4].map(i => (
          <SkeletonBar key={i} width="80px" height="32px" style={{ borderRadius: '20px' }} />
        ))}
      </div>
      {/* Step card */}
      <div className="sk-step-card">
        <div className="sk-step-header">
          <SkeletonBar width="44px" height="44px" style={{ borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <SkeletonBar width="40%" height="12px" style={{ marginBottom: '8px' }} />
            <SkeletonBar width="65%" height="18px" />
          </div>
        </div>
        <SkeletonBar width="100%" height="12px" style={{ marginBottom: '8px' }} />
        <SkeletonBar width="95%" height="12px" style={{ marginBottom: '8px' }} />
        <SkeletonBar width="80%" height="12px" style={{ marginBottom: '8px' }} />
        <SkeletonBar width="90%" height="12px" />
      </div>
    </div>
  );
}

/* ── Quiz question skeleton ── */
export function SkeletonQuizQuestion() {
  return (
    <div className="sk-quiz" aria-hidden="true">
      {/* Progress bar */}
      <SkeletonBar width="100%" height="4px" style={{ borderRadius: '2px', marginBottom: '16px' }} />
      <SkeletonBar width="30%" height="12px" style={{ marginBottom: '20px' }} />
      {/* Question text */}
      <SkeletonBar width="90%" height="20px" style={{ marginBottom: '8px' }} />
      <SkeletonBar width="70%" height="20px" style={{ marginBottom: '24px' }} />
      {/* Options */}
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="sk-option">
          <SkeletonBar width="28px" height="28px" style={{ borderRadius: '6px', flexShrink: 0 }} />
          <SkeletonBar width={`${55 + i * 8}%`} height="14px" />
        </div>
      ))}
    </div>
  );
}

/* ── Explore law detail skeleton ── */
export function SkeletonExploreLaw() {
  return (
    <div className="sk-explore" aria-hidden="true">
      <div className="sk-explore-hero">
        <SkeletonBar width="50px" height="20px" style={{ borderRadius: '10px', marginBottom: '12px' }} />
        <SkeletonBar width="70%" height="28px" style={{ marginBottom: '12px' }} />
        <SkeletonBar width="50%" height="14px" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="sk-explore-section">
          <SkeletonBar width="30%" height="14px" style={{ marginBottom: '10px' }} />
          <SkeletonBar width="100%" height="12px" style={{ marginBottom: '6px' }} />
          <SkeletonBar width="90%" height="12px" style={{ marginBottom: '6px' }} />
          <SkeletonBar width="75%" height="12px" />
        </div>
      ))}
    </div>
  );
}
