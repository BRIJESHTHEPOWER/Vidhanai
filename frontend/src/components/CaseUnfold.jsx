import React, { useState } from 'react';
import './CaseUnfold.css';

const PHASE_META = {
  'Incident':      { color: '#f59e0b', emoji: '🔍', label: 'Incident' },
  'Police Action': { color: '#3b82f6', emoji: '👮', label: 'Police Action' },
  'Law Applied':   { color: '#8b5cf6', emoji: '⚖️', label: 'Law Applied' },
  'Outcome':       { color: '#22c55e', emoji: '🏛️', label: 'Outcome' },
};

function resolvePhase(step) {
  // Normalise phase names from LLM
  const p = (step.phase || '').trim();
  if (/incident/i.test(p))      return 'Incident';
  if (/police|authorit/i.test(p)) return 'Police Action';
  if (/law|applied|section/i.test(p)) return 'Law Applied';
  if (/outcome|verdict|result/i.test(p)) return 'Outcome';
  return p || `Step ${step.step}`;
}

// Animated step progress connector
function StepRail({ steps, activeIdx, onSelect }) {
  return (
    <div className="cu-rail">
      {steps.map((s, i) => {
        const phase = resolvePhase(s);
        const meta  = PHASE_META[phase] || { color: '#6366f1', emoji: s.icon || '📌', label: phase };
        const done  = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={i} className="cu-rail-item" onClick={() => onSelect(i)}>
            <div
              className={`cu-rail-dot${active ? ' cu-rail-dot--active' : ''}${done ? ' cu-rail-dot--done' : ''}`}
              style={{ '--phase-color': meta.color }}
            >
              {done
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                : <span>{meta.emoji}</span>
              }
            </div>
            <span
              className={`cu-rail-label${active ? ' cu-rail-label--active' : ''}`}
              style={active ? { color: meta.color } : {}}
            >
              {meta.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`cu-rail-line${done ? ' cu-rail-line--done' : ''}`}
                   style={done ? { background: meta.color } : {}} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LawBadge({ law }) {
  if (!law) return null;
  const bail = law.bailable === true ? '✅ Bailable' : law.bailable === false ? '🚫 Non-Bailable' : null;
  return (
    <div className="cu-law-badge">
      <div className="cu-law-badge-sections">
        {law.ipc_section && (
          <span className="cu-section-chip cu-section-chip--ipc">IPC {law.ipc_section}</span>
        )}
        {law.bns_section && (
          <span className="cu-section-chip cu-section-chip--bns">BNS {law.bns_section}</span>
        )}
      </div>
      <div className="cu-law-badge-title">{law.title}</div>
      <div className="cu-law-badge-row">
        {law.punishment && (
          <span className="cu-law-badge-pill">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            {law.punishment.length > 50 ? law.punishment.slice(0, 50) + '…' : law.punishment}
          </span>
        )}
        {bail && <span className="cu-law-badge-pill">{bail}</span>}
      </div>
    </div>
  );
}

export default function CaseUnfold({ data, isLoading }) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (isLoading) {
    return (
      <div className="cu-root cu-loading">
        <div className="cu-loading-inner">
          <div className="cu-loading-icon">🔍</div>
          <div>
            <div className="cu-loading-title">Unfolding the Case…</div>
            <div className="cu-loading-sub">Generating step-by-step legal procedure</div>
          </div>
        </div>
        <div className="cu-skeleton-rail">
          {[1,2,3,4].map(i => <div key={i} className="cu-skeleton-dot" style={{ animationDelay: `${i * 0.15}s` }} />)}
        </div>
      </div>
    );
  }

  if (!data?.found || !data.steps?.length) return null;

  const steps  = data.steps;
  const step   = steps[activeIdx];
  const phase  = resolvePhase(step);
  const meta   = PHASE_META[phase] || { color: '#6366f1', emoji: step.icon || '📌', label: phase };
  const isLast = activeIdx === steps.length - 1;
  const isFirst = activeIdx === 0;

  return (
    <div className="cu-root">
      {/* Header strip */}
      <div className="cu-header">
        <div className="cu-header-left">
          <span className="cu-header-icon">📋</span>
          <span className="cu-header-title">Case Procedure</span>
          <span className="cu-header-badge">
            {data.law?.ipc_section ? `IPC ${data.law.ipc_section}` : 'Legal Steps'}
          </span>
        </div>
        <div className="cu-header-counter">
          Step {activeIdx + 1} / {steps.length}
        </div>
      </div>

      {/* Law quick-info */}
      <LawBadge law={data.law} />

      {/* Step rail */}
      <StepRail steps={steps} activeIdx={activeIdx} onSelect={setActiveIdx} />

      {/* Active step card */}
      <div
        className="cu-card"
        key={activeIdx}
        style={{ '--card-color': meta.color }}
      >
        {/* Color accent bar */}
        <div className="cu-card-bar" style={{ background: meta.color }} />

        {/* Phase chip + title */}
        <div className="cu-card-head">
          <div className="cu-card-emoji"
               style={{ background: `${meta.color}18`, border: `1.5px solid ${meta.color}44` }}>
            {meta.emoji}
          </div>
          <div>
            <div className="cu-card-phase" style={{ color: meta.color }}>
              {meta.label}
            </div>
            <div className="cu-card-title">{step.title || `Step ${activeIdx + 1}`}</div>
          </div>
        </div>

        {/* Story text */}
        <p className="cu-card-story">{step.story || step.text || 'No details available.'}</p>

        {/* IPC ref */}
        {step.ipc_ref && (
          <div className="cu-card-ipc">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            Applied: <strong>IPC {step.ipc_ref}</strong>
          </div>
        )}

        {/* Nav buttons */}
        <div className="cu-card-nav">
          <button
            className="cu-nav-btn"
            onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
            disabled={isFirst}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            Previous
          </button>

          {/* Dot indicators */}
          <div className="cu-nav-dots">
            {steps.map((_, i) => (
              <button
                key={i}
                className={`cu-dot${i === activeIdx ? ' cu-dot--active' : ''}`}
                style={i === activeIdx ? { background: meta.color, boxShadow: `0 0 6px ${meta.color}` } : {}}
                onClick={() => setActiveIdx(i)}
              />
            ))}
          </div>

          <button
            className="cu-nav-btn cu-nav-btn--next"
            style={!isLast ? { background: meta.color, borderColor: meta.color } : {}}
            onClick={() => setActiveIdx(i => Math.min(steps.length - 1, i + 1))}
            disabled={isLast}
          >
            {isLast ? 'Complete ✓' : 'Next Step'}
            {!isLast && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>}
          </button>
        </div>
      </div>

      <p className="cu-footer-hint">
        Click any step above to jump directly · Powered by Vidhan.ai
      </p>
    </div>
  );
}
