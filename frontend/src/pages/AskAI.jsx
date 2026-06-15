import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useLanguage, LANGUAGES } from '../LanguageContext';
import VidhanLogo from '../components/VidhanLogo';
import './AskAI.css';

const API = 'http://127.0.0.1:8000';

const LANG_CODES = {
  English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN',
  Tamil: 'ta-IN', Telugu: 'te-IN', Marathi: 'mr-IN', Bengali: 'bn-IN',
};

function IPCBadge({ text }) {
  if (!text) return <span>{text}</span>;
  
  // First split by bold markdown **text**
  const boldParts = text.split(/\*\*(.*?)\*\*/g);
  
  return (
    <span>
      {boldParts.map((boldPart, idx) => {
        // Even indices are normal text, odd indices are bold text
        if (idx % 2 === 1) {
          return <span key={`b-${idx}`} className="askai-highlight">{boldPart}</span>;
        }
        
        // For normal text, split by IPC/BNS sections
        const parts = boldPart.split(/(IPC\s*\d+\w*|BNS\s*\d+\w*)/g);
        return (
          <span key={`t-${idx}`}>
            {parts.map((p, i) => {
              if (/BNS\s*\d+\w*/i.test(p)) {
                return <span key={i} className="askai-bns">{p}</span>;
              }
              if (/IPC\s*\d+\w*/i.test(p)) {
                return <span key={i} className="askai-ipc">{p}</span>;
              }
              return p;
            })}
          </span>
        );
      })}
    </span>
  );
}

const QUICK_ASKS = [
  'What are my rights when arrested by police?',
  'What is BNS 103 (murder) punishment?',
  'How does the domestic violence law work under BNS?',
  'What is BNS 64 about (rape)?',
  'What changed from IPC to BNS 2023?',
  'What are cyber crime laws under BNS?',
  'What is community service punishment in BNS?',
  'What is BNS 111 on organised crime?',
];

/* Multi-thread chat history (ChatGPT/Claude style) */
const CHATS_KEY  = 'vidhan_askai_chats';
const ACTIVE_KEY = 'vidhan_askai_active_chat';
const LEGACY_CHAT_KEY = 'vidhan_askai_chat';

function makeChatId() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function chatTitle(msgs) {
  const firstUser = (msgs || []).find(m => m.role === 'user' && m.text);
  if (!firstUser) return 'New chat';
  const t = firstUser.text.trim();
  return t.length > 42 ? t.slice(0, 42) + '…' : t;
}

