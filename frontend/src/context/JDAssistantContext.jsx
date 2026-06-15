/**
 * JDAssistantContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * JD — Vidhan AI Voice Assistant & Law Tutor (Groq-powered)
 *
 * LAYER 1 — Instant local commands (zero API, React Router navigation)
 * LAYER 2 — /jd/chat (Groq + RAG) — handles all 3 JD modes:
 *             • Website Assistant  → ACTION: OPEN_TUTOR etc.
 *             • Legal Assistant    → voice-friendly RAG explanation
 *             • AI Law Tutor       → interactive teaching
 *
 * Keeps a conversation log (messages[]) shown in the JD card overlay.
 * Passes last 6 messages as history so JD maintains conversation context.
 */

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../LanguageContext';

const SR_API      = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const TTS_SUPPORT = 'speechSynthesis' in window;
const VOICE_OK    = !!SR_API && TTS_SUPPORT;

const VOICE_STATE = { IDLE: 'idle', LISTENING: 'listening', PROCESSING: 'processing', SPEAKING: 'speaking', ERROR: 'error' };

const LANG_CODE = {
  English:   'en-IN',
  Hindi:     'hi-IN',
  Kannada:   'kn-IN',
  Tamil:     'ta-IN',
  Telugu:    'te-IN',
  Marathi:   'mr-IN',
  Bengali:   'bn-IN',
  Malayalam: 'ml-IN',
};

const ROUTE_COMMANDS = [
  { patterns: ['go home', 'open home', 'home page', 'main page', 'take me home'], route: '/',         reply: 'Going to the home page.' },
  { patterns: ['open quiz', 'start quiz', 'quiz mode', 'test me', 'take a quiz'], route: '/quiz',     reply: 'Opening the Quiz. Good luck!' },
  { patterns: ['ask ai', 'open ai', 'ask question', 'open chat', 'chat with ai'], route: '/ask-ai',   reply: 'Opening the AI Legal Chat.' },
  { patterns: ['compare', 'law comparison', 'compare laws', 'open compare'],      route: '/compare',  reply: 'Opening Law Comparison.' },
  { patterns: ['awareness', 'legal awareness', 'know my rights', 'open rights'],  route: '/awareness',reply: 'Opening Legal Rights section.' },
  { patterns: ['detective', 'detective game', 'play game', 'open detective'],      route: '/detective',reply: 'Starting the Detective Game!' },
  { patterns: ['comic', 'legal comic', 'open comic', 'show comic', 'comic story'],route: '/comic',    reply: 'Opening Legal Comics.' },
  { patterns: ['login', 'sign in', 'log in'],                                     route: '/login',    reply: 'Opening the login page.' },
  { patterns: ['signup', 'register', 'create account', 'sign up'],               route: '/signup',   reply: 'Opening the sign up page.' },
];

const JDAssistantContext = createContext(null);

