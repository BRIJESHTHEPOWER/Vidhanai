import React, { useState, useEffect, useRef, useCallback } from 'react';
import AskAIModal from './AskAIModal';
import { SkeletonLearnStep } from './Skeleton';
import { useLanguage, LANGUAGES } from '../LanguageContext';
import './LearnMode.css';

const API = 'http://localhost:8000';

const PHASE_COLORS = {
  'Incident':      { color: '#f59e0b', icon: '🔍' },
  'Police Action': { color: '#3b82f6', icon: '👮' },
  'Law Applied':   { color: '#8b5cf6', icon: '⚖️' },
  'Outcome':       { color: '#22c55e', icon: '🏛️' },
};

function IPCText({ text, ipc }) {
  if (!ipc || !text) return <span>{text}</span>;
  const escaped = ipc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(IPC[^\\d]*?\\s*${escaped}|\\s*${escaped})`, 'gi'));
  return (
    <span>
      {parts.map((p, i) => {
        const isMatch = p.match(new RegExp(`IPC[^\\d]*?\\s*${escaped}|\\s*${escaped}`, 'i'));
        return isMatch
          ? <span key={i} className="lm-ipc-highlight">{ipc}</span>
          : <span key={i}>{p}</span>;
      })}
    </span>
  );
}

/* Language selector mini component */
function LangSelector({ value, onChange, loading }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === value) || LANGUAGES[0];

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="lm-lang-selector" ref={ref}>
      <button
        className={`lm-action-btn lm-action-btn--translate${loading ? ' lm-action-btn--loading' : ''}`}
        onClick={() => !loading && setOpen(o => !o)}
        title="Translate"
        id="learn-translate-btn"
      >
        {loading ? <span className="lm-mini-spinner" /> : '🌐'}
        {loading ? 'Translating…' : `${current.flag} ${current.native}`}
      </button>
      {open && (
        <div className="lm-lang-dropdown">
          {LANGUAGES.map(lang => (
            <button key={lang.code}
              className={`lm-lang-option${value === lang.code ? ' lm-lang-option--active' : ''}`}
              onClick={() => { onChange(lang.code); setOpen(false); }}
            >
              {lang.flag} <span>{lang.native}</span>
              <span className="lm-lang-en">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LearnMode({ topic, onBack, onClose }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [step, setStep]         = useState(0);
  const [simple, setSimple]     = useState(false);
  const [askAI, setAskAI]       = useState(false);
  const [error, setError]       = useState('');

  /* Translation state */
  const [transLang, setTransLang]       = useState('English');
  const [translating, setTranslating]   = useState(false);
  const [translatedSteps, setTranslated] = useState(null);

  const { language } = useLanguage();
  const synthRef = useRef(window.speechSynthesis);

  /* keyboard nav */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') setStep(s => Math.min((data?.steps?.length || 1) - 1, s + 1));
      if (e.key === 'ArrowLeft')  setStep(s => Math.max(0, s - 1));
      if (e.key === 'Escape')     onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, onClose]);

  useEffect(() => {
    setLoading(true);
    setTranslated(null);
    setTransLang('English');
    fetch(`${API}/learn/topic/${topic.ipc_section}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load scenario. Please try again.'); setLoading(false); });
  }, [topic.ipc_section]);

  /* Translate all steps */
  const handleTranslate = useCallback(async (lang) => {
    setTransLang(lang);
    if (lang === 'English') { setTranslated(null); return; }
    if (!data) return;
    setTranslating(true);
    try {
      const translated = await Promise.all(
        (data.steps || []).map(async (st) => {
          const res = await fetch(`${API}/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: st.story, target_language: lang, context: 'Indian law scenario' }),
          });
          const d = await res.json();
          return { ...st, story: d.translated || st.story };
        })
      );
      setTranslated(translated);
    } catch { /* keep original */ }
    setTranslating(false);
  }, [data]);

  /* TTS */
  const speak = (text) => {
    synthRef.current?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = transLang === 'Hindi' ? 'hi-IN' : transLang === 'Kannada' ? 'kn-IN' : 'en-IN';
    synthRef.current?.speak(u);
  };

  if (loading) return (
    <div className="lm-overlay">
      <div className="lm-panel" style={{ padding: '28px' }}>
        <SkeletonLearnStep />
      </div>
    </div>
  );

  if (error) return (
    <div className="lm-overlay">
      <div className="lm-panel">
        <div className="lm-error">
          <div className="lm-error-icon">⚠️</div>
          <p>{error}</p>
          <button className="btn btn-outline" onClick={onBack}>Go Back</button>
        </div>
      </div>
    </div>
  );

  const stepsToShow = translatedSteps || data?.steps || [];
  const current = stepsToShow[step] || {};
  const phase   = current.phase || 'Incident';
  const phaseStyle = PHASE_COLORS[phase] || { color: '#6366f1', icon: '📌' };
  const progress = ((step + 1) / stepsToShow.length) * 100;

  return (
    <div className="lm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="lm-panel">
        {/* Header */}
        <div className="lm-header">
          <button className="lm-nav-btn" onClick={onBack} title="Back to mode selection">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <div className="lm-header-center">
            <span className="lm-header-ipc">IPC {data?.ipc_section}</span>
            <h2 className="lm-header-title">{data?.title}</h2>
            {translatedSteps && (
              <span className="lm-translated-badge">
                🌐 {transLang}
              </span>
            )}
          </div>
          <button className="lm-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Progress */}
        <div className="lm-progress-wrap">
          <div className="lm-progress-bar" style={{ width: `${progress}%`, background: phaseStyle.color }} />
        </div>
        <div className="lm-step-labels">
          {stepsToShow.map((s, i) => {
            const ps = PHASE_COLORS[s.phase] || { color: '#6366f1', icon: '📌' };
            return (
              <button
                key={i}
                className={`lm-step-pill${i === step ? ' lm-step-pill--active' : ''}${i < step ? ' lm-step-pill--done' : ''}`}
                style={i === step ? { '--sp-color': phaseStyle.color } : i < step ? { '--sp-color': ps.color } : {}}
                onClick={() => setStep(i)}
              >
                <span>{s.icon || ps.icon}</span>
                <span className="lm-step-pill-label">{s.phase}</span>
              </button>
            );
          })}
        </div>

        {/* Step Card */}
        <div className="lm-step-card" style={{ '--phase-color': phaseStyle.color }} key={step}>
          <div className="lm-step-card-header">
            <div className="lm-step-icon" style={{ background: `${phaseStyle.color}1a`, borderColor: `${phaseStyle.color}33`, color: phaseStyle.color }}>
              {current.icon || phaseStyle.icon}
            </div>
            <div>
              <div className="lm-step-num">Step {step + 1} of {stepsToShow.length}</div>
              <h3 className="lm-step-phase">{phase}</h3>
              <h4 className="lm-step-title">{current.title}</h4>
            </div>
          </div>

          <div className={`lm-step-story${simple ? ' lm-step-story--simple' : ''}`}>
            {simple
              ? <p>{topic.simple_explanation || current.story}</p>
              : <p><IPCText text={current.story} ipc={current.ipc_ref} /></p>
            }
          </div>

          {/* IPC reference */}
          {phase === 'Law Applied' && (
            <div className="lm-law-box">
              <div className="lm-law-box-header">
                <span className="lm-law-ipc-badge">IPC {data?.ipc_section}</span>
                <span className="lm-law-ipc-badge lm-law-ipc-badge--bns">BNS {data?.bns_section}</span>
              </div>
              <p className="lm-law-punishment">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Punishment: {data?.punishment}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="lm-step-actions">
            <button
              className={`lm-action-btn${simple ? ' lm-action-btn--active' : ''}`}
              onClick={() => setSimple(s => !s)}
              id="learn-explain-simply"
            >
              ✏️ {simple ? 'Full Text' : 'Explain Simply'}
            </button>

            <LangSelector value={transLang} onChange={handleTranslate} loading={translating} />

            <button
              className="lm-action-btn lm-action-btn--tts"
              onClick={() => speak(current.story)}
              title="Read aloud"
              id="learn-read-aloud"
            >
              🔊 Read
            </button>

            <button
              className="lm-action-btn lm-action-btn--ai"
              onClick={() => setAskAI(true)}
              id="learn-ask-ai"
            >
              🤖 Ask AI
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="lm-nav">
          <button
            className="btn btn-ghost lm-nav-prev"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
            Previous
          </button>

          <div className="lm-nav-dots">
            {stepsToShow.map((_, i) => (
              <button
                key={i}
                className={`lm-dot${step === i ? ' lm-dot--active' : ''}`}
                onClick={() => setStep(i)}
                style={step === i ? { '--dc': phaseStyle.color } : {}}
              />
            ))}
          </div>

          {step < stepsToShow.length - 1 ? (
            <button
              className="btn btn-primary lm-nav-next"
              style={{ background: phaseStyle.color, boxShadow: `0 0 20px ${phaseStyle.color}44` }}
              onClick={() => setStep(s => s + 1)}
            >
              Next Step
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          ) : (
            <button className="btn btn-primary lm-nav-next lm-nav-done" onClick={onBack}>
              ✓ Completed
            </button>
          )}
        </div>

        <p className="lm-keyboard-hint">← → arrow keys to navigate</p>
      </div>

      {askAI && (
        <AskAIModal
          topic={topic}
          onClose={() => setAskAI(false)}
        />
      )}
    </div>
  );
}
