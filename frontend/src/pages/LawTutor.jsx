/**
 * LawTutor.jsx — AI-powered Law Tutor (JD teaches BNS & IPC chapter-by-chapter)
 * States: path_select → mode_select → chapters → lesson → checkpoint → assessment → results → achievements
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import VidhanLogo from '../components/VidhanLogo';
import { motion, AnimatePresence } from 'framer-motion';
import { authHeaders } from '../utils/authHeaders';
import './LawTutor.css';

const API = 'http://localhost:8000';

// ── Language config ───────────────────────────────────────────────────────────
const TUTOR_LANGS = [
  { code: 'English',   native: 'English',  flag: '🇬🇧', tts: 'en-IN' },
  { code: 'Hindi',     native: 'हिन्दी',   flag: '🇮🇳', tts: 'hi-IN' },
  { code: 'Kannada',   native: 'ಕನ್ನಡ',    flag: '🇮🇳', tts: 'kn-IN' },
  { code: 'Tamil',     native: 'தமிழ்',    flag: '🇮🇳', tts: 'ta-IN' },
  { code: 'Telugu',    native: 'తెలుగు',   flag: '🇮🇳', tts: 'te-IN' },
  { code: 'Marathi',   native: 'मराठी',    flag: '🇮🇳', tts: 'mr-IN' },
  { code: 'Malayalam', native: 'മലയാളം',  flag: '🇮🇳', tts: 'ml-IN' },
];
const LANG_TTS   = Object.fromEntries(TUTOR_LANGS.map(l => [l.code, l.tts]));
const LANG_GREET = {
  Hindi:     'Namaste! ',
  Kannada:   'Namaskara! ',
  Tamil:     'Vanakkam! ',
  Telugu:    'Namaskaram! ',
  Marathi:   'Namaskar! ',
  Malayalam: 'Namaskaram! ',
};

/* ════════════════════════════════════════════════════
   JD_PHRASES — every spoken phrase localised per language.
   When JD speaks, text AND Sarvam TTS voice both use the
   student's chosen language end-to-end.
   English is the safe fallback for any gap.
════════════════════════════════════════════════════ */
const JD_PHRASES = {

  // After lesson section finishes — "any doubts / continue?"
  endOfSection: {
    English:   (t) => `That covers ${t}. Any doubts? Or shall we move to the next topic?`,
    Hindi:     (t) => `${t} khatam hua. Koi doubt hai, ya hum agle topic par chalein?`,
    Kannada:   (t) => `${t} mugitu. Yaavude sandehagalu ideyaa? Mundina vishayakke hogalama?`,
    Tamil:     (t) => `${t} mudintathu. Enna santhegam irukkirathaa? Aduttha vishayakku selvomaa?`,
    Telugu:    (t) => `${t} aipoyindi. Meeru emi sandehalu unnaara? Tarvata vishayaaniki velthaamaa?`,
    Marathi:   (t) => `${t} sampla. Kahi shanka aahe kaa? Pudhachyaa vishayavar jaayacha kaa?`,
    Malayalam: (t) => `${t} mudinnu. Valla sandehavum undoo? Aduttha vishayatthilekku pokkaamo?`,
  },

  // Student says "not yet / no" — give them time
  stayHere: {
    English:   'No problem! Take your time. Click Next whenever you are ready.',
    Hindi:     'Theek hai! Aaraam se padho. Tayaar ho jaao tab Next dabao.',
    Kannada:   'Parvaagilla! Nidhaanavaagi odi. Tayaaraadaaga Next click maadi.',
    Tamil:     'Paravaayillai! Nidanamaa padiyungal. Tayaaraana pothu Next click pannungal.',
    Telugu:    'Sari! Nemmadiga chadavandi. Tayarayyaaka Next click cheyyandi.',
    Marathi:   'Thik aahe! Nidhaanepane waachaa. Tayaar zhaalaavar Next daabaa.',
    Malayalam: 'Paravaayilla! Sammadhattil vaayikkuka. Ready aayaale Next click cheyyuka.',
  },

  // Checkpoint — correct answer
  correct: {
    English:   'Correct! Well done.',
    Hindi:     'Bilkul sahi! Bahut accha kiya.',
    Kannada:   'Sari! Tumba chennaagi maadidiri.',
    Tamil:     'Sari! Nalla panniirkal.',
    Telugu:    'Correct! Chaalaa baagundi.',
    Marathi:   'Baro! Chaan keelat.',
    Malayalam: 'Shire! Valare nannaayi.',
  },

  // Checkpoint — wrong answer
  incorrect: {
    English:   (ans, exp) => `Incorrect. The correct answer is ${ans}. ${exp}`,
    Hindi:     (ans, exp) => `Galat. Sahi jawab ${ans} hai. ${exp}`,
    Kannada:   (ans, exp) => `Tappu. Sari uttara ${ans}. ${exp}`,
    Tamil:     (ans, exp) => `Tappaan. Correct answer ${ans}. ${exp}`,
    Telugu:    (ans, exp) => `Tappu. Correct answer ${ans}. ${exp}`,
    Marathi:   (ans, exp) => `Chukle. Barobar uttar ${ans} aahe. ${exp}`,
    Malayalam: (ans, exp) => `Thettaanu. Shari uthaaram ${ans}. ${exp}`,
  },

  // Session complete — passed
  sessionPassed: {
    English:   (t, p) => `Great work! You completed ${t} with ${p} percent. Shall we start the next topic?`,
    Hindi:     (t, p) => `Shabaash! Tumne ${t} complete kiya, score ${p} percent. Agle topic par chalein?`,
    Kannada:   (t, p) => `Tumba chennaagi! ${t} complete maadidiri, score ${p} percent. Mundina vishayakke hogalama?`,
    Tamil:     (t, p) => `Maruvazhi! ${t} mudinttirkal, score ${p} percent. Aduttha vishayakku pogalama?`,
    Telugu:    (t, p) => `Chaalaa baagundi! ${t} complete chesaaru, score ${p} percent. Tarvata vishayaaniki velthaamaa?`,
    Marathi:   (t, p) => `Chaan! ${t} complete kelat, score ${p} percent. Pudhachyaa vishayavar jaayacha kaa?`,
    Malayalam: (t, p) => `Valare nannaayi! ${t} mudinnu, score ${p} percent. Aduttha vishayatthilekku pokkaamo?`,
  },

  // Session complete — didn't pass
  sessionTryAgain: {
    English:   (t, p) => `You scored ${p} percent in ${t}. Keep practising. Next topic?`,
    Hindi:     (t, p) => `${t} mein ${p} percent mila. Practice se aur behtar ho jaoge. Agle topic par chalein?`,
    Kannada:   (t, p) => `${t} alli ${p} percent sigitu. Abhyaasadinda improve aaguttari. Mundina vishayakke hogalama?`,
    Tamil:     (t, p) => `${t} il ${p} percent kidaitthathu. Pazhakkam varum. Aduttha vishayakku pogalama?`,
    Telugu:    (t, p) => `${t} lo ${p} percent vachchindi. Abhyaasam cheste better avutundi. Tarvata vishayaaniki velthaamaa?`,
    Marathi:   (t, p) => `${t} madhe ${p} percent aale. Sarav kela ki changlai yeil. Pudhachyaa vishayavar jaayacha kaa?`,
    Malayalam: (t, p) => `${t} il ${p} percent kittini. Praavsham valarthum. Aduttha vishayatthilekku pokkaamo?`,
  },

  // "Next topic?" short reprompt after answering a doubt
  nextTopicAsk: {
    English:   'Any more doubts? Or shall we continue?',
    Hindi:     'Aur koi doubt hai? Ya agle topic par chalein?',
    Kannada:   'Innu yaavade sandehavaa? Illaa mundakke hogalama?',
    Tamil:     'Innum santhegam irukkirathaa? Illaa thodaralama?',
    Telugu:    'Inkaa sandehalu unnaayaa? Leka tarvata ki velthaamaa?',
    Marathi:   'Aanikahi shanka aahe kaa? Kinkva pudhakde jaayacha kaa?',
    Malayalam: 'Innum sandehangal undoo? Athallengil thodaraamo?',
  },

  // Right after answering a doubt — "did that clear it?" (yes → continue, no → re-explain)
  doubtClearAsk: {
    English:   'Did that clear your doubt? Say yes or no.',
    Hindi:     'Kya doubt clear ho gaya? Haan ya nahi bolo.',
    Kannada:   'Sandeha clear aaytaa? Houdu athavaa illa heli.',
    Tamil:     'Santhegam clear aachaa? Aamaa illa illai sollungal.',
    Telugu:    'Sandeham clear ayyindaa? Avunu leda kaadu cheppandi.',
    Marathi:   'Shanka dur zhaali kaa? Ho kinkva naahi saanga.',
    Malayalam: 'Sandeham clear aayoo? Athe alle alla parayoo.',
  },

  // Student still not clear after two re-explains — move on gracefully
  letsContinue: {
    English:   'No worries — this one takes time. Read the notes on screen, and ask me again anytime.',
    Hindi:     'Koi baat nahi — yeh topic thoda time leta hai. Screen par notes padho, aur kabhi bhi phir se poochho.',
    Kannada:   'Parvaagilla — idu swalpa samaya tegedukolluttade. Screen alli notes odi, matthe yaavaagaladaru keli.',
    Tamil:     'Paravaayillai — ithu konjam neram edukkum. Screen la notes padiyungal, eppo vendumaanaalum kelunga.',
    Telugu:    'Parvaledu — idi konchem time padutundi. Screen lo notes chadavandi, eppudaina malli adagandi.',
    Marathi:   'Kahi harkat naahi — yala thoda vel laagto. Screen varche notes waachaa, ani kadhihi parat vichaaraa.',
    Malayalam: 'Saaramilla — ithinu kurachu samayam vendam. Screenile notes vaayikkuka, eppozhenkilum veendum chodikkuka.',
  },

  // Goodbye after student says no
  goodbye: {
    English:   'Alright! You did great today. See you next time. Goodbye!',
    Hindi:     'Theek hai! Aaj bahut accha kiya. Phir milenge. Goodbye!',
    Kannada:   'Sari! Ivaththu tumba chennaagi maadidiri. Mathe sigona. Goodbye!',
    Tamil:     'Sari! Indru nalla panniirkal. Marupadiyum kaanaalam. Goodbye!',
    Telugu:    'Sari! Indu chaalaa baagundi. Tarvata kalisukundam. Goodbye!',
    Marathi:   'Thik aahe! Aaj chaan keelat. Parat bhetuyaa. Goodbye!',
    Malayalam: 'Shari! Innu valare nannaayi. Pinne kaanaam. Goodbye!',
  },
};

/** Get a JD phrase for the given language. Fallback → English. */
const jdPhrase = (map, lang, ...args) => {
  const fn = map[lang] || map['English'];
  return typeof fn === 'function' ? fn(...args) : fn;
};

// BCP-47 code → language name (for speak() calls that pass 'hi-IN' etc.)
const TTS_CODE_TO_LANG = Object.fromEntries(
  TUTOR_LANGS.map(l => [l.tts, l.code])
);

