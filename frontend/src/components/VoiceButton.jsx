/**
 * VoiceButton.jsx — JD Legal AI voice assistant
 * Draggable FAB + compact card overlay with conversation log.
 * Drag the button anywhere on screen. Click to open/close.
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJD } from '../context/JDAssistantContext';
import './VoiceButton.css';

const SR_API   = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const VOICE_OK = !!SR_API && 'speechSynthesis' in window;

const FAB_SIZE = 60;

const QUICK_CMDS = [
  { label: 'Open Quiz',         cmd: 'open quiz' },
  { label: 'Ask AI Chat',       cmd: 'ask ai' },
  { label: 'Compare Laws',      cmd: 'compare laws' },
  { label: 'What is IPC 302?',  cmd: 'what is IPC 302' },
  { label: 'Arrest Rights',     cmd: 'what are my rights when arrested' },
  { label: 'Open Detective',    cmd: 'open detective' },
];

/* ── Icons ──────────────────────────────────────────────────────────────────── */
const MicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);
const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
);
const SpinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);
const SpeakIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 5 6 9H2v6h4l5 4V5z"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const JDStarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
    <path d="M12 2L13.5 9H21L15 13.5L17.5 21L12 16.5L6.5 21L9 13.5L3 9H10.5L12 2Z"/>
  </svg>
);

/* ── Grab default position (bottom-right) ───────────────────────────────────── */
function getDefaultPos() {
  return { x: Math.max(0, window.innerWidth - FAB_SIZE - 28), y: Math.max(0, window.innerHeight - FAB_SIZE - 28) };
}

function loadPos() {
  try {
    const s = localStorage.getItem('jd_fab_pos');
    if (s) {
      const p = JSON.parse(s);
      // Clamp to current viewport in case window was resized
      return {
        x: Math.max(0, Math.min(p.x, window.innerWidth  - FAB_SIZE)),
        y: Math.max(0, Math.min(p.y, window.innerHeight - FAB_SIZE)),
      };
    }
  } catch {}
  return getDefaultPos();
}

