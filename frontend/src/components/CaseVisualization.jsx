import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CinematicSectionBackground from './CinematicSectionBackground';
import './CaseVisualization.css';

/* ── Icons ─────────────────────────────────────────────────── */
const icons = {
  alert: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>,
  shield: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  book: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
  send: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m3 11 19-9-9 19-2-8-8-2z"/></svg>,
};

/* ── All Case Scenarios ─────────────────────────────────────── */
const ALL_CASES = [
  {
    id: 'theft',
    label: '🔓 Theft',
    color: '#f59e0b',
    steps: [
      { id: 'incident', label: 'Incident', icon: icons.alert, color: '#f59e0b', title: 'The Incident', desc: 'A person reported their mobile phone worth ₹35,000 was stolen from their pocket in a crowded market. A complaint was filed at the local police station.', ipc: ['303 BNS — Theft'], meta: ['Location: Public Market', 'Value: ₹35,000', 'Reported: Immediately'] },
      { id: 'action', label: 'Police Action', icon: icons.shield, color: '#3b82f6', title: 'Police Investigation', desc: 'FIR registered under BNS 303. CCTV footage analyzed, witnesses recorded. Accused identified within 48 hours using surveillance and informant network.', ipc: ['173 BNSS — FIR', '180 BNSS — Witness Statement'], meta: ['FIR No: 421/2024', 'Time: 48 hrs', 'Evidence: CCTV + Witnesses'] },
      { id: 'law', label: 'Applicable Law', icon: icons.book, color: '#8b5cf6', title: 'Laws Applied', desc: 'BNS 303 (Theft) — punishment up to 3 years. Bail application filed under BNSS (new CrPC equivalent).', ipc: ['303 BNS — Theft (3 yrs)', '480 BNSS — Bail'], meta: ['Max: 3 years', 'Bail: Bailable', 'Court: Magistrate'] },
      { id: 'outcome', label: 'Outcome', icon: icons.send, color: '#22c55e', title: 'Court Verdict', desc: 'Accused convicted under 303 BNS. Sentenced to 1 year imprisonment with fine of ₹5,000. Property recovered and returned to victim.', ipc: ['303 BNS — Convicted'], meta: ['Verdict: Guilty', 'Sentence: 1 Year + ₹5,000', 'Property: Recovered'] },
    ],
  },
  {
    id: 'fraud',
    label: '💸 Fraud',
    color: '#ef4444',
    steps: [
      { id: 'incident', label: 'Incident', icon: icons.alert, color: '#ef4444', title: 'Online Fraud Reported', desc: 'Victim received a fake KYC call. Scammer posed as bank official and obtained OTP, transferring ₹1.8 lakh from victim\'s savings account within minutes.', ipc: ['318 BNS — Cheating'], meta: ['Platform: Phone Call', 'Loss: ₹1.8 Lakh', 'Method: OTP Phishing'] },
      { id: 'action', label: 'Police Action', icon: icons.shield, color: '#3b82f6', title: 'Cyber Cell Investigation', desc: 'Cyber Crime Cell registered FIR. Call records, IP logs and bank transaction trail obtained. Account freeze request raised with RBI Lok Adalat within 24 hours.', ipc: ['63 BSA — Electronic Evidence', '66C IT Act — Identity Theft'], meta: ['Cell: Cyber Crime', 'Account: Frozen', 'Trail: Call Records'] },
      { id: 'law', label: 'Applicable Law', icon: icons.book, color: '#8b5cf6', title: 'Laws Applied', desc: 'BNS 318 (Cheating — up to 7 years). IT Act 66C (Identity theft — up to 3 yrs). Victim can also approach Banking Ombudsman for refund.', ipc: ['318 BNS — Cheating (7 yrs)', '66C IT Act — Identity Theft'], meta: ['Max: 7 years', 'Non-Bailable', 'Court: Sessions'] },
      { id: 'outcome', label: 'Outcome', icon: icons.send, color: '#22c55e', title: 'Court Verdict', desc: 'Accused traced and arrested. Convicted under 318 BNS and 66C IT Act. Sentenced to 3 years and ordered to repay ₹1.8 lakh. Partial amount recovered.', ipc: ['318 BNS — Convicted', '66C IT Act — Convicted'], meta: ['Verdict: Guilty', 'Sentence: 3 Years', 'Compensation: ₹1.8L'] },
    ],
  },
  {
    id: 'assault',
    label: '🤜 Assault',
    color: '#f97316',
    steps: [
      { id: 'incident', label: 'Incident', icon: icons.alert, color: '#f97316', title: 'Physical Assault', desc: 'Victim was attacked by neighbor during a property dispute. Sustained grievous hurt — two rib fractures. Incident occurred inside residential colony at night.', ipc: ['117 BNS — Grievous Hurt'], meta: ['Location: Residential Area', 'Injury: Rib Fractures', 'Time: Night'] },
      { id: 'action', label: 'Police Action', icon: icons.shield, color: '#3b82f6', title: 'Police & Medical', desc: 'FIR registered under 117 BNS. Victim taken to government hospital. Medico-Legal Certificate (MLC) obtained. Accused arrested same night from residence.', ipc: ['117 BNS — FIR Filed', '180 BNSS — Witness Statements'], meta: ['MLC: Obtained', 'Arrest: Same Night', 'Witnesses: 3'] },
      { id: 'law', label: 'Applicable Law', icon: icons.book, color: '#8b5cf6', title: 'Laws Applied', desc: 'BNS 117 — Voluntarily causing grievous hurt, punishment up to 7 years. Bail denied given nature of injury.', ipc: ['117 BNS — Grievous Hurt (7 yrs)', '126 BNS — Wrongful Restraint'], meta: ['Max: 7 years', 'Non-Bailable', 'Court: Sessions'] },
      { id: 'outcome', label: 'Outcome', icon: icons.send, color: '#22c55e', title: 'Court Verdict', desc: 'Accused convicted under 117 BNS. Sentenced to 2 years rigorous imprisonment. Ordered to pay ₹25,000 compensation to victim.', ipc: ['117 BNS — Convicted'], meta: ['Verdict: Guilty', 'Sentence: 2 Years RI', 'Compensation: ₹25,000'] },
    ],
  },
  {
    id: 'domestic',
    label: '🏠 Domestic Violence',
    color: '#ec4899',
    steps: [
      { id: 'incident', label: 'Incident', icon: icons.alert, color: '#ec4899', title: 'Domestic Cruelty', desc: 'Married woman subjected to continuous mental and physical cruelty by husband and in-laws for dowry. Approached police after hospitalization due to physical abuse.', ipc: ['85 BNS — Cruelty'], meta: ['Relation: Husband + In-Laws', 'Duration: 2 Years', 'Trigger: Dowry Demand'] },
      { id: 'action', label: 'Police Action', icon: icons.shield, color: '#3b82f6', title: 'Women Cell Action', desc: 'Women Helpline (181) involved. FIR registered under 85 BNS and Dowry Prohibition Act. Protection order obtained. All accused arrested under non-bailable warrant.', ipc: ['85 BNS — FIR', '3 Dowry Prohibition Act'], meta: ['Helpline: 181 (Women)', 'Order: Protection', 'Arrested: 3 Accused'] },
      { id: 'law', label: 'Applicable Law', icon: icons.book, color: '#8b5cf6', title: 'Laws Applied', desc: 'BNS 85 — Cruelty by husband or relatives (up to 3 years). Dowry Prohibition Act 4 — demanding dowry (up to 5 years). DV Act for protection orders.', ipc: ['85 BNS — Cruelty (3 yrs)', '4 Dowry Act — Demanding Dowry'], meta: ['Max: 5 years', 'Non-Bailable', 'Protection: DV Act'] },
      { id: 'outcome', label: 'Outcome', icon: icons.send, color: '#22c55e', title: 'Court Verdict', desc: 'Husband convicted under 85 BNS. In-laws convicted under Dowry Act 4. Victim granted permanent protection order, maintenance, and custody of children.', ipc: ['85 BNS — Convicted', '4 Dowry Act — Convicted'], meta: ['Verdict: Guilty', 'Maintenance: Granted', 'Custody: Victim'] },
    ],
  },
  {
    id: 'murder',
    label: '⚖️ Murder',
    color: '#dc2626',
    steps: [
      { id: 'incident', label: 'Incident', icon: icons.alert, color: '#dc2626', title: 'Murder Reported', desc: 'Body of a 35-year-old man discovered near a railway track. Post-mortem confirmed death due to blunt force trauma. Family filed complaint suspecting foul play.', ipc: ['101 BNS — Murder'], meta: ['Location: Railway Track', 'Cause: Blunt Force', 'Reported: Family'] },
      { id: 'action', label: 'Police Action', icon: icons.shield, color: '#3b82f6', title: 'Homicide Investigation', desc: 'CID team formed. Post-mortem report analyzed. Mobile location data traced. Key suspect — business rival — identified from call records and CCTV near scene.', ipc: ['101 BNS — Murder FIR', '194 BNSS — Inquest'], meta: ['Team: CID / Homicide', 'Evidence: CCTV + CDR', 'Suspect: Identified'] },
      { id: 'law', label: 'Applicable Law', icon: icons.book, color: '#8b5cf6', title: 'Laws Applied', desc: 'BNS 101 — Murder: Death penalty or life imprisonment. BNS 238 — Causing disappearance of evidence. Sessions Court has jurisdiction.', ipc: ['101 BNS — Murder (Death/Life)', '238 BNS — Evidence Destruction'], meta: ['Punishment: Death/Life', 'Non-Bailable', 'Court: Sessions'] },
      { id: 'outcome', label: 'Outcome', icon: icons.send, color: '#22c55e', title: 'Court Verdict', desc: 'Accused convicted under 101 BNS after 18-month trial. Sentenced to life imprisonment. High Court upheld the conviction on appeal.', ipc: ['101 BNS — Convicted', '238 BNS — Convicted'], meta: ['Verdict: Guilty', 'Sentence: Life Imprisonment', 'Appeal: HC Upheld'] },
    ],
  },
  {
    id: 'cybercrime',
    label: '💻 Cybercrime',
    color: '#06b6d4',
    steps: [
      { id: 'incident', label: 'Incident', icon: icons.alert, color: '#06b6d4', title: 'Hacking & Data Theft', desc: 'A startup\'s database was hacked. Customer personal data of 50,000 users stolen and sold on dark web. Company detected breach after unusual server activity alerts.', ipc: ['66 IT Act — Hacking', '43 IT Act — Damage to Computer'], meta: ['Scale: 50,000 Records', 'Method: SQL Injection', 'Detected: Server Alert'] },
      { id: 'action', label: 'Police Action', icon: icons.shield, color: '#3b82f6', title: 'Cyber Cell & CERT-In', desc: 'CERT-In notified. Cyber Crime Cell seized servers. Digital forensics team extracted logs. Suspect traced to IP address registered in another state.', ipc: ['65 IT Act — Tampering Source Code', '66B IT Act — Stolen Computer Resource'], meta: ['CERT-In: Notified', 'Forensics: Server Logs', 'IP: Traced'] },
      { id: 'law', label: 'Applicable Law', icon: icons.book, color: '#8b5cf6', title: 'Laws Applied', desc: 'IT Act 66 — Hacking (up to 3 years). 43 — Damage/unauthorized access (compensation). BNS 111 — Organized crime may apply if data sold systematically.', ipc: ['66 IT Act — Hacking (3 yrs)', '43 IT Act — Compensation', '66E IT Act — Privacy Violation'], meta: ['Max: 3 years + Fine', 'Non-Bailable', 'Court: Cyber Court'] },
      { id: 'outcome', label: 'Outcome', icon: icons.send, color: '#22c55e', title: 'Court Verdict', desc: 'Accused arrested from another state via transit remand. Convicted under 66 & 66E IT Act. Sentenced to 2 years + ₹5 lakh fine. Company awarded civil damages.', ipc: ['66 IT Act — Convicted', '66E IT Act — Convicted'], meta: ['Verdict: Guilty', 'Sentence: 2 Yrs + ₹5L', 'Civil Damages: Awarded'] },
    ],
  },
];