export function JDAssistantProvider({ children }) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  const [isOpen,      setIsOpen]      = useState(false);
  const [voiceState,  setVoiceState]  = useState(VOICE_STATE.IDLE);
  const [transcript,  setTranscript]  = useState('');
  const [messages,    setMessages]    = useState([]);
  const [waveAmps,    setWaveAmps]    = useState(Array(20).fill(4));

  const recogRef         = useRef(null);
  const synthRef         = useRef(TTS_SUPPORT ? window.speechSynthesis : null);
  const waveIntervalRef  = useRef(null);
  const ttsKeepAliveRef  = useRef(null);   // Chrome TTS keepalive
  const voiceCacheRef    = useRef([]);      // pre-loaded voices
  const isListeningRef   = useRef(false);
  const voiceStateRef    = useRef(VOICE_STATE.IDLE);
  const autoRelistenRef  = useRef(false);
  const isOpenRef        = useRef(false);
  const startListeningFn = useRef(null);
  const hasGreetedRef    = useRef(false);

  // Pre-load voices — Chrome loads them async; we cache on voiceschanged
  useEffect(() => {
    if (!TTS_SUPPORT) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) voiceCacheRef.current = v;
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  /* ── Message log helpers ──────────────────────────────────────────────────── */
  const addMessage = useCallback((role, text) => {
    setMessages(prev => [...prev.slice(-30), { role, text, ts: Date.now() }]);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  /* ── Waveform animation ───────────────────────────────────────────────────── */
  const startWave = useCallback(() => {
    clearInterval(waveIntervalRef.current);
    waveIntervalRef.current = setInterval(() => {
      setWaveAmps(Array.from({ length: 20 }, () => Math.random() * 32 + 4));
    }, 80);
  }, []);

  const stopWave = useCallback(() => {
    clearInterval(waveIntervalRef.current);
    setWaveAmps(Array(20).fill(4));
  }, []);

  /* ── Pick best available voice ──────────────────────────────────────────── */
  const pickVoice = useCallback((langCode) => {
    // Refresh cache in case voices loaded after init
    const voices = voiceCacheRef.current.length
      ? voiceCacheRef.current
      : window.speechSynthesis?.getVoices() || [];
    if (!voices.length) return null;

    const lang = langCode || 'en-IN';
    const exact = voices.find(v => v.lang === lang && (v.name.includes('Google') || v.name.includes('Microsoft')));
    if (exact) return exact;

    const sameBase = voices.find(v => v.lang.startsWith(lang.split('-')[0]) && (v.name.includes('Google') || v.name.includes('Microsoft')));
    if (sameBase) return sameBase;

    // Fallback: any English voice
    const anyEn = voices.find(v => v.lang.startsWith('en'));
    return anyEn || voices[0] || null;
  }, []);

  /* ── Chrome TTS keepalive — prevents silent pause bug after ~15s ─────── */
  const startTTSKeepAlive = useCallback(() => {
    clearInterval(ttsKeepAliveRef.current);
    ttsKeepAliveRef.current = setInterval(() => {
      if (synthRef.current?.speaking && !synthRef.current?.paused) {
        synthRef.current.pause();
        synthRef.current.resume();
      }
    }, 8000);
  }, []);

  const stopTTSKeepAlive = useCallback(() => {
    clearInterval(ttsKeepAliveRef.current);
  }, []);

  /* ── TTS speak ───────────────────────────────────────────────────────────── */
  const speak = useCallback((text, lang, onDone) => {
    if (!text || !synthRef.current) { if (onDone) onDone(); return; }

    // Cancel any running speech
    synthRef.current.cancel();

    // Split on sentence boundaries so pauses feel natural
    const rawChunks = text
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const chunks = rawChunks.length ? rawChunks : [text];

    let i = 0;
    const targetLang = lang || LANG_CODE[language] || 'en-IN';
    const voice = pickVoice(targetLang);

    const finish = () => {
      stopTTSKeepAlive();
      setVoiceState(VOICE_STATE.IDLE);
      stopWave();
      if (onDone) onDone();
      if (autoRelistenRef.current && isOpenRef.current) {
        setTimeout(() => { if (startListeningFn.current) startListeningFn.current(); }, 400);
      }
    };

    const speakNext = () => {
      if (i >= chunks.length) { finish(); return; }
      const utt      = new SpeechSynthesisUtterance(chunks[i]);
      utt.lang       = targetLang;
      utt.rate       = 0.95;
      utt.pitch      = 1.0;
      utt.volume     = 1.0;
      if (voice) utt.voice = voice;
      utt.onstart    = () => { setVoiceState(VOICE_STATE.SPEAKING); startWave(); if (i === 0) startTTSKeepAlive(); };
      utt.onend      = () => { i++; speakNext(); };
      utt.onerror    = (e) => {
        // 'interrupted' fires when we cancel — don't advance on deliberate cancel
        if (e.error === 'interrupted') return;
        i++;
        speakNext();
      };
      synthRef.current.speak(utt);
    };

    // Small delay after cancel so Chrome doesn't drop the first utterance
    setTimeout(speakNext, 80);
  }, [language, pickVoice, startWave, stopWave, startTTSKeepAlive, stopTTSKeepAlive]);

  /* ── Stop all audio/recognition ─────────────────────────────────────────── */
  const stopAll = useCallback(() => {
    autoRelistenRef.current = false;
    try { recogRef.current?.stop(); } catch (_) {}
    synthRef.current?.cancel();
    stopTTSKeepAlive();
    isListeningRef.current = false;
    stopWave();
    setVoiceState(VOICE_STATE.IDLE);
  }, [stopWave, stopTTSKeepAlive]);

  /* ── Layer 1: local command matcher ─────────────────────────────────────── */
  const matchLocalCommand = useCallback((text) => {
    const lower = text.toLowerCase();

    if (/\b(stop|close|bye|goodbye|dismiss|cancel)\b/.test(lower)) return { type: 'close' };

    for (const cmd of ROUTE_COMMANDS) {
      if (cmd.patterns.some(p => lower.includes(p))) return { type: 'navigate', route: cmd.route, reply: cmd.reply };
    }

    const path = window.location.pathname;
    if (path.includes('/quiz')) {
      const optMatch = lower.match(/\b(option a|option b|option c|option d|select a|select b|select c|select d)\b/);
      if (optMatch) { const opt = optMatch[1].slice(-1).toUpperCase(); return { type: 'in_page_action', action: 'quiz_select', payload: opt, reply: `Selecting option ${opt}.` }; }
      if (/\b(next|next question|skip)\b/.test(lower)) return { type: 'in_page_action', action: 'quiz_next', reply: 'Next question.' };
    }
    if (path.includes('/ask-ai')) {
      if (/\b(submit|send|ask it)\b/.test(lower)) return { type: 'in_page_action', action: 'askai_submit', reply: 'Submitting your question.' };
      if (/\b(read|read answer|tell me the answer)\b/.test(lower)) return { type: 'in_page_action', action: 'askai_read', reply: 'Reading the answer.' };
      if (/\b(explain simply|simplify|make it simple)\b/.test(lower)) return { type: 'in_page_action', action: 'askai_explain', reply: 'Simplifying the answer.' };
      const typeMatch = lower.match(/^(?:type|search for|search)\s+(.+)/);
      if (typeMatch) return { type: 'in_page_action', action: 'askai_type', payload: typeMatch[1].trim(), reply: `Typing: ${typeMatch[1].trim()}` };
    }

    return null;
  }, []);

  /* ── ACTION code → route map ─────────────────────────────────────────────── */
  const ACTION_ROUTES = useMemo(() => ({
    OPEN_TUTOR:      '/learn',
    OPEN_CHATBOT:    '/ask-ai',
    OPEN_COMPARISON: '/compare',
    OPEN_DASHBOARD:  '/dashboard',
    OPEN_PROFILE:    '/profile',
    OPEN_COMICS:     '/comic',
    START_QUIZ:      '/quiz',
    OPEN_HOME:       '/',
    OPEN_DETECTIVE:  '/detective',
  }), []);

  /* ── Layer 2+3: Call /jd/chat (Groq) for all non-local commands ──────────── */
  const askJD = useCallback(async (text, contextSection) => {
    setVoiceState(VOICE_STATE.PROCESSING);

    // Build history from last 6 messages (3 turns)
    const history = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));

    try {
      const res = await fetch('http://localhost:8000/jd/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:         text,
          language,
          context_section: contextSection || null,
          history,
        }),
      });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      const reply  = (data.response || '').replace(/\*\*/g, '').trim();
      const action = data.action || null;

      if (!reply) throw new Error('Empty response');

      addMessage('jd', reply);

      if (action && ACTION_ROUTES[action]) {
        // Navigation action — speak reply then route
        speak(reply, LANG_CODE[language], () => {
          navigate(ACTION_ROUTES[action]);
          autoRelistenRef.current = true;
        });
      } else {
        speak(reply, LANG_CODE[language], () => { autoRelistenRef.current = true; });
      }

    } catch {
      const fallback = "I couldn't reach my knowledge base right now. Let me open the chat for a full answer.";
      addMessage('jd', fallback);
      speak(fallback, null, () => {
        navigate(`/ask-ai?q=${encodeURIComponent(text)}`);
        autoRelistenRef.current = true;
      });
    }
  }, [language, messages, addMessage, speak, navigate, ACTION_ROUTES]);

  /* ── Master command handler ──────────────────────────────────────────────── */
  const handleCommand = useCallback(async (rawText) => {
    const text = rawText.trim();
    if (!text) return;

    setTranscript(text);
    addMessage('user', text);

    const lower = text.toLowerCase();

    // Stop / close — always instant
    if (/\b(stop|close|bye|goodbye|dismiss|cancel)\b/.test(lower)) {
      autoRelistenRef.current = false;
      const bye = 'Goodbye! Call me anytime for legal help.';
      addMessage('jd', bye);
      speak(bye);
      setTimeout(() => setIsOpen(false), 1800);
      return;
    }

    // LAYER 1: instant local commands (zero latency — no API call)
    const localMatch = matchLocalCommand(text);
    if (localMatch) {
      if (localMatch.type === 'navigate') {
        addMessage('jd', localMatch.reply);
        speak(localMatch.reply, null, () => { navigate(localMatch.route); autoRelistenRef.current = true; });
        return;
      }
      if (localMatch.type === 'close') {
        autoRelistenRef.current = false;
        const bye = 'Goodbye! Call me anytime for legal help.';
        addMessage('jd', bye);
        speak(bye);
        setTimeout(() => setIsOpen(false), 1800);
        return;
      }
      if (localMatch.type === 'in_page_action') {
        window.dispatchEvent(new CustomEvent('jd_command', { detail: { action: localMatch.action, payload: localMatch.payload } }));
        addMessage('jd', localMatch.reply);
        speak(localMatch.reply, null, () => { autoRelistenRef.current = true; });
        return;
      }
    }

    // LAYER 2: All other queries → JD (Groq) handles mode detection automatically
    // JD determines: Website Assistant (navigation), Legal Assistant, or Law Tutor
    await askJD(text);
  }, [speak, navigate, matchLocalCommand, askJD, addMessage]);

  /* ── Start speech recognition ────────────────────────────────────────────── */
  const startListening = useCallback(() => {
    if (!SR_API || isListeningRef.current) return;

    const recog = new SR_API();
    recog.lang            = LANG_CODE[language] || 'en-IN';
    recog.continuous      = true;
    recog.interimResults  = true;
    recog.maxAlternatives = 3;
    recogRef.current      = recog;

    recog.onstart  = () => { isListeningRef.current = true; setVoiceState(VOICE_STATE.LISTENING); startWave(); };
    recog.onresult = (e) => {
      const results   = Array.from(e.results);
      const finalRes  = results.find(r => r.isFinal);
      const latest    = results[results.length - 1][0].transcript;
      if (!finalRes) { setTranscript(latest); return; }
      const txt = finalRes[0].transcript;
      setTranscript(txt);
      stopWave();
      // Also dispatch for voice typing if active
      if (voiceTypingRef.current) {
        const el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.value += (el.value ? ' ' : '') + txt;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
      handleCommand(txt);
    };
    recog.onerror = (e) => {
      isListeningRef.current = false;
      stopWave();
      if (e.error === 'no-speech') { setVoiceState(VOICE_STATE.IDLE); return; }
      if (e.error === 'not-allowed') { setVoiceState(VOICE_STATE.ERROR); return; }
      setVoiceState(VOICE_STATE.ERROR);
    };
    recog.onend = () => {
      isListeningRef.current = false;
      if (voiceStateRef.current === VOICE_STATE.LISTENING) setVoiceState(VOICE_STATE.IDLE);
      stopWave();
    };

    try { recog.start(); } catch (e) { console.warn('recog.start() failed:', e); isListeningRef.current = false; }
  }, [language, handleCommand, startWave, stopWave]);

  useEffect(() => { startListeningFn.current = startListening; }, [startListening]);

  /* ── Voice typing toggle ─────────────────────────────────────────────────── */
  const [voiceTypingActive, setVoiceTypingActive] = useState(false);
  const voiceTypingRef = useRef(false);

  const toggleVoiceTyping = useCallback(() => {
    const next = !voiceTypingRef.current;
    voiceTypingRef.current = next;
    setVoiceTypingActive(next);
    speak(next ? 'Voice typing enabled. Speak to type.' : 'Voice typing off.', null, () => {});
  }, [speak]);

  /* ── Open / Close overlay ────────────────────────────────────────────────── */
  const openJD = useCallback(() => {
    setIsOpen(true);
    isOpenRef.current = true;
    setTranscript('');
    setVoiceState(VOICE_STATE.IDLE);
    autoRelistenRef.current = true;
    if (!hasGreetedRef.current) {
      hasGreetedRef.current = true;
      speak('Hi, I\'m JD. How can I help?', null, () => {
        if (startListeningFn.current) startListeningFn.current();
      });
    } else {
      setTimeout(() => { if (startListeningFn.current) startListeningFn.current(); }, 150);
    }
  }, [speak]);

  const closeJD = useCallback(() => {
    autoRelistenRef.current = false;
    isOpenRef.current = false;
    stopAll();
    setIsOpen(false);
  }, [stopAll]);

  const toggleJD = useCallback(() => {
    if (isOpen) closeJD(); else openJD();
  }, [isOpen, openJD, closeJD]);

  useEffect(() => () => { stopAll(); stopTTSKeepAlive(); }, [stopAll, stopTTSKeepAlive]);

  const value = useMemo(() => ({
    isOpen, voiceState, transcript, waveAmps, messages,
    isVoiceSupported: VOICE_OK,
    voiceTypingActive,
    openJD, closeJD, toggleJD,
    startListening, stopAll, speak,
    handleTextCommand: handleCommand,
    askJD,            // direct JD Groq call — used by tutor doubt, etc.
    addMessage, clearMessages,
    toggleVoiceTyping,
    isJDActive:  isOpen,
    isListening: voiceState === VOICE_STATE.LISTENING,
    status:      voiceState,
    stopJD:      closeJD,
  }), [
    isOpen, voiceState, transcript, waveAmps, messages,
    voiceTypingActive,
    openJD, closeJD, toggleJD, startListening, stopAll, speak,
    handleCommand, askJD, addMessage, clearMessages, toggleVoiceTyping,
  ]);

  return <JDAssistantContext.Provider value={value}>{children}</JDAssistantContext.Provider>;
}

export function useJD() { return useContext(JDAssistantContext); }
