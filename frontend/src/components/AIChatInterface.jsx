import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BorderBeam } from './ui/BorderBeam';
import './AIChatInterface.css';

/* ── Case category detector ─────────────────────────────────────────────────── */
const CASE_KEYWORDS = {
  theft:      [/theft|steal|stolen|rob|pickpocket|burglary|379|303|ipc 379/i],
  fraud:      [/fraud|cheat|scam|420|420|318|phishing|cyber fraud|online fraud|otp/i],
  assault:    [/assault|hurt|attack|beat|325|117|grievous|physical violence|fight/i],
  domestic:   [/domestic|498a|498|dowry|cruelty|husband|wife|matrimon|dv act/i],
  murder:     [/murder|kill|death|302|101|homicide|culpable/i],
  cybercrime: [/cyber|hack|data theft|it act|66|computer|online|internet|digital/i],
};

function detectCase(text) {
  for (const [caseId, patterns] of Object.entries(CASE_KEYWORDS)) {
    if (patterns.some(p => p.test(text))) return caseId;
  }
  return null;
}

/* ── IPC Badge inline ── */
function IPCBadge({ section }) {
  return <span className="chat-ipc-badge">{section}</span>;
}

/* ── Render markdown bold + IPC/BNS section highlights ── */
function MsgContent({ text }) {
  if (!text) return null;
  const renderLine = (line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={lineIdx}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ color: '#22d3ee' }}>{part.slice(2, -2)}</strong>;
          }
          const subParts = part.split(/((?:IPC|BNS)\s*\d+\w*)/gi);
          return subParts.map((sp, j) =>
            /^(IPC|BNS)\s*\d+\w*$/i.test(sp)
              ? <IPCBadge key={`${i}-${j}`} section={sp.replace(/[^0-9A-Za-z]/g, '').replace(/^(IPC|BNS)/i, '')} />
              : <span key={`${i}-${j}`}>{sp}</span>
          );
        })}
      </span>
    );
  };
  const lines = text.split('\n');
  return (
    <div style={{ lineHeight: '1.7' }}>
      {lines.map((line, i) => (
        <div key={i} style={{ marginBottom: line.trim() === '' ? '6px' : '2px' }}>
          {renderLine(line, i)}
        </div>
      ))}
    </div>
  );
}

/* ── Message bubble ── */
function Message({ msg, index }) {
  const isAI = msg.role === 'ai';
  const [copied, setCopied] = useState(false);

  const handleVisualize = () => {
    // Detect case from both question and answer text
    const combined = (msg.question || '') + ' ' + (msg.text || '');
    const caseId = detectCase(combined);

    // Fire custom event so CaseVisualization can switch its tab
    window.dispatchEvent(new CustomEvent('vidhan:visualize', {
      detail: { caseId: caseId || 'theft' },
    }));

    // Smooth scroll to the Cases section
    const el = document.getElementById('cases');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(msg.text || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`chat-msg chat-msg--${msg.role}`} style={{ animationDelay: `${index * 0.05}s` }}>
      {isAI && (
        <div className="chat-msg-avatar chat-msg-avatar--ai">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="aiGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee"/>
                <stop offset="100%" stopColor="#6366f1"/>
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="10" fill="url(#aiGrad)" opacity="0.2"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="url(#aiGrad)" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="9" cy="9" r="1.5" fill="url(#aiGrad)"/>
            <circle cx="15" cy="9" r="1.5" fill="url(#aiGrad)"/>
          </svg>
        </div>
      )}
      <div className="chat-msg-body">
        <div className="chat-msg-bubble">
          <MsgContent text={msg.text} />
        </div>
        {isAI && (
          <div className="chat-msg-actions">
            <button className="chat-action-btn" id={`explain-${index}`} title="Explain Simply">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Explain Simply
            </button>
            <button
              className="chat-action-btn chat-action-btn--visualize"
              id={`visualize-${index}`}
              title="See case procedure step-by-step"
              onClick={handleVisualize}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 9 5 12 1.774-5.226L21 14 9 9z"/></svg>
              Visualize Case
            </button>
            <button
              className="chat-action-btn chat-action-btn--copy"
              id={`copy-${index}`}
              title={copied ? 'Copied!' : 'Copy answer'}
              onClick={handleCopy}
            >
              {copied
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              }
            </button>
          </div>
        )}
      </div>
      {!isAI && (
        <div className="chat-msg-avatar chat-msg-avatar--user">B</div>
      )}
    </div>
  );
}