const API = 'http://localhost:8000';

// Map a /unfold-case response into the visual case format used by this component.
const DYN_ICONS  = [icons.alert, icons.shield, icons.book, icons.send];
const DYN_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#22c55e'];

function buildDynamicCase(resp) {
  const law = resp.law || {};
  const refList = [
    law.bns_section ? `${law.bns_section} BNS` : '',
    law.ipc_section ? `${law.ipc_section} IPC` : '',
  ].filter(Boolean);
  const punishment = law.bns_punishment || law.punishment || '';

  const steps = (resp.steps || []).map((s, i) => {
    const meta = [];
    if (i === 0 && law.category) meta.push(`Category: ${law.category}`);
    if (i === 2 && punishment) meta.push(`Punishment: ${punishment}`);
    if (i === 2 && law.bailable !== undefined && law.bailable !== null) {
      meta.push(law.bailable ? 'Bailable' : 'Non-Bailable');
    }
    return {
      id: (s.phase || `step-${i}`).toLowerCase().replace(/\s+/g, '-'),
      label: s.phase || `Step ${i + 1}`,
      icon: DYN_ICONS[i % DYN_ICONS.length],
      color: DYN_COLORS[i % DYN_COLORS.length],
      title: s.title || s.phase || `Step ${i + 1}`,
      desc: s.story || s.text || '',
      ipc: refList.length ? refList : (s.ipc_ref ? [String(s.ipc_ref)] : ['Applicable section']),
      meta,
    };
  });

  if (!steps.length) return null;
  return {
    id: 'dynamic',
    label: `🔎 ${law.title || 'Your Search'}`,
    color: '#a78bfa',
    steps,
    law,
  };
}