/**
 * useSarvamTTS — production-grade Sarvam AI TTS hook.
 *
 * Features:
 *  • Fetches WAV from /tts/speak (Sarvam backend) and plays it
 *  • AbortController cancels in-flight fetches when stopAll() is called
 *  • Detects browser autoplay block (NotAllowedError) and installs a
 *    ONE-SHOT global interaction listener — the buffered audio plays the
 *    instant the user taps/clicks/presses any key, with zero extra friction
 *  • Exposes `fetching` (audio loading) and `blocked` (awaiting user tap)
 *    so the UI can show the right status message
 *
 * speak(text, langCodeOrName, onDone)
 *   lang: BCP-47 ('hi-IN') | language name ('Hindi') | null → defaultLanguage
 *   onDone: fires when audio ends OR on error (flow always continues)
 */
/* Split text into speakable chunks at sentence boundaries.
   The FIRST chunk is kept small so audio starts almost immediately —
   the rest are prefetched while earlier chunks play (pipelining). */
const _SENT_SPLIT = /(?<=[.!?।])\s+/;
function splitForSpeech(text) {
  const sents = text.replace(/\n+/g, ' ').split(_SENT_SPLIT).map(s => s.trim()).filter(Boolean);
  if (sents.length <= 1) return [text.trim()];
  const chunks = [];
  let cur = '';
  for (const s of sents) {
    const target = chunks.length === 0 ? 150 : 300;   // small first chunk = fast start
    if (!cur) cur = s;
    else if (cur.length + 1 + s.length <= target) cur += ' ' + s;
    else { chunks.push(cur); cur = s; }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function useSarvamTTS(defaultLanguage = 'English') {
  const audioRef    = useRef(null);
  const sessionRef  = useRef(0);            // bump = invalidate any in-flight chain
  const abortersRef = useRef(new Set());    // all in-flight fetch controllers
  const blobUrlsRef = useRef(new Set());
  const pendingRef  = useRef(null);         // queued play() waiting for user gesture

  const [fetching, setFetching] = useState(false);
  const [blocked,  setBlocked]  = useState(false);

  // ── Install a one-shot interaction listener ─────────────────────────────
  const installUnlock = useCallback((playFn) => {
    pendingRef.current = playFn;
    setBlocked(true);
    const run = () => {
      setBlocked(false);
      const fn = pendingRef.current;
      pendingRef.current = null;
      fn?.();
    };
    // Any interaction type unlocks autoplay
    ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt =>
      window.addEventListener(evt, run, { once: true, capture: true })
    );
  }, []);

  // ── Stop everything immediately ─────────────────────────────────────────
  const stopAll = useCallback(() => {
    sessionRef.current += 1;                    // kill any running speak() chain
    abortersRef.current.forEach(c => c.abort());
    abortersRef.current.clear();
    pendingRef.current = null;
    setFetching(false);
    setBlocked(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src     = '';
    }
    blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    blobUrlsRef.current.clear();
  }, []);

  // ── Speak (pipelined) ────────────────────────────────────────────────────
  // Text is split into sentence chunks. Chunk N+1 is fetched from Sarvam
  // WHILE chunk N plays, so the wait is only ever the first short chunk —
  // not the whole script. onDone fires after the last chunk finishes.
  const speak = useCallback(async (text, langParam, onDone) => {
    if (!text?.trim()) { onDone?.(); return; }
    stopAll();
    const session = sessionRef.current;
    const dead = () => sessionRef.current !== session;

    const langName = langParam
      ? (TTS_CODE_TO_LANG[langParam] || langParam)
      : defaultLanguage;

    const chunks = splitForSpeech(text);
    setFetching(true);

    const fetchChunk = (chunkText) => {
      const ctrl = new AbortController();
      abortersRef.current.add(ctrl);
      return fetch(`${API}/tts/speak`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text: chunkText, language: langName, engine: 'sarvam' }),
        signal: ctrl.signal,
      })
        .then(res => { if (!res.ok) throw new Error(`tts ${res.status}`); return res.blob(); })
        .finally(() => abortersRef.current.delete(ctrl));
    };

    const playBlob = (blob) => new Promise((resolve) => {
      if (dead()) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      blobUrlsRef.current.add(url);
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        blobUrlsRef.current.delete(url);
        resolve();
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.src = url;
      audio.play()
        .then(() => setFetching(false))
        .catch(err => {
          if (err?.name === 'NotAllowedError') {
            // Autoplay blocked — audio is buffered, plays on first user gesture
            setFetching(false);
            installUnlock(() => audio.play().catch(cleanup));
          } else {
            cleanup();
          }
        });
    });

    try {
      let nextFetch = fetchChunk(chunks[0]);
      for (let i = 0; i < chunks.length; i++) {
        const blob = await nextFetch;
        if (dead()) return;
        if (i + 1 < chunks.length) nextFetch = fetchChunk(chunks[i + 1]);  // prefetch
        await playBlob(blob);
        if (dead()) return;
      }
      setFetching(false);
      onDone?.();
    } catch (err) {
      if (dead() || err?.name === 'AbortError') return;   // cancelled — no-op
      setFetching(false);
      onDone?.();
    }
  }, [defaultLanguage, stopAll, installUnlock]);

  // Silence Sarvam while the mic listens (lesson audio can't seek-resume,
  // so this is a hard stop under a softer name kept for API compatibility).
  const pause = useCallback(() => { stopAll(); }, [stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  return { speak, stopAll, pause, fetching, blocked };
}

// ── XP table ─────────────────────────────────────────────────────────────────
const XP = { lesson: 20, checkpoint_correct: 5, assess_pass: 50, expert_bonus: 30, perfect_bonus: 50 };

// ── Badge helpers ─────────────────────────────────────────────────────────────
const SPECIAL_BADGES = [
  { key: 'chapter_master',  icon: '🏅', name: 'Chapter Master',   color: '#f59e0b', desc: 'Pass any chapter assessment' },
  { key: 'chapter_expert',  icon: '🥇', name: 'Chapter Expert',   color: '#fbbf24', desc: 'Score 90%+ in any chapter' },
  { key: 'perfect_scholar', icon: '👑', name: 'Perfect Scholar',   color: '#f97316', desc: 'Score 100% in any chapter' },
  { key: 'bns_master',      icon: '⚖️', name: 'BNS Master',        color: '#6366f1', desc: 'Complete all BNS chapters' },
  { key: 'ipc_legend',      icon: '⚔️', name: 'IPC Legend',        color: '#ef4444', desc: 'Complete all IPC chapters' },
  { key: 'grand_jurist',    icon: '🏆', name: 'Grand Jurist',      color: '#22d3ee', desc: 'Complete both courses' },
];

// ── LocalStorage progress helpers ────────────────────────────────────────────
const STORAGE_KEY = 'vidhan_tutor_progress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { bns: {}, ipc: {} };
  } catch { return { bns: {}, ipc: {} }; }
}