/* ── Typing indicator ── */
function TypingIndicator() {
  return (
    <div className="chat-typing">
      <div className="chat-msg-avatar chat-msg-avatar--ai" style={{ width: 32, height: 32 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="url(#aiGrad)" opacity="0.2"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="chat-typing-dots">
        <span/><span/><span/>
      </div>
    </div>
  );
}

/* ── Initial demo messages ── */
const INITIAL = [
  {
    role: 'ai',
    text: "Hello! I'm Vidhan.ai. Ask me anything about Indian law — BNS sections, your rights, or legal procedures. I explain complex legal language in plain words.",
    ipcs: [],
  },
  {
    role: 'user',
    text: 'What is the punishment for theft under BNS 303?',
    ipcs: [],
  },
  {
    role: 'ai',
    text: 'Under BNS 303, theft is punishable with imprisonment up to 3 years, or fine, or both. Snatching (BNS 304) also carries up to 3 years. For robbery (BNS 309), punishment is rigorous imprisonment of at least 10 years, extendable to life. Dacoity (BNS 310) carries 7 years to life imprisonment.',
    ipcs: [{ ref: 'BNS 303', section: '303' }],
    question: 'What is the punishment for theft under BNS 303?',
  },
];

const SUGGESTIONS = [
  'What is BNS 103 — punishment for murder?',
  'Explain BNS 85 — cruelty by husband',
  'What are my rights when arrested?',
  'What is BNS 64 — rape punishment?',
];

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export default function AIChatInterface() {
  const [messages, setMessages] = useState(INITIAL);
  const [input, setInput]             = useState('');
  const [thinking, setThinking]       = useState(false);
  const [error, setError]             = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [demoCount, setDemoCount] = useState(0);
  const navigate     = useNavigate();
  const bottomRef    = useRef(null);
  const containerRef = useRef(null);

  const isLoggedIn = !!localStorage.getItem('vidhan_token');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const sendMessage = async (text = input.trim()) => {
    if (!text || thinking) return;
    if (!isLoggedIn && demoCount >= 1) return;
    setError('');
    setMessages(prev => [...prev, { role: 'user', text, ipcs: [] }]);
    setInput('');
    setThinking(true);

    try {
      const token = localStorage.getItem('vidhan_token');
      const res = await fetch(`${API}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: text, mode: 'rag', language: 'English' }),
      });

      // Plan gate: daily/demo limit reached — show the server's message.
      if (res.status === 403 || res.status === 429) {
        let gateMsg = 'You have reached your free question limit. Upgrade to Pro for unlimited questions.';
        try {
          const body = await res.json();
          if (body?.detail?.message) gateMsg = body.detail.message;
        } catch { /* keep default */ }
        setMessages(prev => [...prev, { role: 'ai', text: `🔒 ${gateMsg}`, ipcs: [] }]);
        return; // finally-block below handles setThinking/demoCount
      }

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data   = await res.json();
      const answer = data.answer || 'No answer received from the server.';

      // Extract IPC/BNS refs from the answer for inline badges
      const ipcMatches = [...answer.matchAll(/IPC\s*(\d+\w*)/gi)];
      const bnsMatches = [...answer.matchAll(/BNS\s*(\d+\w*)/gi)];
      const ipcs = [
        ...ipcMatches.map(m => ({ ref: m[0], section: m[1] })),
        ...bnsMatches.map(m => ({ ref: m[0], section: m[1] })),
      ].filter((v, i, a) => a.findIndex(t => t.section === v.section) === i);

      setMessages(prev => [...prev, {
        role: 'ai',
        text: answer,
        ipcs,
        question: text,  // Store original question so Visualize can detect the case
      }]);
    } catch {
      setError('Could not reach the backend. Make sure the server is running on port 8000.');
      setMessages(prev => [...prev, {
        role: 'ai',
        text: '⚠️ Unable to connect to the AI backend. Please ensure the server is running.',
        ipcs: [],
      }]);
    } finally {
      setThinking(false);
      if (!isLoggedIn) setDemoCount(c => c + 1);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    containerRef.current.style.setProperty('--mouse-x', `${x}%`);
    containerRef.current.style.setProperty('--mouse-y', `${y}%`);
  };

  return (
    <section id="chat" className="section chat-section cinematic-section-wrapper">
      <div className="container" style={{ position: 'relative', zIndex: 10 }}>
        <div className="section-header">
          <div className="section-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/></svg>
            AI Chat Interface
          </div>
          <h2 className="story-header"><span className="typing-cursor">Your AI Legal Guide for Indian Law</span></h2>
          <p className="section-subtitle">Ask one question free — sign in to unlock unlimited legal guidance in your language.</p>
        </div>

        <div className="chat-container glowing-border-container" ref={containerRef} onMouseMove={handleMouseMove}>
          <div className="mouse-glow-overlay" />

          {/* Left sidebar */}
          <aside className="chat-sidebar" style={{ position: 'relative', zIndex: 20 }}>
            <div className="chat-sidebar-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Quick Topics
            </div>
            <div className="chat-suggestions-list">
              {SUGGESTIONS.map(s => (
                <button key={s} className="chat-suggestion-item" onClick={() => sendMessage(s)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  {s}
                </button>
              ))}
            </div>

            <div className="chat-sidebar-divider" />

            <div className="chat-sidebar-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>
              BNS Highlights
            </div>
            <div className="chat-ipc-list">
              {[
                '63 — Rape',
                '64 — Punishment for Rape',
                '85 — Cruelty by Husband',
                '103 — Murder',
                '111 — Organised Crime',
                '303 — Theft',
                '309 — Robbery',
                '318 — Cheating',
                '351 — Criminal Intimidation',
                '356 — Defamation',
              ].map(ipc => (
                <button
                  key={ipc}
                  className="chat-ipc-item chat-ipc-item--btn"
                  onClick={() => sendMessage(`Explain BNS ${ipc.split(' — ')[0]} — ${ipc.split(' — ')[1]}`)}
                >
                  <span className="chat-ipc-dot" />
                  {ipc}
                </button>
              ))}
            </div>

            {/* Visualize hint */}
            <div className="chat-sidebar-divider" />
            <div className="chat-visualize-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Click <strong>Visualize Case</strong> on any answer to jump to the step-by-step case breakdown below.
            </div>
          </aside>

          {/* Chat area */}
          <div className="chat-main" style={{ position: 'relative', zIndex: 20 }}>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', borderRadius: 8, padding: '8px 14px', margin: '8px 0', color: '#fca5a5', fontSize: 13 }}>
                ⚠️ {error}
              </div>
            )}

            <div className="chat-messages" id="chat-messages-scroll">
              {messages.map((m, i) => <Message key={i} msg={m} index={i} />)}
              {thinking && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-wrap">
              {!isLoggedIn && demoCount >= 1 ? (
                <div className="chat-demo-gate">
                  <div className="chat-demo-gate-lock">🔒</div>
                  <div className="chat-demo-gate-text">
                    <strong>Free demo used!</strong>
                    <span>Sign in to ask unlimited legal questions</span>
                  </div>
                  <button
                    className="chat-demo-gate-btn"
                    onClick={() => navigate('/login?redirect=/ask-ai')}
                  >
                    Sign in for Full Access
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 14 0m-7-7 7 7-7 7"/></svg>
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="chat-input-beam-wrap"
                    data-focused={inputFocused || undefined}
                  >
                    {inputFocused && (
                      <BorderBeam
                        colorFrom="#818cf8"
                        colorTo="#D4A017"
                        duration={4}
                        borderWidth={1.8}
                        size={180}
                      />
                    )}
                    <div className="chat-input-bar">
                      <textarea
                        id="chat-input"
                        className="chat-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={onKey}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        placeholder={isLoggedIn ? 'Ask about any law, your rights, or an IPC section...' : 'Try 1 free question — ask anything about Indian law…'}
                        rows={1}
                      />
                      <div className="chat-input-actions">
                        <button
                          className="chat-send-btn"
                          id="chat-send"
                          onClick={() => sendMessage()}
                          disabled={!input.trim() || thinking}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="chat-input-hint">
                    {isLoggedIn ? 'Press Enter to send · Shift+Enter for new line' : '1 free question · Sign in for unlimited access'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
