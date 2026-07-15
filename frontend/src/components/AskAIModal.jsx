import React, { useState, useRef, useEffect } from 'react';
import { useLanguage, LANGUAGES } from '../LanguageContext';
import './AskAIModal.css';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const LANG_CODES = {
  English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN',
  Tamil: 'ta-IN', Telugu: 'te-IN', Marathi: 'mr-IN', Bengali: 'bn-IN',
};

// A1: Cross-browser voice detection
const SR_API = window.SpeechRecognition || window.webkitSpeechRecognition || null;

function IPCBadge({ text }) {
  if (!text) return <span>{text}</span>;
  const parts = text.split(/(IPC\s*\d+\w*|BNS\s*\d+\w*)/g);
  return (
    <span>
      {parts.map((p, i) =>
        /IPC\s*\d+\w*|BNS\s*\d+\w*/i.test(p)
          ? <span key={i} className="am-ipc-badge">{p}</span>
          : p
      )}
    </span>
  );
}

export default function AskAIModal({ topic, onClose }) {
  const { language: globalLang } = useLanguage();
  const [modalLang, setModalLang] = useState(globalLang);
  const [langOpen, setLangOpen]   = useState(false);
  const [messages, setMessages]   = useState([
    {
      role: 'assistant',
      text: `Hi! I'm here to help you understand **${topic.display_code || 'IPC'} ${topic.display_section || topic.ipc_section} — ${topic.title}**. Ask me anything about this law — punishments, exceptions, real-life scenarios, or how it applies.`,
    }
  ]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // A1: inline voice error state instead of alert()
  const [voiceError, setVoiceError] = useState('');

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const recogRef  = useRef(null);
  const synthRef  = useRef('speechSynthesis' in window ? window.speechSynthesis : null);
  const langRef   = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const h = e => { if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Auto-dismiss voice error after 5s
  useEffect(() => {
    if (!voiceError) return;
    const t = setTimeout(() => setVoiceError(''), 5000);
    return () => clearTimeout(t);
  }, [voiceError]);

  const SUGGESTIONS = [
    `What is the exact punishment for this section?`,
    'Can the accused get bail in this case?',
    'Give me a real-life example of this crime.',
    'Explain the exceptions to this law.',
  ];

  const speak = (text) => {
    synthRef.current?.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
    u.lang    = LANG_CODES[modalLang] || 'en-IN';
    u.onstart = () => setIsSpeaking(true);
    u.onend   = () => setIsSpeaking(false);
    synthRef.current?.speak(u);
  };

  const send = async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: question }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/learn/ask-ai`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ipc_section: topic.ipc_section, question, language: modalLang }),
      });
      const d   = await res.json();
      const ans = d.answer || 'No answer received.';
      setMessages(m => [...m, { role: 'assistant', text: ans }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Network error. Please try again.' }]);
    }
    setLoading(false);
  };

  // A1: Replace alert() with inline voiceError state
  const startVoice = () => {
    if (!SR_API) {
      setVoiceError('Voice input requires Chrome or Edge. Please type your question instead.');
      return;
    }
    setVoiceError('');
    const recog          = new SR_API();
    recog.lang           = LANG_CODES[modalLang] || 'en-IN';
    recog.continuous     = true;
    recog.interimResults = true;
    recog.maxAlternatives = 3;
    recogRef.current     = recog;
    recog.onstart  = () => setListening(true);
    recog.onend    = () => setListening(false);
    recog.onerror  = (e) => {
      setListening(false);
      const errorMessages = {
        'not-allowed':  'Microphone access denied. Please allow mic in browser settings.',
        'no-speech':    'No speech detected. Please speak clearly.',
        'audio-capture':'No microphone found.',
        'network':      'Network error during voice recognition.',
      };
      setVoiceError(errorMessages[e.error] || `Voice error: ${e.error}`);
    };
    recog.onresult = (e) => {
      const results = Array.from(e.results);
      const finalResult = results.find(r => r.isFinal);
      if (finalResult) {
        send(finalResult[0].transcript);
      }
    };
    recog.start();
  };

  const currentLangObj = LANGUAGES.find(l => l.code === modalLang) || LANGUAGES[0];

  return (
    <div className="am-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="am-panel">
        {/* Header */}
        <div className="am-header">
          <div className="am-header-info">
            <div className="am-ai-dot" />
            <div>
              <span className="am-header-title">Ask AI — Legal Assistant</span>
              <span className="am-header-sub">{topic.display_code || 'IPC'} {topic.display_section || topic.ipc_section}: {topic.title}</span>
            </div>
          </div>
          <div className="am-header-actions">
            {/* Language selector */}
            <div className="am-lang" ref={langRef}>
              <button className="am-lang-btn" onClick={() => setLangOpen(o => !o)} id="am-lang-btn">
                {currentLangObj.flag}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: langOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
              {langOpen && (
                <div className="am-lang-dropdown">
                  {LANGUAGES.map(l => (
                    <button key={l.code}
                      className={`am-lang-option${modalLang === l.code ? ' am-lang-option--active' : ''}`}
                      onClick={() => { setModalLang(l.code); setLangOpen(false); }}>
                      {l.flag} {l.native}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="am-close" onClick={onClose} id="ask-ai-close">✕</button>
          </div>
        </div>

        {/* A1: Inline voice error toast */}
        {voiceError && (
          <div className="am-voice-error" role="alert">
            <span>🎙️ {voiceError}</span>
            <button onClick={() => setVoiceError('')} aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* Messages */}
        <div className="am-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`am-msg am-msg--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="am-avatar">⚖️</div>
              )}
              <div className="am-bubble-group">
                <div className="am-bubble">
                  <IPCBadge text={msg.text} />
                </div>
                {msg.role === 'assistant' && msg.text && (
                  <button
                    className={`am-tts${isSpeaking ? ' am-tts--active' : ''}`}
                    onClick={() => isSpeaking ? synthRef.current?.cancel() : speak(msg.text)}
                  >{isSpeaking ? '⏹' : '🔊'}</button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="am-msg am-msg--assistant">
              <div className="am-avatar">⚖️</div>
              <div className="am-bubble am-bubble--thinking">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions */}
        {messages.length <= 1 && !loading && (
          <div className="am-suggestions">
            {SUGGESTIONS.map(s => (
              <button key={s} className="am-suggestion-btn" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="am-input-row">
          {/* Voice mic */}
          <button
            className={`am-mic${listening ? ' am-mic--active' : ''}${!SR_API ? ' am-mic--disabled' : ''}`}
            onClick={listening ? () => recogRef.current?.stop() : startVoice}
            title={!SR_API ? 'Voice unavailable — use Chrome/Edge' : listening ? 'Stop' : 'Voice input'}
            id="am-voice-btn"
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          >
            {listening && <span className="am-mic-ring" />}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
          </button>

          <textarea
            ref={inputRef}
            className="am-input"
            placeholder={listening ? '🎙 Listening…' : `Ask anything about ${topic.display_code || 'IPC'} ${topic.display_section || topic.ipc_section}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            id="ask-ai-input"
            disabled={listening}
          />
          <button
            className={`am-send-btn${input.trim() ? ' am-send-btn--active' : ''}`}
            onClick={() => send()}
            disabled={!input.trim() || loading}
            id="ask-ai-send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
            </svg>
          </button>
        </div>
        <p className="am-hint">Enter to send · Shift+Enter for new line · {currentLangObj.flag} {currentLangObj.native}</p>
      </div>
    </div>
  );
}
