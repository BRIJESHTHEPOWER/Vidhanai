import React, { useState, useEffect, useRef } from 'react';
import AskAIModal from './AskAIModal';
import CaseScenarioInline from './CaseScenarioInline';
import { useLanguage, LANGUAGES } from '../LanguageContext';
import './ExploreMode.css';

const API = 'http://localhost:8000';

const LEGAL_TERMS = [
  'imprisonment','fine','cognizable','bailable','non-bailable','arrest','warrant',
  'FIR','complaint','court','magistrate','death','life imprisonment','convicted',
  'accused','victim','offence','offense','punishment','penalty','intention','consent',
];

function HighlightedText({ text }) {
  if (!text) return null;
  const pattern = new RegExp(`(${LEGAL_TERMS.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return (
    <span>
      {parts.map((p, i) =>
        LEGAL_TERMS.some(t => t.toLowerCase() === p.toLowerCase())
          ? <mark key={i} className="em-term">{p}</mark>
          : p
      )}
    </span>
  );
}

function LangSelector({ value, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === value) || LANGUAGES[0];
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="em-lang-sel" ref={ref}>
      <button className={`em-action-btn${loading ? ' em-action-btn--loading' : ''}`}
        onClick={() => !loading && setOpen(o => !o)} id="explore-translate-btn">
        {loading ? <span className="em-mini-spinner" /> : '🌐'}
        {loading ? 'Translating…' : `${current.flag} ${current.native}`}
      </button>
      {open && (
        <div className="em-lang-dropdown">
          {LANGUAGES.map(lang => (
            <button key={lang.code}
              className={`em-lang-option${value === lang.code ? ' em-lang-option--active' : ''}`}
              onClick={() => { onChange(lang.code); setOpen(false); }}>
              {lang.flag} <span>{lang.native}</span>
              <span className="em-lang-en">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExploreMode({ topic, onBack, onClose }) {
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [askAI, setAskAI]             = useState(false);
  const [simplifying, setSimplifying] = useState(false);
  const [simpleText, setSimpleText]   = useState('');
  const [showSimple, setShowSimple]   = useState(false);
  const [transLang, setTransLang]     = useState('English');
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated]   = useState(null);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [caseData, setCaseData]       = useState(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [showCase, setShowCase]       = useState(false);
  const [caseError, setCaseError]     = useState('');
  const synthRef = useRef(window.speechSynthesis);

  const { language } = useLanguage();

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/explore/law/${topic.ipc_section}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load law details.'); setLoading(false); });
  }, [topic.ipc_section]);

  const handleExplainSimply = async () => {
    if (simpleText) { setShowSimple(s => !s); return; }
    setSimplifying(true);
    try {
      const res = await fetch(`${API}/learn/ask-ai`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipc_section: topic.ipc_section,
          question: `Explain IPC ${topic.ipc_section} (${topic.title}) in very simple language for a high school student. Use bullet points.`,
        }),
      });
      const d = await res.json();
      setSimpleText(d.answer || '');
      setShowSimple(true);
    } catch { setSimpleText('Failed to get AI explanation.'); }
    setSimplifying(false);
  };

  const handleTranslate = async (lang) => {
    setTransLang(lang);
    if (lang === 'English') { setTranslated(null); return; }
    if (!data) return;
    setTranslating(true);
    try {
      const textToTranslate = [
        data.description, data.simple_explanation, data.real_life_example
      ].filter(Boolean).join('\n---\n');

      const res = await fetch(`${API}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToTranslate, target_language: lang, context: 'Indian legal text' }),
      });
      const d = await res.json();
      const parts = (d.translated || '').split('---');
      setTranslated({
        description:        parts[0]?.trim() || data.description,
        simple_explanation: parts[1]?.trim() || data.simple_explanation,
        real_life_example:  parts[2]?.trim() || data.real_life_example,
      });
    } catch { /* keep original */ }
    setTranslating(false);
  };

  const speak = (text) => {
    if (!text) return;
    synthRef.current?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = transLang === 'Hindi' ? 'hi-IN' : 'en-IN';
    u.onstart = () => setIsSpeaking(true);
    u.onend   = () => setIsSpeaking(false);
    synthRef.current?.speak(u);
  };

  const stopSpeaking = () => { synthRef.current?.cancel(); setIsSpeaking(false); };

  // Visualize this exact law as a step-by-step case scenario
  const handleVisualizeCase = async () => {
    if (caseData) { setShowCase(s => !s); return; }
    if (!data) return;
    setCaseLoading(true);
    setCaseError('');
    // Build a precise question/answer so /unfold-case matches THIS law's sections.
    const refs = [
      data.bns_section ? `BNS ${data.bns_section}` : '',
      data.ipc_section ? `IPC ${data.ipc_section}` : '',
    ].filter(Boolean).join(' / ');
    try {
      const res = await fetch(`${API}/unfold-case`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Show me a case scenario for ${data.title}`,
          answer: `${data.title} is covered under ${refs}. ${data.description || ''} Punishment: ${data.punishment || ''}`,
        }),
      });
      const d = await res.json();
      if (d.found && d.steps?.length) { setCaseData(d); setShowCase(true); }
      else setCaseError('Could not build a case scenario for this section.');
    } catch { setCaseError('Could not build the case. Please try again.'); }
    setCaseLoading(false);
  };

  const display = translated || (data ? {
    description:        data.description,
    simple_explanation: data.simple_explanation,
    real_life_example:  data.real_life_example,
  } : null);

  if (loading) return (
    <div className="em-overlay"><div className="em-panel">
      <div className="em-loading"><div className="em-spinner" /><p>Loading full law details…</p></div>
    </div></div>
  );
  if (error) return (
    <div className="em-overlay"><div className="em-panel em-panel--center">
      <div>⚠️</div><p style={{ color: '#94a3b8' }}>{error}</p>
      <button className="btn btn-outline" onClick={onBack}>Back</button>
    </div></div>
  );

  return (
    <div className="em-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="em-panel">
        {/* Header */}
        <div className="em-header">
          <button className="em-nav-btn" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <div className="em-header-center">
            <span className="em-header-mode">📖 Explore Mode</span>
            {translated && <span className="em-translated-badge">🌐 {transLang}</span>}
          </div>
          <button className="em-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Title Block */}
        <div className="em-title-block" style={{ '--cat-color': data.category_color || '#8b5cf6' }}>
          <div className="em-title-top">
            <span className="em-cat-icon">{data.category_icon}</span>
            <div className="em-badges">
              <span className="em-ipc-badge">IPC {data.ipc_section}</span>
              {data.bns_section && <span className="em-ipc-badge em-ipc-badge--bns">BNS {data.bns_section}</span>}
              <span className="em-cat-badge">{data.category_label}</span>
            </div>
            <div className="em-cognizable-badges">
              <span className={`em-small-badge ${data.bailable ? 'em-small-badge--green' : 'em-small-badge--red'}`}>
                {data.bailable ? '✓ Bailable' : '✗ Non-Bailable'}
              </span>
              <span className={`em-small-badge ${data.cognizable ? 'em-small-badge--orange' : 'em-small-badge--gray'}`}>
                {data.cognizable ? '⚡ Cognizable' : 'Non-Cognizable'}
              </span>
            </div>
          </div>
          <h2 className="em-title">{data.title}</h2>
        </div>

        {/* Action Bar */}
        <div className="em-actions-bar">
          <button
            className={`em-action-btn${showSimple ? ' em-action-btn--active' : ''}`}
            onClick={handleExplainSimply} disabled={simplifying} id="explore-explain-simply"
          >
            {simplifying ? <><span className="em-mini-spinner" /> Generating…</> : <>{showSimple ? '📖 Hide Simple' : '✏️ Explain Simply (AI)'}</>}
          </button>

          <button
            className={`em-action-btn em-action-btn--tts${isSpeaking ? ' em-action-btn--tts-active' : ''}`}
            onClick={isSpeaking ? stopSpeaking : () => speak(display?.description)}
            id="explore-read-aloud"
          >
            {isSpeaking ? '⏹ Stop' : '🔊 Read Aloud'}
          </button>

          <button
            className={`em-action-btn${showCase ? ' em-action-btn--active' : ''}`}
            onClick={handleVisualizeCase} disabled={caseLoading} id="explore-visualize-case"
          >
            {caseLoading ? <><span className="em-mini-spinner" /> Building…</> : <>{showCase ? '🎬 Hide Case' : '🎬 Visualize Case'}</>}
          </button>

          <button className="em-action-btn em-action-btn--ai" onClick={() => setAskAI(true)} id="explore-ask-ai">
            🤖 Ask AI
          </button>
        </div>

        {/* Visualized case scenario for this section */}
        {caseError && <div className="em-simple-block" style={{ color: '#fca5a5' }}>⚠️ {caseError}</div>}
        {showCase && caseData?.steps?.length > 0 && (
          <div className="em-section">
            <CaseScenarioInline data={caseData} />
          </div>
        )}

        {/* Simple View (AI) */}
        {showSimple && simpleText && (
          <div className="em-simple-block">
            <div className="em-simple-header">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              AI Simplified Explanation
            </div>
            <p className="em-simple-text">{simpleText}</p>
          </div>
        )}

        {/* Description */}
        <div className="em-section">
          <h4 className="em-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            Legal Definition (IPC)
          </h4>
          <p className="em-legal-text"><HighlightedText text={display?.description} /></p>
        </div>

        {data.bns_description && (
          <div className="em-section">
            <h4 className="em-section-title em-section-title--bns">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              BNS 2023 Version
            </h4>
            <p className="em-legal-text em-legal-text--bns"><HighlightedText text={data.bns_description} /></p>
          </div>
        )}

        {/* Punishment */}
        <div className="em-punishment-grid">
          <div className="em-punishment-card em-punishment-card--ipc">
            <div className="em-punishment-label">IPC Punishment</div>
            <div className="em-punishment-value">{data.punishment}</div>
          </div>
          {data.bns_punishment && (
            <div className="em-punishment-card em-punishment-card--bns">
              <div className="em-punishment-label">BNS Punishment</div>
              <div className="em-punishment-value">{data.bns_punishment}</div>
            </div>
          )}
        </div>

        {/* Simple Words */}
        <div className="em-section">
          <h4 className="em-section-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            In Simple Words
          </h4>
          <p className="em-simple-text-static">{display?.simple_explanation}</p>
        </div>

        {/* Real Life Example */}
        {display?.real_life_example && (
          <div className="em-section">
            <h4 className="em-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Real-Life Example
            </h4>
            <div className="em-example-box"><p>{display.real_life_example}</p></div>
          </div>
        )}

        {/* Key Differences */}
        {data.differences && (
          <div className="em-section">
            <h4 className="em-section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              IPC vs BNS — Key Differences
            </h4>
            <div className="em-diff-box"><p>{data.differences}</p></div>
          </div>
        )}

        {/* Keywords */}
        {data.keywords?.length > 0 && (
          <div className="em-keywords-section">
            <span className="em-kw-label">Related keywords:</span>
            {data.keywords.map(k => <span key={k} className="em-kw">{k}</span>)}
          </div>
        )}
      </div>

      {askAI && <AskAIModal topic={topic} onClose={() => setAskAI(false)} />}
    </div>
  );
}