export default function CaseVisualization() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const [dynamicCase, setDynamicCase] = useState(null);
  const [dynLoading, setDynLoading] = useState(false);
  const [dynError, setDynError] = useState('');

  // Dynamic case (if present) is prepended as the first tab.
  const cases = dynamicCase ? [dynamicCase, ...ALL_CASES] : ALL_CASES;
  const activeCase = cases[Math.min(caseIdx, cases.length - 1)] || cases[0];
  const step = activeCase.steps[Math.min(stepIdx, activeCase.steps.length - 1)] || activeCase.steps[0];

  const handleCaseChange = (i) => {
    setCaseIdx(i);
    setStepIdx(0);
  };

  const flashCases = () => {
    setHighlight(true);
    setTimeout(() => setHighlight(false), 1600);
    setTimeout(() => {
      document.getElementById('cases')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const activateCase = (caseId) => {
    const idx = ALL_CASES.findIndex(c => c.id === caseId);
    const target = idx !== -1 ? idx : 0;
    setDynamicCase(null);
    setCaseIdx(target);
    setStepIdx(0);
    flashCases();
  };

  // Build a dynamic case from the question/answer handed over by Ask AI.
  const activateDynamic = async () => {
    let payload = null;
    try { payload = JSON.parse(sessionStorage.getItem('vidhan_visualize') || 'null'); } catch { payload = null; }
    if (!payload || (!payload.question && !payload.answer)) { activateCase('theft'); return; }

    setDynLoading(true);
    setDynError('');
    flashCases();
    try {
      const res = await fetch(`${API}/unfold-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: payload.question || '', answer: payload.answer || '' }),
      });
      const d = await res.json();
      const dyn = d.found ? buildDynamicCase(d) : null;
      if (dyn) {
        setDynamicCase(dyn);
        setCaseIdx(0);
        setStepIdx(0);
      } else {
        setDynError('Could not build a case for that section. Showing sample cases instead.');
      }
    } catch {
      setDynError('Could not build the case. Showing sample cases instead.');
    } finally {
      setDynLoading(false);
      try { sessionStorage.removeItem('vidhan_visualize'); } catch {}
    }
  };

  // Check ?visualize= URL param on mount (from AskAI "Visualize Case" button)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viz = params.get('visualize');
    if (viz === 'dynamic') activateDynamic();
    else if (viz) activateCase(viz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for "Visualize Case" events fired by AI chat on same page
  useEffect(() => {
    const handler = (e) => activateCase((e.detail || {}).caseId || 'theft');
    window.addEventListener('vidhan:visualize', handler);
    return () => window.removeEventListener('vidhan:visualize', handler);
  }, []);

  return (
    <section
      id="cases"
      className={`section case-section cinematic-section-wrapper${highlight ? ' case-section--highlight' : ''}`}
    >
      <CinematicSectionBackground type="documents" color1="#f59e0b" color2="#8b5cf6" />

      <div className="container" style={{ position: 'relative', zIndex: 10 }}>
        <div className="section-header">
          <motion.div className="section-label" initial={{ opacity: 0, y: -20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 19-9-9 19-2-8-8-2z"/></svg>
            Case Visualization
          </motion.div>
          <motion.h2 className="story-header" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}>
            See How <span className="gradient-text">Cases Unfold</span>
          </motion.h2>
          <motion.p className="section-subtitle" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2 }}>
            Step-by-step breakdown of real legal scenarios with applied BNS sections.
          </motion.p>
        </div>

        {/* ── Dynamic case status ── */}
        {dynLoading && (
          <div className="case-dyn-status case-dyn-status--loading">
            <span className="case-dyn-spinner" />
            Building your case scenario…
          </div>
        )}
        {dynError && !dynLoading && (
          <div className="case-dyn-status case-dyn-status--error">⚠️ {dynError}</div>
        )}

        {/* ── Case Selector Tabs ── */}
        <div className={`case-selector${highlight ? ' case-selector--highlight' : ''}`}>
          {cases.map((c, i) => (
            <button
              key={c.id}
              className={`case-selector-tab${caseIdx === i ? ' case-selector-tab--active' : ''}${c.id === 'dynamic' ? ' case-selector-tab--dynamic' : ''}`}
              style={{ '--tab-color': c.color }}
              onClick={() => handleCaseChange(i)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={caseIdx}
            className="case-layout"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
          >
            {/* Step navigator */}
            <div className="case-steps">
              {activeCase.steps.map((s, i) => (
                <motion.button
                  key={s.id}
                  id={`step-${s.id}`}
                  className={`case-step${stepIdx === i ? ' case-step--active' : ''}${i < stepIdx ? ' case-step--done' : ''}`}
                  onClick={() => setStepIdx(i)}
                  style={{ '--step-color': s.color }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="case-step-num">
                    {i < stepIdx
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                      : <span>{i + 1}</span>
                    }
                  </div>
                  <div className="case-step-icon" style={{ color: s.color }}>{s.icon}</div>
                  <span className="case-step-label">{s.label}</span>
                  {i < activeCase.steps.length - 1 && <div className="case-step-line" />}
                </motion.button>
              ))}
            </div>

            {/* Main panel */}
            <div className="case-main">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${caseIdx}-${stepIdx}`}
                  className="case-panel glowing-border-container"
                  style={{ '--step-color': step.color }}
                  initial={{ opacity: 0, x: 40, scale: 0.97 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -40, scale: 0.97 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                >
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, transparent, ${step.color}, transparent)`, borderRadius: '20px 20px 0 0', boxShadow: `0 0 20px ${step.color}88` }} />
                  <div className="mouse-glow-overlay" />

                  <div className="case-panel-header">
                    <motion.div
                      className="case-panel-icon"
                      style={{ background: `${step.color}1a`, borderColor: `${step.color}33`, color: step.color }}
                      animate={{ boxShadow: [`0 0 12px ${step.color}44`, `0 0 28px ${step.color}88`, `0 0 12px ${step.color}44`] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      {step.icon}
                    </motion.div>
                    <div>
                      <div className="case-panel-step-label">Step {stepIdx + 1} of {activeCase.steps.length}</div>
                      <h3 className="case-panel-title">{step.title}</h3>
                    </div>
                    <div className="case-panel-progress">
                      <motion.div
                        className="case-panel-progress-bar"
                        style={{ background: step.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${((stepIdx + 1) / activeCase.steps.length) * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  <p className="case-panel-desc">{step.desc}</p>

                  <div className="case-panel-meta">
                    {step.meta.map((m, mi) => (
                      <motion.div key={m} className="case-meta-tag" style={{ borderColor: `${step.color}22` }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: mi * 0.1 }}>
                        <span className="case-meta-dot" style={{ background: step.color }} />{m}
                      </motion.div>
                    ))}
                  </div>

                  <div className="case-nav">
                    <button className="btn btn-ghost case-nav-btn" onClick={() => setStepIdx(Math.max(0, stepIdx - 1))} disabled={stepIdx === 0}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                      Previous
                    </button>
                    <div className="case-dots">
                      {activeCase.steps.map((_, i) => (
                        <button key={i} className={`case-dot${stepIdx === i ? ' case-dot--active' : ''}`} onClick={() => setStepIdx(i)} style={{ '--dc': stepIdx === i ? step.color : undefined }} />
                      ))}
                    </div>
                    <motion.button
                      className="btn btn-primary case-nav-btn"
                      style={{ background: step.color, boxShadow: `0 0 20px ${step.color}55` }}
                      onClick={() => setStepIdx(Math.min(activeCase.steps.length - 1, stepIdx + 1))}
                      disabled={stepIdx === activeCase.steps.length - 1}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      Next Step
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                    </motion.button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Side IPC panel */}
            <aside className="case-ipc-panel">
              <div className="case-ipc-panel-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                Applied Sections
              </div>
              <div className="case-ipc-list">
                {step.ipc.map((ipc, ii) => (
                  <motion.div key={ipc} className="case-ipc-entry" style={{ '--step-color': step.color }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ii * 0.12 }}>
                    <div className="case-ipc-bar" style={{ background: step.color, boxShadow: `0 0 8px ${step.color}66` }} />
                    <span className="case-ipc-text">{ipc}</span>
                  </motion.div>
                ))}
              </div>

              <div className="case-ipc-panel-title" style={{ marginTop: 20 }}>Case Timeline</div>
              <div className="case-timeline">
                {activeCase.steps.map((s, i) => (
                  <motion.div
                    key={s.id}
                    className={`case-tl-item${stepIdx === i ? ' case-tl-item--active' : ''}${i < stepIdx ? ' case-tl-item--done' : ''}`}
                    style={{ '--tl-color': s.color }}
                    onClick={() => setStepIdx(i)}
                    whileHover={{ x: 4 }}
                  >
                    <div className="case-tl-dot" />
                    <span className="case-tl-label">{s.label}</span>
                  </motion.div>
                ))}
              </div>
            </aside>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
