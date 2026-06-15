/**
 * CaseScenarioInline.jsx
 * Shared inline "case unfold" renderer — a step-by-step scenario for any
 * BNS/IPC section. Used by Ask AI (Visualize Case) and Explore Mode.
 *
 * Props:
 *   data = { found, law: {title, bns_section, ipc_section, punishment}, steps: [...] }
 */
import React, { useState } from 'react';
import './CaseScenarioInline.css';

export default function CaseScenarioInline({ data }) {
  const [step, setStep] = useState(0);
  const steps = data?.steps || [];
  const law = data?.law || {};
  if (!steps.length) return null;

  const cur = steps[Math.min(step, steps.length - 1)] || {};
  const lawRef = [
    law.bns_section ? `BNS ${law.bns_section}` : '',
    law.ipc_section ? `IPC ${law.ipc_section}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="csi">
      <div className="csi-head">
        <span className="csi-icon">🎬</span>
        <div className="csi-head-text">
          <div className="csi-title">{law.title || 'Case Walkthrough'}</div>
          {(lawRef || law.punishment) && (
            <div className="csi-sub">
              {lawRef}{law.punishment ? `${lawRef ? ' — ' : ''}${law.punishment}` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="csi-tabs">
        {steps.map((s, i) => (
          <button
            key={i}
            className={`csi-tab${i === step ? ' csi-tab--active' : ''}${i < step ? ' csi-tab--done' : ''}`}
            onClick={() => setStep(i)}
          >
            <span className="csi-tab-num">{s.icon || i + 1}</span>
            <span className="csi-tab-label">{s.phase}</span>
          </button>
        ))}
      </div>

      <div className="csi-panel">
        <div className="csi-panel-phase">{cur.icon} {cur.phase}</div>
        <div className="csi-panel-title">{cur.title}</div>
        <p className="csi-panel-story">{cur.story || cur.text}</p>
        {cur.ipc_ref && <div className="csi-panel-ref">⚖️ Section {cur.ipc_ref}</div>}
      </div>

      <div className="csi-nav">
        <button className="csi-nav-btn" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>← Previous</button>
        <span className="csi-nav-count">{step + 1} / {steps.length}</span>
        <button className="csi-nav-btn csi-nav-btn--primary" onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1}>Next Step →</button>
      </div>
    </div>
  );
}