function initChatState() {
  let chats = [];
  try {
    const raw = localStorage.getItem(CHATS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) chats = parsed;
  } catch { /* ignore */ }

  // Migrate the old single-chat storage into the new multi-thread format
  if (chats.length === 0) {
    try {
      const raw = localStorage.getItem(LEGACY_CHAT_KEY);
      const legacy = raw ? JSON.parse(raw) : [];
      if (Array.isArray(legacy) && legacy.length > 0) {
        chats = [{ id: makeChatId(), title: chatTitle(legacy), messages: legacy, updatedAt: Date.now() }];
        try { localStorage.removeItem(LEGACY_CHAT_KEY); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  let activeId = null;
  try { activeId = localStorage.getItem(ACTIVE_KEY); } catch { /* ignore */ }
  if (!activeId || !chats.some(c => c.id === activeId)) {
    activeId = chats[0]?.id || makeChatId();
  }

  return { chats, activeId };
}

export default function AskAI() {
  const userName = localStorage.getItem('vidhan_user') || '';
  const [initState] = useState(() => {
    const state = initChatState();
    // Always land on a fresh, empty chat — previous conversations stay
    // available in the Chat History list and can be reopened from there.
    const active = state.chats.find(c => c.id === state.activeId);
    if (active && active.messages && active.messages.length > 0) {
      return { chats: state.chats, activeId: makeChatId() };
    }
    return state;
  });
  const [chats, setChats] = useState(() => initState.chats);
  const [activeChatId, setActiveChatId] = useState(() => initState.activeId);
  const [messages, setMessages]   = useState(() => {
    const active = initState.chats.find(c => c.id === initState.activeId);
    // Never restore a half-streamed message as "streaming"
    return active ? active.messages.map(m => ({ ...m, isStreaming: false })) : [];
  });
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [listening, setListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [langOpen, setLangOpen]   = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [streamingIdx, setStreamingIdx] = useState(-1);
  const [statusText, setStatusText]     = useState('');
  const [elapsed, setElapsed]           = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('vidhan_askai_theme') || 'dark');
  const timerRef      = useRef(null);
  const streamTextRef = useRef(''); // accumulates tokens during streaming

  const { language, setLanguage, currentLang } = useLanguage();
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const recogRef   = useRef(null);
  const synthRef   = useRef(window.speechSynthesis);
  const langRef    = useRef(null);
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();

  /* auto-send from URL query param */
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) { setTimeout(() => sendMessage(q), 300); }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Persist the active conversation into the chat-history list (survives refresh) */
  useEffect(() => {
    const clean = messages
      .filter(m => !m.isStreaming && m.text)
      .map(m => ({ ...m, isStreaming: false, simplifyLoading: false }))
      .slice(-40);
    if (clean.length === 0) return; // don't persist empty/new chats

    setChats(prev => {
      const idx = prev.findIndex(c => c.id === activeChatId);
      const entry = idx === -1
        ? { id: activeChatId, title: chatTitle(clean), messages: clean, updatedAt: Date.now() }
        : { ...prev[idx], title: prev[idx].title || chatTitle(clean), messages: clean, updatedAt: Date.now() };
      const rest = idx === -1 ? prev : prev.filter((_, i) => i !== idx);
      const next = [entry, ...rest].slice(0, 30);
      try { localStorage.setItem(CHATS_KEY, JSON.stringify(next)); } catch { /* storage full / disabled */ }
      return next;
    });
  }, [messages, activeChatId]);

  /* Remember which chat is active */
  useEffect(() => {
    try { localStorage.setItem(ACTIVE_KEY, activeChatId); } catch { /* ignore */ }
  }, [activeChatId]);

  /* Light / dark theme toggle */
  useEffect(() => {
    try { localStorage.setItem('vidhan_askai_theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const toggleTheme = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  /* Start a fresh chat thread */
  const newChat = useCallback(() => {
    setActiveChatId(makeChatId());
    setMessages([]);
  }, []);

  /* Switch to a previously saved chat thread */
  const switchChat = useCallback((id) => {
    if (id === activeChatId) return;
    const target = chats.find(c => c.id === id);
    setMessages((target?.messages || []).map(m => ({ ...m, isStreaming: false })));
    setActiveChatId(id);
  }, [chats, activeChatId]);

  /* Delete a saved chat thread */
  const deleteChat = useCallback((id, e) => {
    e?.stopPropagation();
    const next = chats.filter(c => c.id !== id);
    setChats(next);
    try { localStorage.setItem(CHATS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    if (id === activeChatId) {
      if (next.length > 0) {
        setMessages(next[0].messages.map(m => ({ ...m, isStreaming: false })));
        setActiveChatId(next[0].id);
      } else {
        setActiveChatId(makeChatId());
        setMessages([]);
      }
    }
  }, [chats, activeChatId]);

  useEffect(() => {
    const h = e => { if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* remove default greeting message from messages state */
  useEffect(() => {
    // Greeting moved to initial UI state instead of a chat bubble
  }, []);

  const sendMessage = useCallback(async (text, isRetry = false) => {
    const question = (text || input).trim();
    if (!question || loading) return;
    
    if (!isRetry) {
      setInput('');
      const userMsg = { role: 'user', text: question, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      setMessages(m => [...m, userMsg]);
    }
    
    setLoading(true);
    setStatusText('Connecting...');
    setElapsed(0);

    // Start elapsed timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const res = await fetch(`${API}/ask-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, mode: 'rag', language }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok || !res.body) {
        throw new Error('Stream unavailable');
      }

      // Create placeholder AI message for streaming
      const aiMsg = {
        role: 'assistant',
        text: '',
        story: [],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        question,
        simplifiedText: null,
        simplifyLoading: false,
        showSimplified: false,
        isStreaming: true,
      };

      let msgIdx;
      setMessages(m => {
        const filtered = isRetry ? m.filter(msg => !msg.isError) : m;
        msgIdx = filtered.length;
        return [...filtered, aiMsg];
      });
      setStreamingIdx(msgIdx);

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      streamTextRef.current = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'status') {
              setStatusText(evt.message);
            } else if (evt.type === 'streaming_start' || evt.type === 'chunk') {
              setLoading(false);
              clearInterval(timerRef.current);
              setStatusText('');
              if (evt.type === 'chunk') {
                streamTextRef.current += evt.content;
                setMessages(prev => prev.map((m, i) =>
                  i === msgIdx ? { ...m, text: m.text + evt.content } : m
                ));
              }
            } else if (evt.type === 'done') {
              setMessages(prev => prev.map((m, i) =>
                i === msgIdx ? { ...m, isStreaming: false } : m
              ));
            } else if (evt.type === 'error') {
              setMessages(prev => prev.map((m, i) =>
                i === msgIdx ? { ...m, text: `⚠️ ${evt.message}`, isStreaming: false, isError: true } : m
              ));
            }
          } catch { /* skip malformed SSE lines */ }
        }
      }

      // Ensure streaming flag is cleared
      setMessages(prev => prev.map((m, i) =>
        i === msgIdx ? { ...m, isStreaming: false } : m
      ));

    } catch (err) {
      clearTimeout(timeoutId);

      // Auto-retry once on timeout
      if (err.name === 'AbortError' && !isRetry) {
        clearInterval(timerRef.current);
        setLoading(false);
        setStreamingIdx(-1);
        setStatusText('');
        sendMessage(question, true);
        return;
      }

      // Fallback: try non-streaming /ask endpoint
      if (err.message === 'Stream unavailable') {
        try {
          const fallbackRes = await fetch(`${API}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, mode: 'rag', language }),
          });
          const d = await fallbackRes.json();
          const ans = d.answer || 'I could not find a relevant answer.';
          const fallbackMsg = {
            role: 'assistant', text: ans, story: d.story || [],
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            question, simplifiedText: null, simplifyLoading: false, showSimplified: false,
          };
          setMessages(m => {
            const filtered = isRetry ? m.filter(msg => !msg.isError) : m;
            return [...filtered, fallbackMsg];
          });
          clearInterval(timerRef.current);
          setLoading(false);
          setStreamingIdx(-1);
          setStatusText('');
          return;
        } catch { /* fallback also failed — show error below */ }
      }

      const errorText = err.name === 'AbortError' 
        ? '⏳ The request timed out. The server is taking too long to respond.' 
        : '⚠️ Network error. Please check your connection and try again.';
        
      setMessages(m => [...m, { 
        role: 'assistant', 
        text: errorText, 
        time: '',
        isError: true,
        question: question 
      }]);
    }
    clearInterval(timerRef.current);
    setLoading(false);
    setStreamingIdx(-1);
    setStatusText('');
  }, [input, loading, language]);

  // Visualize Case — hand the actual question + answer to the home "See How
  // Cases Unfold" page, which builds a dynamic step-by-step scenario for the
  // exact BNS/IPC section discussed (works for any section, e.g. 358, 511).
  const handleVisualize = (msg) => {
    try {
      sessionStorage.setItem('vidhan_visualize', JSON.stringify({
        question: msg.question || '',
        answer: msg.text || '',
        ts: Date.now(),
      }));
    } catch { /* ignore storage errors */ }
    navigate('/?visualize=dynamic#cases');
  };

  // Copy answer text to clipboard
  const copyText = (text) => {
    navigator.clipboard?.writeText(text || '');
  };

  // Explain Simply — call /simplify, show teal simplified bubble
  const explainSimply = async (idx) => {
    const msg = messages[idx];
    if (!msg || msg.simplifyLoading) return;

    // Toggle off if already shown
    if (msg.showSimplified && msg.simplifiedText) {
      setMessages(m => m.map((m2, i) => i === idx ? { ...m2, showSimplified: false } : m2));
      return;
    }
    // Already fetched, just show again
    if (msg.simplifiedText) {
      setMessages(m => m.map((m2, i) => i === idx ? { ...m2, showSimplified: true } : m2));
      return;
    }

    setMessages(m => m.map((m2, i) => i === idx ? { ...m2, simplifyLoading: true } : m2));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
    
    try {
      const res = await fetch(`${API}/simplify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: msg.text, question: msg.question || '', language }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const d = await res.json();
      setMessages(m => m.map((m2, i) =>
        i === idx
          ? { ...m2, simplifiedText: d.simplified || msg.text, showSimplified: true, simplifyLoading: false }
          : m2
      ));
    } catch {
      clearTimeout(timeoutId);
      setMessages(m => m.map((m2, i) => i === idx ? { ...m2, simplifyLoading: false } : m2));
    }
  };

  const speak = useCallback((text) => {
    if (!text) return;
    synthRef.current?.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ''));
    u.lang = LANG_CODES[language] || 'en-IN';
    u.onstart = () => setIsSpeaking(true);
    u.onend   = () => setIsSpeaking(false);
    synthRef.current?.speak(u);
  }, [language]);

  // ── Voice Command Listener (JD Assistant) ──────────────────────────────────
  useEffect(() => {
    const handleVoiceCommand = (e) => {
      const { action, payload } = e.detail;
      
      if (action === 'askai_type') {
        setInput(payload);
      } else if (action === 'askai_submit') {
        // use a timeout to let the input state update finish if it was typed just before
        setTimeout(() => sendMessage(), 100);
      } else if (action === 'askai_read' || action === 'askai_explain') {
        // find last assistant message index
        const lastIdx = messages.findLastIndex(m => m.role === 'assistant' && m.text && !m.text.includes('Namaste'));
        if (lastIdx !== -1) {
          if (action === 'askai_read') speak(messages[lastIdx].text);
          if (action === 'askai_explain') explainSimply(lastIdx);
        }
      }
    };
    window.addEventListener('jd_command', handleVoiceCommand);
    return () => window.removeEventListener('jd_command', handleVoiceCommand);
  }, [messages, sendMessage, speak]);

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    // No alert() — show inline error banner instead
    if (!SR) {
      setVoiceError('Voice input requires Chrome or Edge. Please type your question.');
      setTimeout(() => setVoiceError(''), 5000);
      return;
    }
    setVoiceError('');
    const recog = new SR();
    recog.lang = LANG_CODES[language] || 'en-IN';
    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 3;
    recogRef.current = recog;
    recog.onstart  = () => setListening(true);
    recog.onend    = () => setListening(false);
    recog.onerror  = (e) => {
      setListening(false);
      const msgs = {
        'not-allowed': 'Microphone access denied. Allow mic in browser settings.',
        'no-speech':   'No speech detected. Please speak clearly.',
        'audio-capture': 'No microphone found on this device.',
      };
      setVoiceError(msgs[e.error] || `Voice error: ${e.error}`);
      setTimeout(() => setVoiceError(''), 5000);
    };
    recog.onresult = (e) => {
      const results = Array.from(e.results);
      const finalResult = results.find(r => r.isFinal);
      if (finalResult) {
        sendMessage(finalResult[0].transcript);
      }
    };
    recog.start();
  };

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className={`askai-root${theme === 'light' ? ' askai-root--light' : ''}`}>
      {/* Sidebar */}
      <aside className="askai-sidebar">
        <Link to="/" className="askai-logo">
          <VidhanLogo size={28} />
          <span>Vidhan.ai</span>
        </Link>
        <nav className="askai-sidenav">
          <Link to="/quiz"      className="askai-sidenav-link">📝 Quiz Hub</Link>
          <Link to="/compare"   className="askai-sidenav-link">⚖️ Compare Laws</Link>
          <Link to="/login"     className="askai-sidenav-link">👤 Account</Link>
        </nav>
        <div className="askai-sidebar-bottom">
          <div className="askai-quick-label">Quick Questions</div>
          {QUICK_ASKS.map((q, i) => (
            <button key={i} className="askai-quick-btn" onClick={() => sendMessage(q)}>
              {q}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="askai-main">
        {/* Top Bar */}
        <div className="askai-topbar">
          <div className="askai-topbar-title">
            <div className="askai-ai-dot" />
            <span>Powered by Vidhan.ai ✨</span>
          </div>

          <div className="askai-topbar-actions">
            {/* Language Selector */}
            <div className="askai-lang" ref={langRef}>
              <button className="askai-lang-btn" onClick={() => setLangOpen(o => !o)} id="askai-lang-btn">
                {currentLang.label} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: langOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {langOpen && (
                <div className="askai-lang-dropdown">
                  {LANGUAGES.map(l => (
                    <button key={l.code}
                      className={`askai-lang-option${language === l.code ? ' askai-lang-option--active' : ''}`}
                      onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                      id={`askai-lang-${l.code}`}>
                      {l.flag} {l.native} <span className="askai-lang-en">{l.label}</span>
                      {language === l.code && <span style={{ marginLeft: 'auto', color: '#6366f1' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              className="askai-top-icon-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66 4.93 19.07M19.07 4.93l-1.41 1.41"/></svg>
              )}
            </button>
            <div className="askai-avatar-top">{userName?.charAt(0).toUpperCase() || 'U'}</div>
          </div>
        </div>

        {/* Voice error inline banner */}
        {voiceError && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', background: 'rgba(245,158,11,0.08)',
            borderBottom: '1px solid rgba(245,158,11,0.2)',
            fontSize: '0.8rem', color: '#fcd34d', gap: '12px'
          }} role="alert">
            <span>🎙️ {voiceError}</span>
            <button onClick={() => setVoiceError('')} style={{
              background: 'none', border: 'none', color: '#fcd34d',
              cursor: 'pointer', fontSize: '0.8rem', opacity: 0.7
            }}>✕</button>
          </div>
        )}

        {/* Messages */}
        <div className="askai-messages">
          {messages.length === 0 && (
            <div className="askai-greeting">
              <h1>Hello, {userName || 'User'} 👋</h1>
              <p>How can I help you with your legal question today?</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`askai-msg askai-msg--${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="askai-avatar"><VidhanLogo size={22} /></div>
              )}
              {msg.role === 'user' && (
                <div className="askai-avatar askai-avatar--user">{currentLang?.flag || 'U'}</div>
              )}
              <div className="askai-bubble-wrap">
                <div className={`askai-bubble${msg.isStreaming ? ' askai-streaming-cursor' : ''}`}>
                  <IPCBadge text={msg.text} />
                  {/* Story steps accordion */}
                  {msg.story?.length > 0 && (
                    <div className="askai-story">
                      <div className="askai-story-label">📖 Step-by-step breakdown:</div>
                      {msg.story.map((s, j) => (
                        <div key={j} className="askai-story-step">
                          <span className="askai-story-icon">{s.icon || '📌'}</span>
                          <div>
                            <div className="askai-story-phase">{s.phase}</div>
                            <p className="askai-story-text">{s.story || s.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Simplified view — shows when user clicks Explain Simply */}
                  {msg.role === 'assistant' && msg.showSimplified && msg.simplifiedText && (
                    <div className="askai-bubble askai-bubble--simplified" style={{ marginTop: 10 }}>
                      <IPCBadge text={msg.simplifiedText} />
                    </div>
                  )}
                </div>

                {/* Action buttons — only for AI messages */}
                {msg.role === 'assistant' && msg.text && !msg.isError && (
                  <div className="askai-actions">
                    <button
                      className={`askai-action-btn askai-action-btn--explain${msg.simplifyLoading ? ' askai-action-btn--explain--loading' : ''}`}
                      onClick={() => explainSimply(i)}
                      disabled={msg.simplifyLoading}
                      title="Rewrite in simple language"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
                      {msg.simplifyLoading ? 'Simplifying…' : msg.showSimplified ? 'Hide Simple' : 'Explain Simply'}
                    </button>
                    <button
                      className="askai-action-btn askai-action-btn--visualize"
                      onClick={() => handleVisualize(msg)}
                      title="See this case unfold step-by-step"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 9 5 12 1.774-5.226L21 14 9 9z"/></svg>
                      Visualize Case
                    </button>
                    <button
                      className="askai-action-btn askai-action-btn--copy"
                      onClick={() => copyText(msg.text)}
                      title="Copy answer"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </button>
                  </div>
                )}
                
                {msg.isError && (
                  <div className="askai-actions" style={{ marginTop: 8 }}>
                    <button 
                      className="askai-action-btn"
                      onClick={() => sendMessage(msg.question, true)}
                      style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}
                    >
                      🔄 Retry
                    </button>
                  </div>
                )}

                <div className="askai-msg-meta">
                  {msg.time}
                  {msg.role === 'assistant' && msg.text && !msg.isError && (
                    <button
                      className={`askai-tts-btn${isSpeaking ? ' askai-tts-btn--active' : ''}`}
                      onClick={() => isSpeaking ? synthRef.current?.cancel() : speak(msg.text)}
                      title="Read aloud"
                    >
                      {isSpeaking ? '⏹' : '🔊'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="askai-msg askai-msg--assistant">
              <div className="askai-avatar"><VidhanLogo size={22} /></div>
              <div className="askai-loading-status">
                <div className="askai-loading-top">
                  <div className="askai-loading-dots">
                    <span /><span /><span />
                  </div>
                  <span className="askai-loading-text">{statusText || 'Thinking...'}</span>
                  <span className="askai-loading-timer">{elapsed}s</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input Row */}
        <div className="askai-input-wrap">
          <div className={`askai-input-box${listening ? ' askai-input-box--listening' : ''}`}>
            <textarea
              ref={inputRef}
              className="askai-input"
              placeholder={listening ? '🎙 Listening…' : `Ask your legal question in any language…`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              id="askai-input"
              disabled={listening}
            />
            <div className="askai-input-actions">
              {/* Voice */}
              <button
                className={`askai-mic-btn${listening ? ' askai-mic-btn--active' : ''}`}
                onClick={listening ? () => recogRef.current?.stop() : startVoice}
                title={listening ? 'Stop' : 'Voice input'}
                id="askai-voice-btn"
              >
                {listening && <span className="askai-mic-ring" />}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
              </button>

              {/* Send */}
              <button
                className={`askai-send-btn${input.trim() ? ' askai-send-btn--active' : ''}`}
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                id="askai-send"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </div>
          </div>
          <p className="askai-input-hint">🔒 Your conversations are secure and confidential</p>
        </div>
      </main>

      {/* Right Sidebar */}
      <aside className="askai-right-sidebar">
        <div className="askai-rs-card">
          <div className="askai-rs-title">Capabilities</div>
          <div className="askai-rs-cap-item">
            <div className="askai-rs-cap-icon">📚</div>
            <div className="askai-rs-cap-text">
              <h4>Legal Research</h4>
              <p>Access comprehensive legal database</p>
            </div>
          </div>
          <div className="askai-rs-cap-item">
            <div className="askai-rs-cap-icon">⚖️</div>
            <div className="askai-rs-cap-text">
              <h4>Case Analysis</h4>
              <p>Analyze case laws and precedents</p>
            </div>
          </div>
          <div className="askai-rs-cap-item">
            <div className="askai-rs-cap-icon">💡</div>
            <div className="askai-rs-cap-text">
              <h4>Law Explanation</h4>
              <p>Simple explanations of complex laws</p>
            </div>
          </div>
          <div className="askai-rs-cap-item">
            <div className="askai-rs-cap-icon">🌐</div>
            <div className="askai-rs-cap-text">
              <h4>Multi-language</h4>
              <p>Support for multiple languages</p>
            </div>
          </div>
        </div>

        <div className="askai-rs-card askai-history-card">
          <div className="askai-rs-title-row">
            <div className="askai-rs-title">Chat History</div>
            {messages.length > 0 && (
              <button className="askai-rs-newchat" onClick={newChat} title="Start a new chat">+ New</button>
            )}
          </div>
          {chats.length === 0 ? (
            <p className="askai-rs-empty">Your conversations will appear here. Ask anything to begin.</p>
          ) : (
            <div className="askai-history-list">
              {chats.map((c) => (
                <button
                  key={c.id}
                  className={`askai-rs-query askai-history-item${c.id === activeChatId ? ' askai-history-item--active' : ''}`}
                  onClick={() => switchChat(c.id)}
                  title={c.title}
                >
                  <h4>{c.title}</h4>
                  <p>{new Date(c.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  <span
                    className="askai-history-delete"
                    role="button"
                    aria-label="Delete chat"
                    onClick={(e) => deleteChat(c.id, e)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="askai-rs-card askai-rs-disclaimer">
          <div className="askai-rs-title">Legal Disclaimer</div>
          <p>
            This AI assistant provides general legal information only and should not be considered as legal advice. Please consult with a qualified legal professional for advice on your specific situation.
          </p>
          <button className="askai-rs-btn">Learn More</button>
        </div>
      </aside>
    </div>
  );
}