function saveProgress(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

function getLawProgress(progress, lawCode) {
  const key = lawCode.toLowerCase();
  return progress[key] || {
    xp: 0,
    badges: [],
    special_badges: [],
    chapters_completed: [],
    assessment_scores: {},
    bookmarks: [],
    last_chapter: null,
    last_section: null,
  };
}

function setLawProgress(progress, lawCode, data) {
  const key = lawCode.toLowerCase();
  return { ...progress, [key]: data };
}

// ── Small UI atoms ────────────────────────────────────────────────────────────
function JDAvatar({ state = 'idle' }) {
  return (
    <div className={`tutor-jd-avatar tutor-jd-avatar--${state}`}>
      <VidhanLogo size={40} />
      {state === 'thinking' && <div className="tutor-jd-dots"><span/><span/><span/></div>}
      {state === 'speaking' && <div className="tutor-jd-wave"><span/><span/><span/><span/></div>}
    </div>
  );
}

function XPBar({ xp }) {
  const level = Math.floor(xp / 200) + 1;
  const pct = ((xp % 200) / 200) * 100;
  return (
    <div className="tutor-xp-bar">
      <span className="tutor-xp-lv">Lv {level}</span>
      <div className="tutor-xp-track"><div className="tutor-xp-fill" style={{ width: `${pct}%` }} /></div>
      <span className="tutor-xp-num">{xp} XP</span>
    </div>
  );
}

function ProgressRing({ pct, size = 52, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="tutor-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#6366f1" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={dash}
        strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="11" fill="#e2e8f0" fontFamily="Inter">{pct}%</text>
    </svg>
  );
}

// ── View: Path → Language Select (2-step setup, single unified learning mode) ─
function PathSelect({ onSelect, progress }) {
  // step: 'path' | 'lang'
  const [step,         setStep]         = useState('path');
  const [selectedPath, setSelectedPath] = useState(null);

  const PATHS = [
    { code: 'BNS', label: 'BNS 2023', sub: 'Bharatiya Nyaya Sanhita', icon: '⚖️', desc: 'Modern Indian criminal law enacted in 2023', color: '#6366f1' },
    { code: 'IPC', label: 'IPC 1860', sub: 'Indian Penal Code',        icon: '⚔️', desc: 'Original Indian criminal code (historical)', color: '#ef4444' },
  ];

  const bnsP = getLawProgress(progress, 'BNS');
  const ipcP = getLawProgress(progress, 'IPC');

  /* ── Step 2: Language ── */
  if (step === 'lang') {
    return (
      <div className="tutor-select-root">
        <button className="tutor-back-link" onClick={() => setStep('path')}>← Back</button>
        <div className="tutor-select-header">
          <h2>Choose Your Language</h2>
          <p>JD will greet you and respond in your preferred language</p>
        </div>
        <div className="tutor-lang-grid">
          {TUTOR_LANGS.map(l => (
            <motion.button
              key={l.code}
              className="tutor-lang-card"
              whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(99,102,241,0.25)' }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(selectedPath, 'general', l.code)}
            >
              <span className="tutor-lang-flag">{l.flag}</span>
              <span className="tutor-lang-native">{l.native}</span>
              <span className="tutor-lang-label">{l.code}</span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Step 1: Path ── */
  return (
    <div className="tutor-select-root">
      <div className="tutor-select-header">
        <JDAvatar state="speaking" />
        <h1>Welcome to Law Tutor</h1>
        <p>Learn Indian law chapter by chapter with JD — your AI legal tutor.</p>
        <p className="tutor-select-sub">Understand concepts, not just section numbers.</p>
      </div>

      <div className="tutor-path-grid">
        {PATHS.map(p => {
          const lp = p.code === 'BNS' ? bnsP : ipcP;
          const done = lp.chapters_completed?.length || 0;
          return (
            <motion.button
              key={p.code}
              className="tutor-path-card"
              style={{ '--path-color': p.color }}
              whileHover={{ y: -6, boxShadow: `0 16px 40px ${p.color}33` }}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setSelectedPath(p.code); setStep('lang'); }}
            >
              <span className="tutor-path-icon">{p.icon}</span>
              <span className="tutor-path-label">{p.label}</span>
              <span className="tutor-path-sub">{p.sub}</span>
              <span className="tutor-path-desc">{p.desc}</span>
              {done > 0 && <span className="tutor-path-resume">{done} chapter{done !== 1 ? 's' : ''} done · {lp.xp} XP</span>}
            </motion.button>
          );
        })}
      </div>

      <button className="tutor-achievements-btn" onClick={() => onSelect('__achievements__', 'any', 'English')}>
        🏆 View My Achievements
      </button>
    </div>
  );
}

// ── View: Chapter Grid ────────────────────────────────────────────────────────
function ChapterList({ lawCode, mode, lawProgress, onStartChapter, onBack, onShowAchievements }) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/tutor/chapters/${lawCode}`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setChapters(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setChapters([]); setLoading(false); });
  }, [lawCode]);

  const completed  = lawProgress.chapters_completed || [];
  const scores     = lawProgress.assessment_scores || {};

  const isUnlocked = (num) => num === 1 || completed.includes(num - 1);
  const isDone     = (num) => completed.includes(num);

  return (
    <div className="tutor-chapters-root">
      <div className="tutor-chapters-header">
        <button className="tutor-back-link" onClick={onBack}>← Back</button>
        <div className="tutor-chapters-title-row">
          <h2>{lawCode === 'BNS' ? '⚖️ BNS 2023' : '⚔️ IPC 1860'} — Chapters</h2>
          <div className="tutor-chapters-meta">
            <XPBar xp={lawProgress.xp || 0} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="tutor-loading"><div className="tutor-spinner" /><p>Loading chapters…</p></div>
      ) : chapters.length === 0 ? (
        <div className="tutor-loading">
          <p style={{ color: '#ef4444' }}>⚠️ Could not load chapters. Make sure the backend is running and MongoDB is connected.</p>
          <button className="tutor-nav-btn tutor-nav-btn--secondary" onClick={onBack}>← Go Back</button>
        </div>
      ) : (
        <div className="tutor-chapter-grid">
          {chapters.map((ch, idx) => {
            const unlocked = isUnlocked(ch.chapter_num);
            const done     = isDone(ch.chapter_num);
            const score    = scores[ch.chapter_num];
            const isLast   = lawProgress.last_chapter === ch.chapter_num;

            return (
              <motion.div
                key={ch.chapter_num}
                className={`tutor-chapter-card${done ? ' tutor-chapter-card--done' : ''}${!unlocked ? ' tutor-chapter-card--locked' : ''}${isLast ? ' tutor-chapter-card--last' : ''}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => unlocked && onStartChapter(ch)}
              >
                <div className="tutor-ch-top">
                  <div className="tutor-ch-badge" style={{ background: ch.badge?.color + '22', color: ch.badge?.color }}>
                    {done ? '✅' : !unlocked ? '🔒' : ch.badge?.icon || '📖'}
                  </div>
                  <div className="tutor-ch-info">
                    <span className="tutor-ch-num">Chapter {ch.chapter_num}</span>
                    <span className="tutor-ch-name">{ch.short_name}</span>
                    <span className="tutor-ch-secs">{ch.section_count} sections</span>
                  </div>
                  {done && score !== undefined && (
                    <ProgressRing pct={score} size={52} stroke={4} />
                  )}
                  {!done && unlocked && <span className="tutor-ch-arrow">→</span>}
                  {!unlocked && <span className="tutor-ch-lock">🔒</span>}
                </div>
                {isLast && !done && (
                  <div className="tutor-ch-resume-tag">▶ Resume</div>
                )}
                {done && (
                  <div className="tutor-ch-done-tag">✓ Completed · {score}%</div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Lesson preparing state — live checklist + real content so the user is
//    never staring at empty skeleton bars while the AI writes the lesson ──────
const PREP_STEPS = [
  '📖 Reading the section text…',
  '✍️ Rewriting it in plain language…',
  '🌟 Finding a real-life example…',
  '⚖️ Defining the legal terms…',
  '🧠 Preparing your checkpoint question…',
];

function LessonPreparing({ sec }) {
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStepIdx(i => Math.min(i + 1, PREP_STEPS.length - 1)),
      2200,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="tutor-prep-root">
      {/* JD's live preparation checklist */}
      <div className="tutor-prep-card">
        <div className="tutor-prep-head">
          <span className="tutor-prep-pulse" aria-hidden="true" />
          JD is preparing your lesson
        </div>
        <div className="tutor-prep-steps">
          {PREP_STEPS.map((s, i) => (
            <div
              key={s}
              className={`tutor-prep-step${i < stepIdx ? ' tutor-prep-step--done' : i === stepIdx ? ' tutor-prep-step--active' : ''}`}
            >
              <span className="tutor-prep-tick">
                {i < stepIdx ? '✓' : i === stepIdx ? '●' : '○'}
              </span>
              {s}
            </div>
          ))}
        </div>
      </div>

      {/* Real content the user can read RIGHT NOW — no AI needed */}
      {sec?.text && (
        <motion.div
          className="tutor-law-text-box"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="tutor-law-text-label">📜 Legal Text — start reading while JD prepares</div>
          <p className="tutor-law-text">{sec.text}</p>
        </motion.div>
      )}
      {sec?.punishment && (
        <div className="tutor-punishment-box">
          <span className="tutor-punishment-label">⚖️ Punishment</span>
          <span>{sec.punishment}</span>
        </div>
      )}
    </div>
  );
}

// ── View: Lesson ──────────────────────────────────────────────────────────────
function LessonView({ lawCode, chapter, mode, language, lawProgress, onComplete, onBack, addXP }) {
  const { speak, stopAll, pause: pauseLesson, fetching: ttsLoading, blocked: ttsBlocked } = useSarvamTTS(language);

  const [sections, setSections]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [secIdx, setSecIdx]                 = useState(0);
  const [lesson, setLesson]                 = useState(null);
  const [lessonLoading, setLessonLoad]      = useState(false);
  const [checkpoint, setCheckpoint]         = useState(null);
  const [cpAnswer, setCpAnswer]             = useState(null);
  const [cpRevealed, setCpRevealed]         = useState(false);
  const [bookmarked, setBookmarked]         = useState([]);
  const [jdState, setJdState]               = useState('idle');
  const [voiceMuted, setVoiceMuted]         = useState(false);
  const [waitingConfirm, setWaitingConfirm] = useState(false);
  const [readyToTeach, setReadyToTeach]     = useState(false);
  const [listeningYN, setListeningYN]       = useState(false);
  // Doubt / Q&A feature
  const [doubtOpen, setDoubtOpen]           = useState(false);
  const [doubtText, setDoubtText]           = useState('');
  const [doubtAnswer, setDoubtAnswer]       = useState('');
  const [doubtLoading, setDoubtLoad]        = useState(false);
  const [doubtListening, setDoubtListening] = useState(false);
  const [doubtHistory, setDoubtHistory]     = useState([]); // [{q, a}]
  const doubtThreadRef                      = useRef(null);
  const contentRef      = useRef(null);
  const mutedRef        = useRef(false);
  const recogRef        = useRef(null);      // yes/no recognition
  const doubtRecogRef   = useRef(null);      // doubt voice recognition
  const sectionsRef     = useRef([]);
  const introTimerRef     = useRef(null);
  const doubtInputRef     = useRef(null);
  const secIdxRef         = useRef(0);
  const submitDoubtRef    = useRef(null);  // always-fresh ref to handleSubmitDoubt
  const goNextRef         = useRef(null);  // always-fresh ref to goNext (avoids TDZ in handleSubmitDoubt)
  const stayHereRef       = useRef(null);  // always-fresh ref to stayHere
  const doubtHistoryRef   = useRef([]);    // always-fresh doubt history for re-explain context
  const greetedChapterRef = useRef(null);  // chapter_num already welcomed (speak once)

  // ── Voice interrupt state (mic button during lesson) ──────────────────────
  const [interruptListening, setInterruptListening] = useState(false);
  const [interruptText,      setInterruptText]      = useState('');
  const interruptRecogRef = useRef(null);

  useEffect(() => { mutedRef.current = voiceMuted; }, [voiceMuted]);
  useEffect(() => { doubtHistoryRef.current = doubtHistory; }, [doubtHistory]);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { secIdxRef.current = secIdx; }, [secIdx]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopAll();
    clearTimeout(introTimerRef.current);
    try { recogRef.current?.abort();       } catch (_) {}
    try { doubtRecogRef.current?.abort();  } catch (_) {}
    try { interruptRecogRef.current?.stop(); } catch (_) {}
  }, [stopAll]);

  // ── Voice yes/no listener ──────────────────────────────────────────────────
  const stopYNListen = useCallback(() => {
    setListeningYN(false);
    try { recogRef.current?.abort(); } catch (_) {}
  }, []);

  const startYNListen = useCallback((onYes, onNo) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recog.lang = LANG_TTS[language] || 'en-IN';   // use the student's language
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 3;
    recog.onstart = () => setListeningYN(true);
    recog.onend   = () => setListeningYN(false);
    recog.onresult = (e) => {
      const text = Array.from(e.results[0]).map(r => r.transcript).join(' ').toLowerCase().trim();
      if (/\b(yes|yeah|sure|ok|okay|next|go|continue|haan|ha|aage|chalte|chalein)\b/.test(text)) {
        onYes();
      } else if (/\b(no|nope|wait|hold|stay|nahi|na|ruko|dobara)\b/.test(text)) {
        onNo();
      }
    };
    recog.onerror = () => setListeningYN(false);
    recogRef.current = recog;
    try { recog.start(); } catch (_) {}
  }, [language]);

  // ── Doubt: voice & submit ──────────────────────────────────────────────────
  const stopDoubtVoice = useCallback(() => {
    setDoubtListening(false);
    try { doubtRecogRef.current?.abort(); } catch (_) {}
  }, []);

  // ── Interrupt mic: stop lesson + listen to student question ───────────────
  const stopInterruptMic = useCallback(() => {
    setInterruptListening(false);
    setInterruptText('');
    try { interruptRecogRef.current?.stop(); } catch (_) {}
    interruptRecogRef.current = null;
  }, []);

  const handleInterruptMic = useCallback(() => {
    if (interruptListening) { stopInterruptMic(); return; }

    // 1. Silence Sarvam immediately
    pauseLesson();
    stopYNListen();
    setWaitingConfirm(false);
    setJdState('idle');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      // No browser SR → open typed doubt panel
      setDoubtOpen(true);
      setTimeout(() => doubtInputRef.current?.focus(), 60);
      return;
    }

    setInterruptText('');
    setInterruptListening(true);

    const recog = new SR();
    recog.lang           = LANG_TTS[language] || 'en-IN';
    recog.continuous     = false;
    recog.interimResults = true;
    recog.maxAlternatives = 2;

    recog.onresult = (evt) => {
      const last    = evt.results[evt.results.length - 1];
      const txt     = last[0].transcript || '';
      setInterruptText(txt);
      if (last.isFinal && txt.trim()) {
        stopInterruptMic();
        setDoubtText(txt);
        setDoubtOpen(true);     // open panel so user sees the answer text immediately
        submitDoubtRef.current?.(txt);
      }
    };
    recog.onerror = () => {
      stopInterruptMic();
      setDoubtOpen(true);   // fallback: let student type
      setTimeout(() => doubtInputRef.current?.focus(), 60);
    };
    recog.onend = () => {
      setInterruptListening(false);
      interruptRecogRef.current = null;
    };

    interruptRecogRef.current = recog;
    try { recog.start(); } catch (_) { stopInterruptMic(); }
  }, [interruptListening, language, pauseLesson, stopYNListen, stopInterruptMic, setDoubtText]);

  const startDoubtVoice = useCallback(() => {
    // Silence Sarvam immediately so mic doesn't pick up lesson audio
    pauseLesson();
    stopYNListen();
    setWaitingConfirm(false);

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = LANG_TTS[language] || 'en-IN';   // student's language
    r.continuous = false;
    r.interimResults = true;
    r.onstart = () => setDoubtListening(true);
    r.onend   = () => setDoubtListening(false);
    r.onresult = (e) => {
      const last     = e.results[e.results.length - 1];
      const isFinal  = last.isFinal;
      const txt      = last[0].transcript || '';
      setDoubtText(txt);
      if (isFinal && txt.trim()) submitDoubtRef.current?.(txt);
    };
    r.onerror = () => setDoubtListening(false);
    doubtRecogRef.current = r;
    try { r.start(); } catch (_) {}
  }, [language, pauseLesson, stopYNListen]);

  /* ── Live doubt loop ────────────────────────────────────────────────────
     answer → JD asks "Did that clear your doubt?" (voice) →
       YES → "any more doubts / continue?" flow (unchanged)
       NO  → JD re-explains from a COMPLETELY new angle (up to 2 times),
             then gracefully moves on. The student never types a word. */
  const askDoubtClearRef = useRef(null);

  const handleSubmitDoubt = useCallback((question, { reexplain = false, attempt = 0 } = {}) => {
    const q = question?.trim();
    if (!q) return;
    const currentSec = sectionsRef.current[secIdxRef.current];
    setDoubtLoad(true);
    if (!reexplain) setDoubtAnswer('');
    stopAll();
    stopYNListen();
    setWaitingConfirm(false);

    fetch(`${API}/tutor/doubt`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        law_code: lawCode,
        section_number: currentSec?.section_number || '',
        section_title:  currentSec?.title || '',
        section_text:   currentSec?.text || currentSec?.summary || '',
        question: q,
        mode, language,
        reexplain,
        history: doubtHistoryRef.current.slice(-4),
      }),
    })
      .then(r => r.json())
      .then(d => {
        const ans = d.answer || 'Sorry, I could not answer that. Please try again.';
        setDoubtAnswer(ans);
        setDoubtHistory(prev => [...prev, { q, a: ans }]);
        setDoubtLoad(false);
        // scroll thread to bottom
        setTimeout(() => {
          if (doubtThreadRef.current) doubtThreadRef.current.scrollTop = doubtThreadRef.current.scrollHeight;
        }, 80);
        if (!mutedRef.current) {
          setJdState('speaking');
          // null → useSarvamTTS automatically uses the student's language
          speak(ans, null, () => {
            setJdState('idle');
            if (mutedRef.current) { setWaitingConfirm(true); return; }
            askDoubtClearRef.current?.(q, attempt);
          });
        } else {
          setWaitingConfirm(true);
        }
      })
      .catch(() => {
        setDoubtLoad(false);
        setDoubtAnswer('Something went wrong. Please try again.');
      });
  }, [lawCode, mode, language, speak, stopAll, stopYNListen]); // eslint-disable-line
  submitDoubtRef.current = handleSubmitDoubt;  // keep ref always fresh

  /* "Did that clear your doubt?" — spoken follow-up that closes the live loop. */
  const askDoubtClear = useCallback((lastQuestion, attempt) => {
    const moveOn = () => {
      setJdState('speaking');
      speak(jdPhrase(JD_PHRASES.nextTopicAsk, language), null, () => {
        setJdState('idle');
        setWaitingConfirm(true);
        startYNListen(goNextRef.current, stayHereRef.current);
      });
    };
    // After 2 re-explains, don't loop forever — reassure and move on.
    if (attempt >= 2) {
      setJdState('speaking');
      speak(jdPhrase(JD_PHRASES.letsContinue, language), null, () => {
        setJdState('idle');
        moveOn();
      });
      return;
    }
    setTimeout(() => {
      setJdState('speaking');
      speak(jdPhrase(JD_PHRASES.doubtClearAsk, language), null, () => {
        setJdState('idle');
        setWaitingConfirm(true);
        startYNListen(
          () => { setWaitingConfirm(false); moveOn(); },                                     // yes → cleared
          () => {                                                                            // no  → new angle
            setWaitingConfirm(false);
            submitDoubtRef.current?.(lastQuestion, { reexplain: true, attempt: attempt + 1 });
          },
        );
      });
    }, 300);
  }, [language, speak, startYNListen]); // eslint-disable-line
  askDoubtClearRef.current = askDoubtClear;

  // ── Advance to next section ────────────────────────────────────────────────
  const goNext = useCallback(() => {
    stopYNListen();
    stopDoubtVoice();
    setWaitingConfirm(false);
    setDoubtOpen(false);
    setDoubtText('');
    setDoubtAnswer('');
    setDoubtHistory([]);
    stopAll();
    setJdState('idle');
    setSecIdx(i => i + 1);
  }, [stopAll, stopYNListen, stopDoubtVoice]);

  const stayHere = useCallback(() => {
    stopYNListen();
    setWaitingConfirm(false);
    if (!mutedRef.current) {
      setJdState('speaking');
      speak(jdPhrase(JD_PHRASES.stayHere, language), null, () => setJdState('idle'));
    }
  }, [speak, stopYNListen, language]);

  // Keep refs always fresh so callbacks defined before these can call them safely
  goNextRef.current   = goNext;
  stayHereRef.current = stayHere;

  // ── Speak lesson then ask "move to next?" ─────────────────────────────────
  // speakRef keeps the closure fresh so the lesson useEffect always calls the
  // latest version even when deps have changed between renders.
  const speakLessonRef = useRef(null);

  const speakLesson = useCallback((lessonData, sec, isLastSec) => {
    // spoken_script is a pre-formatted teacher monologue generated by Groq —
    // sounds like a real class, not a dry list.
    // Fallback to assembling fields only if the new field is absent (old API response).
    const parts = lessonData.spoken_script?.trim() || [
      lessonData.simple_title      ? `Today we look at ${lessonData.simple_title}.`    : '',
      lessonData.why_it_exists     ? `${lessonData.why_it_exists}`                     : '',
      lessonData.plain_explanation ? `${lessonData.plain_explanation}`                 : '',
      lessonData.analogy           ? `${lessonData.analogy}`                           : '',
      lessonData.real_example      ? `Here is an example. ${lessonData.real_example}` : '',
      lessonData.remember          ? `Remember this. ${lessonData.remember}`           : '',
    ].filter(Boolean).join('  ');

    setJdState('speaking');
    speak(parts, null, () => {
      setJdState('idle');
      if (isLastSec || mutedRef.current) return;
      setTimeout(() => {
        setJdState('speaking');
        speak(
          jdPhrase(JD_PHRASES.endOfSection, language, lessonData.simple_title || sec.title),
          null,
          () => {
            setJdState('idle');
            setWaitingConfirm(true);
            startYNListen(goNext, stayHere);
          }
        );
      }, 300);
    });
  }, [speak, startYNListen, goNext, stayHere]);

  // Keep ref always fresh so the lesson-load effect gets the latest closure
  speakLessonRef.current = speakLesson;

  // ── Load sections + speak chapter intro ───────────────────────────────────
  useEffect(() => {
    stopAll();
    clearTimeout(introTimerRef.current);
    try { recogRef.current?.abort(); } catch (_) {}
    try { doubtRecogRef.current?.abort(); } catch (_) {}
    setLoading(true);
    setReadyToTeach(false);
    setWaitingConfirm(false);
    setDoubtOpen(false);
    setDoubtText('');
    setDoubtAnswer('');

    fetch(`${API}/tutor/chapter/${lawCode}/${chapter.chapter_num}/sections`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { sections: [] })
      .then(d => {
        const secs = Array.isArray(d?.sections) ? d.sections : [];
        setSections(secs);
        setBookmarked(lawProgress.bookmarks || []);
        setLoading(false);

        const markReady = () => { clearTimeout(introTimerRef.current); setJdState('idle'); setReadyToTeach(true); };

        // Speak the chapter welcome only ONCE per chapter — guard against the
        // effect re-running (StrictMode double-mount, re-renders, mode toggles).
        const alreadyGreeted = greetedChapterRef.current === chapter.chapter_num;
        if (!secs.length || mutedRef.current || alreadyGreeted) { markReady(); return; }
        greetedChapterRef.current = chapter.chapter_num;

        const names   = secs.slice(0, 4).map(s => s.title).join(', ');
        const more    = secs.length > 4 ? `, and ${secs.length - 4} more` : '';
        const greet   = LANG_GREET[language] || '';
        const ttsLang = LANG_TTS[language] || 'en-IN';

        // Romanised template — only a fallback if the backend greeting fails.
        const templateIntro = {
          English:   `${greet}Welcome to Chapter ${chapter.chapter_num}: ${chapter.short_name}. We have ${secs.length} sections to cover — ${names}${more}. Let us begin!`,
          Hindi:     `${greet}Chapter ${chapter.chapter_num}: ${chapter.short_name} mein aapka swagat hai. Is chapter mein ${secs.length} sections hain — ${names}${more}. Chalo shuru karte hain!`,
          Kannada:   `${greet}Chapter ${chapter.chapter_num}: ${chapter.short_name} ge swaagata. Ee chapteralli ${secs.length} sections ide — ${names}${more}. Shuru maadona!`,
          Tamil:     `${greet}Chapter ${chapter.chapter_num}: ${chapter.short_name} ku varavergal. Idil ${secs.length} paakaangal — ${names}${more}. Aarambikkalaam!`,
          Telugu:    `${greet}Chapter ${chapter.chapter_num}: ${chapter.short_name} ki swagatam. Ee chapterlo ${secs.length} sections unnaayi — ${names}${more}. Mana class moni moku!`,
          Marathi:   `${greet}Chapter ${chapter.chapter_num}: ${chapter.short_name} madhe swagat aahe. Ya chapter mein ${secs.length} vibhaag aahet — ${names}${more}. Chalya suruvaaat karuyaa!`,
          Malayalam: `${greet}Chapter ${chapter.chapter_num}: ${chapter.short_name} nte koodathe svaagataM. Idil ${secs.length} vibhaagangal und — ${names}${more}. Thudangaam!`,
        }[language] || `${greet}Welcome to Chapter ${chapter.chapter_num}: ${chapter.short_name}. We have ${secs.length} sections — ${names}${more}. Let us begin!`;

        const speakIntro = (text) => {
          // Safety: if TTS onDone never fires (autoplay block etc.), proceed anyway.
          introTimerRef.current = setTimeout(markReady, 12000);
          setJdState('speaking');
          speak(text, ttsLang, markReady);
        };

        // Fetch a proper NATIVE-SCRIPT greeting from the backend (works in every
        // language); fall back to the romanised template only if it fails.
        fetch(`${API}/tutor/chapter-intro`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            law_code:       lawCode,
            chapter_name:   chapter.short_name,
            section_titles: secs.slice(0, 6).map(s => s.title),
            language,
          }),
        })
          .then(r => (r.ok ? r.json() : null))
          .then(d => speakIntro((d && d.ok && d.intro) ? d.intro : templateIntro))
          .catch(() => speakIntro(templateIntro));
      })
      .catch(() => { setSections([]); setLoading(false); setReadyToTeach(true); });
  }, [lawCode, chapter.chapter_num]); // eslint-disable-line

  // ── Load & auto-speak lesson when section changes (after intro done) ───────
  useEffect(() => {
    if (!readyToTeach || !sections.length) return;
    const sec = sections[secIdx];
    if (!sec) return;

    setLesson(null);
    setCheckpoint(null);
    setCpAnswer(null);
    setCpRevealed(false);
    setWaitingConfirm(false);
    setLessonLoad(true);
    setJdState('thinking');
    stopAll();
    try { recogRef.current?.abort(); } catch (_) {}

    const contextSecs = sections.slice(Math.max(0, secIdx - 1), secIdx + 2)
      .map(s => `${s.section_number}: ${s.title}`)
      .join(', ');

    fetch(`${API}/tutor/lesson`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        law_code:       lawCode,
        section_number: sec.section_number,
        section_title:  sec.title,
        section_text:   sec.text || sec.summary || '',
        punishment:     sec.punishment || '',
        mode,
        language,
        context:        contextSecs,
      }),
    })
      .then(r => r.json())
      .then(d => {
        let lessonData;
        if (d.ok && d.lesson) {
          lessonData = d.lesson;
          if (d.lesson.checkpoint_question) setCheckpoint(d.lesson.checkpoint_question);
        } else {
          lessonData = { simple_title: sec.title, plain_explanation: sec.text || sec.summary || '', key_concepts: [], real_example: '', remember: '' };
        }
        setLesson(lessonData);
        setLessonLoad(false);
        addXP(XP.lesson);
        if (contentRef.current) contentRef.current.scrollTop = 0;

        const isLastSec = secIdx >= sectionsRef.current.length - 1;
        if (!mutedRef.current) {
          // Use ref so we always call the freshest speakLesson closure,
          // avoiding stale-closure bugs when speak/startYNListen refs change.
          speakLessonRef.current(lessonData, sec, isLastSec);
        } else {
          setJdState('idle');
        }
      })
      .catch(() => { setLessonLoad(false); setJdState('idle'); });
  }, [secIdx, sections.length, readyToTeach]); // eslint-disable-line

  const sec    = sections[secIdx];
  const isLast = secIdx >= sections.length - 1;
  const progress = sections.length ? Math.round(((secIdx + 1) / sections.length) * 100) : 0;

  const toggleBookmark = () => {
    const num = sec?.section_number;
    if (!num) return;
    setBookmarked(prev => prev.includes(num) ? prev.filter(b => b !== num) : [...prev, num]);
  };

  const toggleMute = () => {
    const next = !voiceMuted;
    setVoiceMuted(next);
    if (next) { stopAll(); setJdState('idle'); stopYNListen(); setWaitingConfirm(false); }
  };

  const replayLesson = () => {
    if (!lesson || voiceMuted) return;
    stopAll();
    setWaitingConfirm(false);
    stopYNListen();
    const s = sections[secIdx];
    speakLesson(lesson, s, isLast);
  };

  const handleCheckpointAnswer = (opt) => {
    if (cpRevealed) return;
    setCpAnswer(opt);
    setCpRevealed(true);
    if (checkpoint && opt.startsWith(checkpoint.correct)) {
      addXP(XP.checkpoint_correct);
      speak(jdPhrase(JD_PHRASES.correct, language), null, () => {});
    } else {
      speak(jdPhrase(JD_PHRASES.incorrect, language, checkpoint?.correct, checkpoint?.explanation || ''), null, () => {});
    }
  };

  if (loading) return <div className="tutor-loading"><div className="tutor-spinner" /><p>Loading chapter…</p></div>;

  return (
    <div className="tutor-lesson-root">
      {/* Top bar */}
      <div className="tutor-lesson-topbar">
        <button className="tutor-back-link" onClick={onBack}>← Chapters</button>
        <div className="tutor-lesson-progress-wrap">
          <div className="tutor-lesson-progress-bar">
            <div className="tutor-lesson-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="tutor-lesson-progress-txt">{secIdx + 1} / {sections.length}</span>
        </div>
      </div>

      {/* Chapter title */}
      <div className="tutor-lesson-chapter-label">
        <span style={{ color: chapter.badge?.color }}>{chapter.badge?.icon} Chapter {chapter.chapter_num}</span>
        <span>{chapter.short_name}</span>
      </div>

      <div className="tutor-lesson-body" ref={contentRef}>
        {/* JD intro row */}
        <div className="tutor-lesson-jd-row">
          <JDAvatar state={ttsBlocked ? 'idle' : ttsLoading ? 'thinking' : jdState} />
          <div className="tutor-lesson-jd-bubble">
            {!readyToTeach
              ? <span>📢 JD is introducing the chapter…</span>
              : lessonLoading
                ? <span>✍️ JD is writing your lesson — the legal text is below…</span>
                : ttsLoading
                  ? <span>🎵 JD is warming up his voice…</span>
                  : ttsBlocked
                    ? <span className="tutor-jd-tap-hint">🔊 JD is ready — <strong>tap anywhere to start voice</strong></span>
                    : jdState === 'speaking'
                      ? <span>🔊 JD is speaking: <strong>{lesson?.simple_title || sec?.title}</strong></span>
                      : lesson?.simple_title
                        ? <span>Now teaching: <strong>{lesson.simple_title}</strong></span>
                        : <span>Section {sec?.section_number}: {sec?.title}</span>
            }
          </div>
          {/* Voice controls */}
          <div className="tutor-voice-controls">
            {/* Interrupt mic — always visible; pauses lesson + listens to student */}
            {!voiceMuted && (
              <button
                className={`tutor-interrupt-mic${interruptListening ? ' tutor-interrupt-mic--active' : ''}`}
                onClick={handleInterruptMic}
                title={interruptListening ? 'Stop — listening…' : 'Ask JD a question (interrupts lesson)'}
              >
                {interruptListening
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#ef4444"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                }
                {interruptListening ? 'Stop' : 'Ask'}
              </button>
            )}
            {!voiceMuted && lesson && (
              <button className="tutor-voice-btn" onClick={replayLesson} title="Replay lesson audio">
                🔁
              </button>
            )}
            <button
              className={`tutor-voice-btn${voiceMuted ? ' tutor-voice-btn--muted' : ''}`}
              onClick={toggleMute}
              title={voiceMuted ? 'Unmute JD' : 'Mute JD'}
            >
              {voiceMuted ? '🔇' : '🔊'}
            </button>
            <button
              className={`tutor-bookmark-btn${bookmarked.includes(sec?.section_number) ? ' tutor-bookmark-btn--active' : ''}`}
              onClick={toggleBookmark}
              title="Bookmark this section"
            >⭐</button>
          </div>
        </div>

        {/* Interrupt listening banner */}
        {interruptListening && (
          <div className="tutor-interrupt-banner">
            <span className="tutor-interrupt-pulse" aria-hidden="true" />
            <span>🎤 Listening… say your question</span>
            {interruptText && <em className="tutor-interrupt-preview">"{interruptText}"</em>}
            <button className="tutor-interrupt-cancel" onClick={stopInterruptMic}>✕ Cancel</button>
          </div>
        )}

        {/* Section header */}
        <div className="tutor-section-header">
          <div className="tutor-section-badge">{lawCode} {sec?.section_number}</div>
          <h3 className="tutor-section-title">{sec?.title}</h3>
        </div>

        {(!readyToTeach || lessonLoading) ? (
          <LessonPreparing sec={sec} />
        ) : lesson ? (
          <AnimatePresence mode="wait">
            <motion.div key={secIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* One-line plain summary at top */}
              {lesson.citizen_summary && (
                <div className="tutor-citizen-summary">
                  <span className="tutor-citizen-summary-icon">💬</span>
                  <strong>{lesson.citizen_summary}</strong>
                </div>
              )}

              {/* Original text box */}
              {sec?.text && (
                <div className="tutor-law-text-box">
                  <div className="tutor-law-text-label">📜 Legal Text</div>
                  <p className="tutor-law-text">{sec.text}</p>
                </div>
              )}

              {/* Why it exists */}
              {lesson.why_it_exists && (
                <div className="tutor-lesson-card tutor-lesson-card--why">
                  <div className="tutor-lesson-card-icon">💡</div>
                  <div>
                    <div className="tutor-lesson-card-label">Why This Law Exists</div>
                    <p>{lesson.why_it_exists}</p>
                  </div>
                </div>
              )}

              {/* Plain explanation */}
              {lesson.plain_explanation && (
                <div className="tutor-lesson-card tutor-lesson-card--explain">
                  <div className="tutor-lesson-card-icon">📖</div>
                  <div>
                    <div className="tutor-lesson-card-label">Plain Language Explanation</div>
                    <p>{lesson.plain_explanation}</p>
                  </div>
                </div>
              )}

              {/* Everyday analogy */}
              {lesson.analogy && (
                <div className="tutor-lesson-card tutor-lesson-card--analogy">
                  <div className="tutor-lesson-card-icon">🌟</div>
                  <div>
                    <div className="tutor-lesson-card-label">Think of it this way…</div>
                    <p>{lesson.analogy}</p>
                  </div>
                </div>
              )}

              {/* Practical action steps — the "so what do I DO?" answer */}
              {lesson.action_steps?.length > 0 && (
                <div className="tutor-lesson-card tutor-lesson-card--action">
                  <div className="tutor-lesson-card-icon">🛡️</div>
                  <div style={{ flex: 1 }}>
                    <div className="tutor-lesson-card-label">If This Happens To You</div>
                    <ol className="tutor-action-steps">
                      {lesson.action_steps.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                    <Link to="/awareness" className="tutor-card-link">
                      Know Your Rights →
                    </Link>
                  </div>
                </div>
              )}

              {/* Legal term callout — formal definition right after the plain language */}
              {lesson.legal_definition && (
                <div className="tutor-lesson-card tutor-lesson-card--legal">
                  <div className="tutor-lesson-card-icon">⚖️</div>
                  <div>
                    <div className="tutor-lesson-card-label">Legal Term</div>
                    <p>{lesson.legal_definition}</p>
                  </div>
                </div>
              )}

              {/* One short court-application example */}
              {lesson.court_application && (
                <div className="tutor-lesson-card tutor-lesson-card--test">
                  <div className="tutor-lesson-card-icon">🔍</div>
                  <div>
                    <div className="tutor-lesson-card-label">How Courts Apply It</div>
                    <p>{lesson.court_application}</p>
                  </div>
                </div>
              )}

              {/* Key concepts */}
              {lesson.key_concepts?.length > 0 && (
                <div className="tutor-concepts-row">
                  {lesson.key_concepts.map((c, i) => (
                    <span key={i} className="tutor-concept-chip">{c}</span>
                  ))}
                </div>
              )}

              {/* Real example */}
              {lesson.real_example && (
                <div className="tutor-lesson-card tutor-lesson-card--example">
                  <div className="tutor-lesson-card-icon">🎬</div>
                  <div>
                    <div className="tutor-lesson-card-label">Real-Life Example</div>
                    <p>{lesson.real_example}</p>
                  </div>
                </div>
              )}

              {/* When applies / doesn't apply */}
              {(lesson.when_applies || lesson.when_not_applies) && (
                <div className="tutor-applies-row">
                  {lesson.when_applies && (
                    <div className="tutor-applies tutor-applies--yes">
                      <div className="tutor-applies-label">✅ When It Applies</div>
                      <p>{lesson.when_applies}</p>
                    </div>
                  )}
                  {lesson.when_not_applies && (
                    <div className="tutor-applies tutor-applies--no">
                      <div className="tutor-applies-label">❌ When It Doesn't Apply</div>
                      <p>{lesson.when_not_applies}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Punishment */}
              {sec?.punishment && (
                <div className="tutor-punishment-box">
                  <span className="tutor-punishment-label">⚖️ Punishment</span>
                  <span>{sec.punishment}</span>
                </div>
              )}

              {/* Remember */}
              {lesson.remember && (
                <div className="tutor-remember-box">
                  <span className="tutor-remember-icon">🧠</span>
                  <span>{lesson.remember}</span>
                </div>
              )}

              {/* Checkpoint question */}
              {checkpoint && (
                <div className="tutor-checkpoint">
                  <div className="tutor-checkpoint-header">✋ Quick Check</div>
                  <p className="tutor-checkpoint-q">{checkpoint.question}</p>
                  <div className="tutor-checkpoint-options">
                    {checkpoint.options?.map((opt, i) => {
                      const letter = opt.charAt(0);
                      const isCorrect  = letter === checkpoint.correct;
                      const isSelected = cpAnswer?.charAt(0) === letter;
                      let cls = 'tutor-cp-opt';
                      if (cpRevealed && isCorrect)  cls += ' tutor-cp-opt--correct';
                      if (cpRevealed && isSelected && !isCorrect) cls += ' tutor-cp-opt--wrong';
                      return (
                        <button key={i} className={cls} onClick={() => handleCheckpointAnswer(opt)} disabled={cpRevealed}>
                          <span className="tutor-cp-opt-letter">{letter}</span>
                          <span>{opt.slice(3)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {cpRevealed && (
                    <div className={`tutor-cp-feedback${cpAnswer?.charAt(0) === checkpoint.correct ? ' tutor-cp-feedback--correct' : ' tutor-cp-feedback--wrong'}`}>
                      {cpAnswer?.charAt(0) === checkpoint.correct ? '✅ Correct! ' : '❌ Incorrect. '}
                      {checkpoint.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* ── "Move to next topic?" confirm bar ─────────────────── */}
              <AnimatePresence>
                {waitingConfirm && !isLast && (
                  <motion.div
                    className="tutor-confirm-bar"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 24 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  >
                    <div className="tutor-confirm-left">
                      <JDAvatar state="speaking" />
                      <div className="tutor-confirm-text">
                        <span className="tutor-confirm-title">Ready for the next topic?</span>
                        <span className="tutor-confirm-sub">
                          {listeningYN ? '🎤 Listening… say "Yes" or "No"' : 'Say "Yes" or click a button'}
                        </span>
                      </div>
                    </div>
                    <div className="tutor-confirm-btns">
                      <button className="tutor-confirm-yes" onClick={goNext}>✅ Yes, Next</button>
                      <button className="tutor-confirm-no"  onClick={stayHere}>⏸ Not Yet</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="tutor-lesson-error">Could not load lesson. Showing raw section text.</div>
        )}
      </div>

      {/* ── Q&A Panel — lesson-scoped questions only ── */}
      <div className="tutor-doubt-floater">
        <AnimatePresence>
          {doubtOpen && (
            <motion.div
              className="tutor-doubt-panel"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            >
              {/* Header */}
              <div className="tutor-doubt-header">
                <JDAvatar state={doubtLoading ? 'thinking' : doubtHistory.length ? 'speaking' : 'idle'} />
                <span className="tutor-doubt-title">Ask JD a Question</span>
                <span className="tutor-doubt-scope-tag">Any Legal Doubt</span>
                <button
                  className="tutor-doubt-close"
                  onClick={() => { setDoubtOpen(false); stopDoubtVoice(); setDoubtText(''); }}
                  aria-label="Close"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Friendly notice */}
              {doubtHistory.length === 0 && !doubtLoading && (
                <div className="tutor-doubt-notice">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span>Ask JD anything — about this section or any Indian law question. JD answers in your language.</span>
                </div>
              )}

              {/* Chat thread */}
              {(doubtHistory.length > 0 || doubtLoading) && (
                <div className="tutor-doubt-thread" ref={doubtThreadRef}>
                  {doubtHistory.map((item, i) => (
                    <React.Fragment key={i}>
                      <div className="tutor-doubt-msg--user">{item.q}</div>
                      <div className="tutor-doubt-msg--ai">
                        <div className="tutor-doubt-msg-avatar">⚖</div>
                        <div className="tutor-doubt-msg-bubble">{item.a}</div>
                      </div>
                    </React.Fragment>
                  ))}
                  {doubtLoading && (
                    <div className="tutor-doubt-thinking">
                      <div className="tutor-spinner tutor-spinner--sm" />
                      <span>JD is thinking…</span>
                    </div>
                  )}
                </div>
              )}

              {/* Suggestion chips */}
              <div className="tutor-doubt-chips">
                {[
                  'What does this mean?',
                  'Give a real-life example',
                  'What is the punishment?',
                  'When does this apply?',
                ].map(chip => (
                  <button
                    key={chip}
                    className="tutor-doubt-chip"
                    onClick={() => { setDoubtText(chip); setTimeout(() => doubtInputRef.current?.focus(), 30); }}
                    disabled={doubtLoading}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="tutor-doubt-input-row">
                <input
                  ref={doubtInputRef}
                  className="tutor-doubt-input"
                  placeholder="Ask JD anything about law…"
                  value={doubtText}
                  onChange={e => setDoubtText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmitDoubt(doubtText)}
                  disabled={doubtLoading}
                />
                <button
                  className={`tutor-doubt-mic${doubtListening ? ' tutor-doubt-mic--on' : ''}`}
                  onClick={doubtListening ? stopDoubtVoice : startDoubtVoice}
                  title={doubtListening ? 'Stop' : 'Voice input'}
                  disabled={doubtLoading}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                </button>
                <button
                  className="tutor-doubt-send"
                  onClick={() => handleSubmitDoubt(doubtText)}
                  disabled={doubtLoading || !doubtText.trim()}
                  aria-label="Send"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          className={`tutor-doubt-fab${doubtOpen ? ' tutor-doubt-fab--open' : ''}`}
          onClick={() => { setDoubtOpen(o => !o); setTimeout(() => doubtInputRef.current?.focus(), 60); }}
        >
          {doubtOpen ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Close
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Ask a Question
            </>
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="tutor-lesson-nav">
        <button
          className="tutor-nav-btn tutor-nav-btn--secondary"
          onClick={() => { stopAll(); stopYNListen(); stopDoubtVoice(); setDoubtOpen(false); setJdState('idle'); setWaitingConfirm(false); setSecIdx(i => Math.max(0, i - 1)); }}
          disabled={secIdx === 0}
        >
          ← Previous
        </button>
        {isLast ? (
          <button className="tutor-nav-btn tutor-nav-btn--primary" onClick={() => { stopAll(); stopYNListen(); stopDoubtVoice(); onComplete(bookmarked, sections); }}>
            📝 Take Chapter Test →
          </button>
        ) : (
          <button
            className="tutor-nav-btn tutor-nav-btn--primary"
            onClick={() => { stopAll(); stopYNListen(); stopDoubtVoice(); setDoubtOpen(false); setJdState('idle'); setWaitingConfirm(false); setSecIdx(i => i + 1); }}
          >
            Next Section →
          </button>
        )}
      </div>
    </div>
  );
}

// ── View: Assessment ──────────────────────────────────────────────────────────
function Assessment({ lawCode, chapter, mode, language, sections, onComplete, onBack }) {
  const [questions, setQuestions] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [current,   setCurrent]   = useState(0);
  const [answers,   setAnswers]   = useState({});
  const [revealed,  setRevealed]  = useState({});
  const [done,       setDone]       = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    // Guard: need at least one section to generate meaningful questions
    if (!sections || sections.length === 0) {
      setLoading(false);
      setFetchError('No lesson sections available for this chapter. Please go back and reload the chapter.');
      return;
    }
    setLoading(true);
    setFetchError('');
    fetch(`${API}/tutor/assess`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        law_code:     lawCode,
        chapter_num:  chapter.chapter_num,
        chapter_name: chapter.short_name || chapter.chapter_name,
        sections:     sections.slice(0, 15),
        mode,
        language,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.questions && d.questions.length > 0) {
          setQuestions(d.questions);
        } else {
          setFetchError(d.error || 'No questions returned from server.');
        }
        setLoading(false);
      })
      .catch((err) => {
        setFetchError('Network error — could not reach the server.');
        setLoading(false);
      });
  }, [retryCount]); // retryCount in deps → re-runs on every retry click

  const q = questions[current];

  const handleAnswer = (opt) => {
    if (revealed[current]) return;
    setAnswers(prev => ({ ...prev, [current]: opt.charAt(0) }));
    setRevealed(prev => ({ ...prev, [current]: true }));
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      setDone(true);
    }
  };

  const calcResults = () => {
    let score = 0;
    const correct_topics = [], wrong_topics = [];
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) {
        score++;
        if (q.topic) correct_topics.push(q.topic);
      } else {
        if (q.topic) wrong_topics.push(q.topic);
      }
    });
    return { score, total: questions.length, correct_topics, wrong_topics };
  };

  if (done) {
    const { score, total, correct_topics, wrong_topics } = calcResults();
    onComplete(score, total, correct_topics, wrong_topics, questions, answers);
    return null;
  }

  if (loading) return (
    <div className="tutor-loading">
      <div className="tutor-spinner" />
      <p>Generating assessment{retryCount > 0 ? ` (attempt ${retryCount + 1})` : ''}…</p>
    </div>
  );

  if (!questions.length) return (
    <div className="tutor-loading" style={{ gap: 16 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
        {fetchError || 'Could not generate the assessment.'}
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="tutor-nav-btn tutor-nav-btn--primary"
          onClick={() => setRetryCount(c => c + 1)}
        >
          ↺ Try Again
        </button>
        <button className="tutor-nav-btn tutor-nav-btn--secondary" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  );

  const progressPct = Math.round(((current + 1) / questions.length) * 100);
  const isAnswered = current in revealed;
  const userAnswer = answers[current];
  const isCorrect  = userAnswer === q?.correct;

  return (
    <div className="tutor-assess-root">
      <div className="tutor-assess-topbar">
        <button className="tutor-back-link" onClick={onBack}>← Exit Test</button>
        <div className="tutor-assess-progress">
          <div className="tutor-lesson-progress-bar">
            <div className="tutor-lesson-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span>{current + 1}/{questions.length}</span>
        </div>
        <span className="tutor-mode-badge">ASSESSMENT</span>
      </div>

      <div className="tutor-assess-chapter-label">
        📝 Chapter Test: {chapter.short_name}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={current} className="tutor-assess-card"
          initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>

          <div className="tutor-assess-q-num">Question {current + 1}</div>
          <div className="tutor-assess-q-type-badge">{q.type === 'tf' ? 'True / False' : q.type === 'mcq' ? 'Multiple Choice' : 'Scenario'}</div>
          <p className="tutor-assess-question">{q.question}</p>

          <div className="tutor-assess-options">
            {q.options?.map((opt, i) => {
              const letter = opt.charAt(0);
              let cls = 'tutor-assess-opt';
              if (isAnswered) {
                if (letter === q.correct)           cls += ' tutor-assess-opt--correct';
                if (letter === userAnswer && !isCorrect) cls += ' tutor-assess-opt--wrong';
              }
              return (
                <button key={i} className={cls} onClick={() => handleAnswer(opt)} disabled={isAnswered}>
                  <span className="tutor-assess-opt-letter">{letter}</span>
                  <span>{opt.slice(3)}</span>
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <motion.div
              className={`tutor-assess-feedback${isCorrect ? ' tutor-assess-feedback--correct' : ' tutor-assess-feedback--wrong'}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            >
              <div className="tutor-assess-feedback-head">
                {isCorrect ? '✅ Correct!' : `❌ Incorrect. Answer: ${q.correct}`}
              </div>
              <p>{q.explanation}</p>
            </motion.div>
          )}

          {isAnswered && (
            <button className="tutor-nav-btn tutor-nav-btn--primary" style={{ marginTop: 20 }} onClick={handleNext}>
              {current < questions.length - 1 ? 'Next Question →' : 'See Results →'}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── View: Results ─────────────────────────────────────────────────────────────
function Results({ lawCode, chapter, score, total, correctTopics, wrongTopics, xpEarned, badgeEarned, lawProgress, onContinue, onRetry, onBack }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading]   = useState(true);
  const pct = Math.round((score / total) * 100);
  const passed = pct >= 70;

  useEffect(() => {
    fetch(`${API}/tutor/analyze`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        law_code: lawCode,
        chapter_name: chapter.short_name,
        score, total,
        correct_topics: correctTopics,
        wrong_topics: wrongTopics,
        mode: 'student',
      }),
    })
      .then(r => r.json())
      .then(d => { setAnalysis(d.analysis); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="tutor-results-root">
      <div className="tutor-results-hero">
        <JDAvatar state={passed ? 'speaking' : 'idle'} />
        <h2 className="tutor-results-title">{passed ? '🎉 Chapter Complete!' : '📚 Keep Studying'}</h2>
        <div className="tutor-results-score-ring">
          <ProgressRing pct={pct} size={110} stroke={8} />
        </div>
        <p className="tutor-results-score-txt">{score} / {total} correct</p>
        <p className={`tutor-results-grade${passed ? ' tutor-results-grade--pass' : ' tutor-results-grade--fail'}`}>
          {pct >= 90 ? '🥇 Excellent' : pct >= 70 ? '✅ Passed' : '❌ Below 70% — Retake Required'}
        </p>
      </div>

      {/* XP + Badge */}
      {passed && (
        <div className="tutor-results-rewards">
          <div className="tutor-reward-xp">+{xpEarned} XP earned</div>
          {badgeEarned && (
            <motion.div className="tutor-reward-badge" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
              <span className="tutor-reward-badge-icon">{badgeEarned.icon}</span>
              <div>
                <div className="tutor-reward-badge-name">{badgeEarned.name}</div>
                <div className="tutor-reward-badge-sub">New Badge Earned!</div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Analysis */}
      {loading ? (
        <div className="tutor-results-analysis"><div className="tutor-spinner" /></div>
      ) : analysis && (
        <div className="tutor-results-analysis">
          <div className="tutor-analysis-message">{analysis.message}</div>
          {analysis.strong_areas?.length > 0 && (
            <div className="tutor-analysis-section">
              <div className="tutor-analysis-label tutor-analysis-label--good">✅ Strong Areas</div>
              <div className="tutor-analysis-chips">
                {analysis.strong_areas.map((t, i) => <span key={i} className="tutor-chip tutor-chip--good">{t}</span>)}
              </div>
            </div>
          )}
          {analysis.weak_areas?.length > 0 && (
            <div className="tutor-analysis-section">
              <div className="tutor-analysis-label tutor-analysis-label--weak">📚 Areas to Review</div>
              <div className="tutor-analysis-chips">
                {analysis.weak_areas.map((t, i) => <span key={i} className="tutor-chip tutor-chip--weak">{t}</span>)}
              </div>
            </div>
          )}
          {analysis.recommendations?.length > 0 && (
            <div className="tutor-analysis-section">
              <div className="tutor-analysis-label">💡 Recommendations</div>
              <ul className="tutor-recommendations">
                {analysis.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="tutor-results-actions">
        {passed ? (
          <button className="tutor-nav-btn tutor-nav-btn--primary" onClick={onContinue}>
            Continue to Next Chapter →
          </button>
        ) : (
          <button className="tutor-nav-btn tutor-nav-btn--primary" onClick={onRetry}>
            🔄 Retake Assessment
          </button>
        )}
        <button className="tutor-nav-btn tutor-nav-btn--secondary" onClick={onBack}>
          ← Back to Chapters
        </button>
      </div>
    </div>
  );
}

// ── View: Achievements ────────────────────────────────────────────────────────
function Achievements({ progress, onBack }) {
  const bnsP = getLawProgress(progress, 'BNS');
  const ipcP = getLawProgress(progress, 'IPC');

  const allSpecial = [...(bnsP.special_badges || []), ...(ipcP.special_badges || [])];
  const allChapter = [
    ...(bnsP.badges || []).map(b => ({ ...b, law: 'BNS' })),
    ...(ipcP.badges || []).map(b => ({ ...b, law: 'IPC' })),
  ];

  return (
    <div className="tutor-achievements-root">
      <button className="tutor-back-link" onClick={onBack}>← Back</button>
      <h2 className="tutor-achievements-title">🏆 My Achievements</h2>

      <div className="tutor-ach-stats">
        <div className="tutor-ach-stat"><span className="tutor-ach-stat-num">{bnsP.xp + ipcP.xp}</span><span>Total XP</span></div>
        <div className="tutor-ach-stat"><span className="tutor-ach-stat-num">{(bnsP.chapters_completed?.length || 0) + (ipcP.chapters_completed?.length || 0)}</span><span>Chapters Done</span></div>
        <div className="tutor-ach-stat"><span className="tutor-ach-stat-num">{allChapter.length + allSpecial.length}</span><span>Badges</span></div>
      </div>

      <div className="tutor-ach-section">
        <div className="tutor-ach-section-title">Special Badges</div>
        <div className="tutor-badges-grid">
          {SPECIAL_BADGES.map(b => {
            const earned = allSpecial.includes(b.key);
            return (
              <div key={b.key} className={`tutor-badge-card${earned ? ' tutor-badge-card--earned' : ' tutor-badge-card--locked'}`}>
                <span className="tutor-badge-icon" style={{ filter: earned ? 'none' : 'grayscale(1) opacity(0.3)' }}>{b.icon}</span>
                <span className="tutor-badge-name">{b.name}</span>
                <span className="tutor-badge-desc">{b.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {allChapter.length > 0 && (
        <div className="tutor-ach-section">
          <div className="tutor-ach-section-title">Chapter Badges</div>
          <div className="tutor-badges-grid">
            {allChapter.map((b, i) => (
              <div key={i} className="tutor-badge-card tutor-badge-card--earned">
                <span className="tutor-badge-icon">{b.icon}</span>
                <span className="tutor-badge-name">{b.name}</span>
                <span className="tutor-badge-desc">{b.law} Chapter {b.chapter_num}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {allChapter.length === 0 && allSpecial.length === 0 && (
        <div className="tutor-ach-empty">
          <p>No badges yet. Complete your first chapter to earn one!</p>
          <button className="tutor-nav-btn tutor-nav-btn--primary" onClick={onBack}>Start Learning →</button>
        </div>
      )}
    </div>
  );
}

// ── View: Session Complete ────────────────────────────────────────────────────
// Shown after passing an assessment.
// • JD speaks "Next topic padhna chahoge?" in Hinglish
// • Haan / Nahi buttons + voice recognition
// • Free-form query box so student can ask anything about the chapter
function SessionComplete({ lawCode, chapter, score, total, xpEarned, badgeEarned, language, mode = 'student', onNextTopic, onGoodbye }) {
  const { speak, stopAll, fetching: ttsLoading, blocked: ttsBlocked } = useSarvamTTS(language);

  const [jdState,      setJdState]      = useState('idle');
  const [listeningYN,  setListeningYN]  = useState(false);
  const [greeted,      setGreeted]      = useState(false);
  const [query,        setQuery]        = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [history,      setHistory]      = useState([]);
  const recogRef  = useRef(null);
  const threadRef = useRef(null);
  const queryRef  = useRef(null);
  const submitRef = useRef(null);   // always-fresh ref to handleSubmitQuery

  const pct    = Math.round((score / total) * 100);
  const passed = pct >= 70;

  // ── Stop yes/no listener ──────────────────────────────────────────────────
  const stopYNListen = useCallback(() => {
    setListeningYN(false);
    try { recogRef.current?.abort(); } catch (_) {}
  }, []);

  // ── Start yes/no listener ─────────────────────────────────────────────────
  const startYNListen = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'hi-IN';                // catch both Hindi "haan/nahi" + English "yes/no"
    r.continuous = false;
    r.interimResults = false;
    r.onstart  = () => setListeningYN(true);
    r.onend    = () => setListeningYN(false);
    r.onresult = (e) => {
      const text = (e.results[0]?.[0]?.transcript || '').toLowerCase().trim();
      if (/\b(haan|ha|yes|yeah|next|ok|aage|chaliye|sure)\b/.test(text)) {
        stopYNListen(); onNextTopic();
      } else if (/\b(nahi|na|no|nope|bas|stop|exit|bye)\b/.test(text)) {
        stopYNListen(); handleGoodbye();
      }
    };
    r.onerror = () => setListeningYN(false);
    recogRef.current = r;
    try { r.start(); } catch (_) {}
  }, [onNextTopic, stopYNListen]); // eslint-disable-line

  // ── Goodbye flow ──────────────────────────────────────────────────────────
  const handleGoodbye = useCallback(() => {
    stopYNListen(); stopAll();
    setJdState('speaking');
    speak(
      jdPhrase(JD_PHRASES.goodbye, language),
      null,                           // useSarvamTTS picks correct lang code
      () => { setJdState('idle'); onGoodbye(); }
    );
  }, [speak, stopAll, stopYNListen, onGoodbye, language]);

  // ── Ask JD about this chapter ─────────────────────────────────────────────
  const handleSubmitQuery = useCallback(async (override) => {
    const q = (override || query).trim();
    if (!q) return;
    stopYNListen(); stopAll();
    setQuery('');
    setQueryLoading(true);
    setJdState('thinking');
    try {
      const r = await fetch(`${API}/tutor/doubt`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          law_code: lawCode, section_number: '',
          section_title: chapter.short_name, section_text: '',
          question: q, mode, language,
        }),
      });
      const d = await r.json();
      const ans = d.answer || 'Sorry, could not answer. Please try again.';
      setHistory(prev => [...prev, { q, a: ans }]);
      setQueryLoading(false);
      setTimeout(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, 80);
      setJdState('speaking');
      speak(ans, null, () => {       // null → useSarvamTTS routes to student's language
        setJdState('idle');
        setTimeout(() => {
          setJdState('speaking');
          speak(jdPhrase(JD_PHRASES.nextTopicAsk, language), null, () => { setJdState('idle'); startYNListen(); });
        }, 400);
      });
    } catch {
      setQueryLoading(false);
      setJdState('idle');
    }
  }, [query, lawCode, chapter, language, mode, speak, stopAll, stopYNListen, startYNListen]); // eslint-disable-line
  submitRef.current = handleSubmitQuery;

  // ── JD speaks completion message on mount ─────────────────────────────────
  useEffect(() => {
    if (greeted) return;
    setGreeted(true);
    const timer = setTimeout(() => {
      const msg = passed
        ? jdPhrase(JD_PHRASES.sessionPassed,   language, chapter.short_name, pct)
        : jdPhrase(JD_PHRASES.sessionTryAgain, language, chapter.short_name, pct);
      setJdState('speaking');
      speak(msg, null, () => {       // null → useSarvamTTS picks correct lang code
        setJdState('idle');
        startYNListen();
      });
    }, 700);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line

  // Cleanup on unmount
  useEffect(() => () => { stopAll(); stopYNListen(); }, [stopAll, stopYNListen]);

  return (
    <div className="tutor-sc-root">

      {/* ── Trophy header ── */}
      <motion.div className="tutor-sc-hero" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="tutor-sc-trophy-wrap">
          <span className="tutor-sc-trophy">{passed ? '🏆' : '📚'}</span>
        </div>
        <h2 className="tutor-sc-title">{passed ? 'Session Complete!' : 'Good Effort!'}</h2>
        <p className="tutor-sc-chapter">{chapter.short_name}</p>

        <div className="tutor-sc-score-ring">
          <ProgressRing pct={pct} size={100} stroke={7} />
        </div>
        <p className="tutor-sc-score-txt">{score} / {total} correct · {pct}%</p>

        {xpEarned > 0 && (
          <motion.div className="tutor-reward-xp" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: 'spring', bounce: 0.5 }}>
            +{xpEarned} XP earned
          </motion.div>
        )}
        {badgeEarned && (
          <motion.div className="tutor-reward-badge" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: 'spring', bounce: 0.5 }}>
            <span className="tutor-reward-badge-icon">{badgeEarned.icon}</span>
            <div>
              <div className="tutor-reward-badge-name">{badgeEarned.name}</div>
              <div className="tutor-reward-badge-sub">New Badge Earned!</div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ── JD prompt ── */}
      <div className="tutor-sc-jd-row">
        <JDAvatar state={ttsLoading ? 'thinking' : ttsBlocked ? 'idle' : jdState} />
        <div className="tutor-sc-jd-bubble">
          {ttsLoading                          && '🎵 JD is warming up his voice…'}
          {!ttsLoading && ttsBlocked           && <span className="tutor-jd-tap-hint">🔊 JD is ready — <strong>tap anywhere to hear</strong></span>}
          {!ttsLoading && !ttsBlocked && jdState === 'speaking'  && '🔊 JD is speaking…'}
          {!ttsLoading && !ttsBlocked && jdState === 'thinking'  && '⏳ JD is answering…'}
          {!ttsLoading && !ttsBlocked && jdState === 'idle' && listeningYN  && '🎤 Bol do: "Haan" ya "Nahi"'}
          {!ttsLoading && !ttsBlocked && jdState === 'idle' && !listeningYN && 'Next topic padhna chahoge?'}
        </div>
        {listeningYN && <span className="tutor-sc-listen-dot" />}
      </div>

      {/* ── Haan / Nahi ── */}
      <div className="tutor-sc-yn-row">
        <motion.button
          className="tutor-sc-btn tutor-sc-btn--yes"
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={() => { stopYNListen(); onNextTopic(); }}
        >
          ✅ Haan, Next Topic
        </motion.button>
        <motion.button
          className="tutor-sc-btn tutor-sc-btn--no"
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={handleGoodbye}
        >
          ❌ Nahi, Bas
        </motion.button>
      </div>

      {/* ── Query box ── */}
      <div className="tutor-sc-query-section">
        <div className="tutor-sc-query-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Kuch aur jaanna chahte ho?
        </div>
        <p className="tutor-sc-query-sub">Ask JD anything about {chapter.short_name}</p>

        {/* Suggestion chips */}
        <div className="tutor-doubt-chips">
          {['What are the key points?', 'Give me an example', 'What is the punishment?', 'Summarise this chapter'].map(chip => (
            <button
              key={chip}
              className="tutor-doubt-chip"
              onClick={() => submitRef.current?.(chip)}
              disabled={queryLoading}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Thread */}
        {(history.length > 0 || queryLoading) && (
          <div className="tutor-sc-thread" ref={threadRef}>
            {history.map((item, i) => (
              <React.Fragment key={i}>
                <div className="tutor-doubt-msg--user">{item.q}</div>
                <div className="tutor-doubt-msg--ai">
                  <div className="tutor-doubt-msg-avatar">⚖</div>
                  <div className="tutor-doubt-msg-bubble">{item.a}</div>
                </div>
              </React.Fragment>
            ))}
            {queryLoading && (
              <div className="tutor-doubt-thinking">
                <div className="tutor-spinner tutor-spinner--sm" /><span>JD is thinking…</span>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="tutor-sc-query-input-row">
          <input
            ref={queryRef}
            className="tutor-sc-query-input"
            placeholder="Ask anything about this chapter…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitRef.current?.(query)}
            disabled={queryLoading}
          />
          <button
            className="tutor-sc-query-send"
            onClick={() => submitRef.current?.(query)}
            disabled={queryLoading || !query.trim()}
            aria-label="Send"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main LawTutor Component ───────────────────────────────────────────────────
export default function LawTutor() {
  const [view,       setView]       = useState('path_select'); // path_select | chapters | lesson | assessment | results | session_complete | achievements
  const [lawCode,    setLawCode]    = useState('BNS');
  const [mode,       setMode]       = useState('general');   // single unified learning mode
  const [language,   setLanguage]   = useState('English');
  const [chapter,    setChapter]    = useState(null);
  const [sections,   setSections]   = useState([]);
  const [assessData, setAssessData] = useState(null);
  const [progress,   setProgress]   = useState(loadProgress);

  const getLaw = () => getLawProgress(progress, lawCode);
  const setLaw = (data) => {
    const next = setLawProgress(progress, lawCode, data);
    setProgress(next);
    saveProgress(next);
    return next;
  };

  const addXP = useCallback((amount) => {
    const lp = getLawProgress(progress, lawCode);
    const next = setLawProgress(progress, lawCode, { ...lp, xp: (lp.xp || 0) + amount });
    setProgress(next);
    saveProgress(next);
  }, [progress, lawCode]);

  // Intercept browser back button for every internal sub-view so the user
  // never accidentally leaves the tutor page. Map each view to its logical
  // parent so the back button feels native.
  const VIEW_PARENT = {
    achievements:     'path_select',
    chapters:         'path_select',
    lesson:           'chapters',
    assessment:       'lesson',
    results:          'chapters',
    session_complete: 'chapters',
  };
  useEffect(() => {
    if (view === 'path_select') return; // nothing to intercept at top level
    window.history.pushState({ tutorView: view }, '');
    const handlePop = () => setView(VIEW_PARENT[view] || 'path_select');
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePathSelect = (code, selectedMode, selectedLanguage) => {
    if (code === '__achievements__') { setView('achievements'); return; }
    setLawCode(code);
    setMode(selectedMode);
    setLanguage(selectedLanguage || 'English');
    setView('chapters');
  };

  const handleStartChapter = (ch) => {
    setChapter(ch);
    setView('lesson');
    const lp = getLaw();
    setLaw({ ...lp, last_chapter: ch.chapter_num });
  };

  const handleLessonComplete = (bookmarks, sectionsList) => {
    // Save bookmarks and carry sections into assessment (avoids refetch race)
    const lp = getLaw();
    setLaw({ ...lp, bookmarks: Array.from(new Set([...(lp.bookmarks || []), ...bookmarks])) });
    setSections(sectionsList || []);
    setView('assessment');
  };

  const handleAssessComplete = (score, total, correctTopics, wrongTopics, questions, answers) => {
    setAssessData({ score, total, correctTopics, wrongTopics, questions, answers });
    setView('results');
  };

  const handleResultsContinue = () => {
    setView('session_complete');
  };

  const handleRetry = () => {
    setView('assessment');
  };

  const onAssessXPBadge = useCallback((score, total) => {
    const pct = Math.round((score / total) * 100);
    const passed = pct >= 70;
    if (!passed) return { xpEarned: 0, badgeEarned: null };

    const lp = getLaw();
    let xpAdd = XP.assess_pass;
    const newSpecial = [...(lp.special_badges || [])];
    const newBadges = [...(lp.badges || [])];
    const newCompleted = Array.from(new Set([...(lp.chapters_completed || []), chapter?.chapter_num]));

    // XP bonuses
    if (pct >= 90) xpAdd += XP.expert_bonus;
    if (pct === 100) xpAdd += XP.perfect_bonus;

    // Special badges
    if (!newSpecial.includes('chapter_master')) newSpecial.push('chapter_master');
    if (pct >= 90 && !newSpecial.includes('chapter_expert')) newSpecial.push('chapter_expert');
    if (pct === 100 && !newSpecial.includes('perfect_scholar')) newSpecial.push('perfect_scholar');

    // Chapter badge
    const chBadge = chapter?.badge ? { ...chapter.badge, chapter_num: chapter.chapter_num } : null;
    if (chBadge && !newBadges.find(b => b.chapter_num === chapter.chapter_num)) {
      newBadges.push(chBadge);
    }

    setLaw({
      ...lp,
      xp: (lp.xp || 0) + xpAdd,
      badges: newBadges,
      special_badges: newSpecial,
      chapters_completed: newCompleted,
      assessment_scores: { ...(lp.assessment_scores || {}), [chapter?.chapter_num]: pct },
    });

    return { xpEarned: xpAdd, badgeEarned: chBadge };
  }, [progress, lawCode, chapter]);

  // Compute XP/badge when entering results view
  const [resultsRewards, setResultsRewards] = useState({ xpEarned: 0, badgeEarned: null });
  useEffect(() => {
    if (view === 'results' && assessData) {
      const r = onAssessXPBadge(assessData.score, assessData.total);
      setResultsRewards(r);
    }
  }, [view]);

  return (
    <div className="tutor-root">
      <Navbar />
      <div className="tutor-page">
        <AnimatePresence mode="wait">
          {view === 'path_select' && (
            <motion.div key="path" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PathSelect onSelect={handlePathSelect} progress={progress} />
            </motion.div>
          )}

          {view === 'chapters' && (
            <motion.div key="chapters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ChapterList
                lawCode={lawCode}
                mode={mode}
                lawProgress={getLaw()}
                onStartChapter={handleStartChapter}
                onBack={() => setView('path_select')}
                onShowAchievements={() => setView('achievements')}
              />
            </motion.div>
          )}

          {view === 'lesson' && chapter && (
            <motion.div key="lesson" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LessonView
                lawCode={lawCode}
                chapter={chapter}
                mode={mode}
                language={language}
                lawProgress={getLaw()}
                onComplete={handleLessonComplete}
                onBack={() => setView('chapters')}
                addXP={addXP}
              />
            </motion.div>
          )}

          {view === 'assessment' && chapter && (
            <motion.div key="assessment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Assessment
                lawCode={lawCode}
                chapter={chapter}
                mode={mode}
                language={language}
                sections={sections}
                onComplete={handleAssessComplete}
                onBack={() => setView('lesson')}
              />
            </motion.div>
          )}

          {view === 'results' && assessData && chapter && (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Results
                lawCode={lawCode}
                chapter={chapter}
                score={assessData.score}
                total={assessData.total}
                correctTopics={assessData.correctTopics}
                wrongTopics={assessData.wrongTopics}
                xpEarned={resultsRewards.xpEarned}
                badgeEarned={resultsRewards.badgeEarned}
                lawProgress={getLaw()}
                onContinue={handleResultsContinue}
                onRetry={handleRetry}
                onBack={() => setView('chapters')}
              />
            </motion.div>
          )}

          {view === 'session_complete' && assessData && chapter && (
            <motion.div key="session_complete" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SessionComplete
                lawCode      = {lawCode}
                chapter      = {chapter}
                score        = {assessData.score}
                total        = {assessData.total}
                xpEarned     = {resultsRewards.xpEarned}
                badgeEarned  = {resultsRewards.badgeEarned}
                language     = {language}
                mode         = {mode}
                onNextTopic  = {() => setView('chapters')}
                onGoodbye    = {() => setView('path_select')}
              />
            </motion.div>
          )}

          {view === 'achievements' && (
            <motion.div key="achievements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Achievements progress={progress} onBack={() => setView('path_select')} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