/* ════════════════════════════════════════════════════════════════════════════ */
export default function VoiceButton() {
  const ctx = useJD();

  /* drag state */
  const [pos, setPos] = useState(loadPos);
  const dragRef = useRef({ active: false, moved: false, sx: 0, sy: 0, bx: 0, by: 0 });
  const fabRef  = useRef(null);

  /* scroll ref for message log */
  const logRef = useRef(null);

  /* auto-scroll message log */
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [ctx?.messages]);

  /* ── Pointer drag handlers ─────────────────────────────────────────────── */
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, moved: false, sx: e.clientX, sy: e.clientY, bx: pos.x, by: pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragRef.current.moved = true;
    if (!dragRef.current.moved) return;
    const nx = Math.max(0, Math.min(window.innerWidth  - FAB_SIZE, dragRef.current.bx + dx));
    const ny = Math.max(0, Math.min(window.innerHeight - FAB_SIZE, dragRef.current.by + dy));
    setPos({ x: nx, y: ny });
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    // Save position
    try { localStorage.setItem('jd_fab_pos', JSON.stringify(pos)); } catch {}
    // If not dragged → treat as click
    if (!dragRef.current.moved) ctx?.toggleJD();
  }, [pos, ctx]);

  if (!ctx) return null;
  const { isOpen, voiceState, transcript, waveAmps, messages, isVoiceSupported, startListening, stopAll, handleTextCommand, closeJD } = ctx;

  if (!isVoiceSupported) {
    return (
      <div className="jd-unsupported">
        🎙️ Voice needs <strong>Chrome</strong> or <strong>Edge</strong>.
      </div>
    );
  }

  /* card positioning — appears above the FAB, or below if FAB is near top */
  const spaceAbove = pos.y;
  const spaceBelow = window.innerHeight - pos.y - FAB_SIZE;
  const showAbove  = spaceAbove > 380 || spaceAbove > spaceBelow;

  const cardBottom = showAbove ? (window.innerHeight - pos.y + 12) : undefined;
  const cardTop    = !showAbove ? (pos.y + FAB_SIZE + 12) : undefined;
  const cardRight  = Math.max(8, window.innerWidth - pos.x - FAB_SIZE);
  const cardLeft   = undefined; // we use right anchor

  const fabStateClass =
    voiceState === 'listening'  ? 'jd-fab--active'
    : voiceState === 'processing' ? 'jd-fab--processing'
    : voiceState === 'speaking'   ? 'jd-fab--speaking'
    : voiceState === 'error'      ? 'jd-fab--error'
    : '';

  const stateLabel =
    voiceState === 'listening'  ? 'Listening…'
    : voiceState === 'processing' ? 'Thinking…'
    : voiceState === 'speaking'   ? 'Speaking…'
    : voiceState === 'error'      ? 'Mic error'
    : 'Ask me anything';

  return (
    <>
      {/* ── JD Card Overlay ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="jd-card"
            style={{
              position: 'fixed',
              right: cardRight,
              bottom: cardBottom,
              top: cardTop,
              zIndex: 9000,
              maxWidth: 340,
              width: 'calc(100vw - 24px)',
            }}
            initial={{ opacity: 0, scale: 0.9, y: showAbove ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: showAbove ? 10 : -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="jd-card-header">
              <div className="jd-card-brand">
                <div className="jd-logo-dot"><JDStarIcon /></div>
                <div>
                  <div className="jd-card-name">JD Legal AI</div>
                  <div className="jd-card-sub">Vidhan.ai Assistant</div>
                </div>
              </div>
              <button className="jd-card-close" onClick={closeJD} aria-label="Close JD"><CloseIcon /></button>
            </div>

            {/* Message log */}
            <div className="jd-messages" ref={logRef}>
              {messages.length === 0 && (
                <div className="jd-msg jd-msg--jd">
                  <span className="jd-msg-role">JD</span>
                  <span className="jd-msg-text">Hi! I'm JD. Ask me any law question, or say "open quiz", "compare laws", "what is IPC 302" and more.</span>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`jd-msg jd-msg--${m.role}`}>
                  <span className="jd-msg-role">{m.role === 'user' ? 'You' : 'JD'}</span>
                  <span className="jd-msg-text">{m.text}</span>
                </div>
              ))}
            </div>

            {/* Status + waveform */}
            <div className="jd-card-status">
              {voiceState === 'listening' && (
                <div className="jd-wave-row">
                  {(waveAmps || []).slice(0, 16).map((h, i) => (
                    <div key={i} className="jd-wave-bar" style={{ height: `${Math.max(4, h * 0.7)}px` }} />
                  ))}
                </div>
              )}
              {voiceState === 'processing' && (
                <div className="jd-thinking-row">
                  <div className="jd-dot" /><div className="jd-dot" /><div className="jd-dot" />
                  <span className="jd-thinking-lbl">Searching legal database…</span>
                </div>
              )}
              {transcript && voiceState === 'listening' && (
                <div className="jd-live-transcript">"{transcript}"</div>
              )}
              <div className={`jd-state-lbl jd-state-lbl--${voiceState}`}>{stateLabel}</div>
            </div>

            {/* Quick command chips */}
            <div className="jd-chips">
              {QUICK_CMDS.map(c => (
                <button key={c.cmd} className="jd-chip" onClick={() => handleTextCommand(c.cmd)}>
                  {c.label}
                </button>
              ))}
            </div>

            {/* Mic control row */}
            <div className="jd-card-mic-row">
              {voiceState === 'listening' ? (
                <button className="jd-mic-btn jd-mic-btn--listening" onClick={stopAll} title="Stop listening">
                  <StopIcon />
                </button>
              ) : voiceState === 'processing' ? (
                <button className="jd-mic-btn jd-mic-btn--processing" disabled title="Processing">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                    <SpinIcon />
                  </motion.div>
                </button>
              ) : voiceState === 'speaking' ? (
                <button className="jd-mic-btn jd-mic-btn--speaking" onClick={stopAll} title="Stop speaking">
                  <SpeakIcon />
                </button>
              ) : (
                <button className="jd-mic-btn" onClick={startListening} title="Start listening">
                  <MicIcon />
                </button>
              )}
              <span className="jd-mic-hint">
                {voiceState === 'listening' ? 'Listening — tap to stop' : voiceState === 'speaking' ? 'Tap to stop' : 'Tap mic or say your question'}
              </span>
            </div>

            {/* Drag hint */}
            <div className="jd-drag-hint">⠿ Drag the button to move JD anywhere</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status pill (only when closed) ── */}
      {!isOpen && (
        <div
          className="jd-status-pill"
          style={{ position: 'fixed', left: pos.x, top: pos.y - 30, pointerEvents: 'none' }}
        >
          Enable JD
        </div>
      )}

      {/* ── Draggable FAB ── */}
      <div
        ref={fabRef}
        className={`jd-fab ${fabStateClass}`}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          touchAction: 'none',
          cursor: dragRef.current?.moved ? 'grabbing' : 'grab',
          zIndex: 9001,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') ctx.toggleJD(); }}
        aria-label={isOpen ? 'Close JD Legal AI' : 'Open JD Legal AI — Voice Assistant'}
        title={isOpen ? 'Close JD' : 'JD Legal AI — click or drag'}
      >
        {/* Pulse rings when active */}
        {isOpen && (
          <>
            <span className="jd-ring jd-ring--1" />
            <span className="jd-ring jd-ring--2" />
            <span className="jd-ring jd-ring--3" />
          </>
        )}
        <span className="jd-fab-icon">
          {voiceState === 'processing' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
              <SpinIcon />
            </motion.div>
          ) : voiceState === 'speaking' ? (
            <SpeakIcon />
          ) : (
            <MicIcon />
          )}
        </span>
      </div>
    </>
  );
}
