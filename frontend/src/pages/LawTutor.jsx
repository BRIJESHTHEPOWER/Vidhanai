/**
 * LawTutor.jsx — AI-powered Law Tutor (JD teaches BNS & IPC chapter-by-chapter)
 * States: path_select → mode_select → chapters → lesson → checkpoint → assessment → results → achievements
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import VidhanLogo from '../components/VidhanLogo';
import { useJD } from '../context/JDAssistantContext';
import { motion, AnimatePresence } from 'framer-motion';
import JDTeacherPlayer from '../components/JDTeacherPlayer';
import './LawTutor.css';

const API = 'http://localhost:8000';

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

// ── View: Path + Mode Select ──────────────────────────────────────────────────
function PathSelect({ onSelect, progress }) {
  const [selectedPath, setSelectedPath] = useState(null);

  const PATHS = [
    { code: 'BNS', label: 'BNS 2023', sub: 'Bharatiya Nyaya Sanhita', icon: '⚖️', desc: 'Modern Indian criminal law enacted in 2023', color: '#6366f1' },
    { code: 'IPC', label: 'IPC 1860', sub: 'Indian Penal Code',        icon: '⚔️', desc: 'Original Indian criminal code (historical)', color: '#ef4444' },
  ];

  const MODES = [
    { code: 'citizen', icon: '👤', label: 'Citizen',   desc: 'Simple language, everyday examples. Perfect for everyone.' },
    { code: 'student', icon: '🎓', label: 'Student',   desc: 'Detailed analysis, legal terminology, deep explanations.' },
    { code: 'exam',    icon: '📝', label: 'Exam Prep', desc: 'Important sections, mock tests, revision-focused.' },
  ];

  const bnsP = getLawProgress(progress, 'BNS');
  const ipcP = getLawProgress(progress, 'IPC');

  if (selectedPath) {
    return (
      <div className="tutor-select-root">
        <button className="tutor-back-link" onClick={() => setSelectedPath(null)}>← Back</button>
        <div className="tutor-select-header">
          <h2>How do you want to learn?</h2>
          <p>Choose a mode that suits your goal</p>
        </div>
        <div className="tutor-mode-grid">
          {MODES.map(m => (
            <motion.button
              key={m.code}
              className="tutor-mode-card"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(selectedPath, m.code)}
            >
              <span className="tutor-mode-icon">{m.icon}</span>
              <span className="tutor-mode-label">{m.label}</span>
              <span className="tutor-mode-desc">{m.desc}</span>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

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
              onClick={() => setSelectedPath(p.code)}
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

      <button className="tutor-achievements-btn" onClick={() => onSelect('__achievements__', 'any')}>
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
    fetch(`${API}/tutor/chapters/${lawCode}`)
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
            <span className="tutor-mode-badge">{mode.toUpperCase()}</span>
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

// ── View: Lesson ──────────────────────────────────────────────────────────────
function LessonView({ lawCode, chapter, mode, language, lawProgress, onComplete, onBack, addXP }) {
  const { speak, stopAll } = useJD();

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
  // JD Voice Lesson (Kokoro TTS) — alternate spoken lesson mode
  const [kokoroMode, setKokoroMode]         = useState(false);
  // Doubt feature
  const [doubtOpen, setDoubtOpen]         = useState(false);
  const [doubtText, setDoubtText]         = useState('');
  const [doubtAnswer, setDoubtAnswer]     = useState('');
  const [doubtLoading, setDoubtLoad]      = useState(false);
  const [doubtListening, setDoubtListening] = useState(false);
  const contentRef      = useRef(null);
  const mutedRef        = useRef(false);
  const recogRef        = useRef(null);      // yes/no recognition
  const doubtRecogRef   = useRef(null);      // doubt voice recognition
  const sectionsRef     = useRef([]);
  const introTimerRef     = useRef(null);
  const doubtInputRef     = useRef(null);
  const secIdxRef         = useRef(0);
  const submitDoubtRef    = useRef(null);  // always-fresh ref to handleSubmitDoubt
  const greetedChapterRef = useRef(null);  // chapter_num already welcomed (speak once)

  useEffect(() => { mutedRef.current = voiceMuted; }, [voiceMuted]);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { secIdxRef.current = secIdx; }, [secIdx]);

  // Cleanup on unmount
  useEffect(() => () => {
    stopAll();
    clearTimeout(introTimerRef.current);
    try { recogRef.current?.abort(); } catch (_) {}
    try { doubtRecogRef.current?.abort(); } catch (_) {}
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
    recog.lang = 'en-IN';
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 2;
    recog.onstart = () => setListeningYN(true);
    recog.onend   = () => setListeningYN(false);
    recog.onresult = (e) => {
      const text = (e.results[0]?.[0]?.transcript || '').toLowerCase().trim();
      if (/\b(yes|yeah|yep|sure|okay|ok|next|go|continue|proceed|move on|haan|ha)\b/.test(text)) {
        onYes();
      } else if (/\b(no|nope|wait|hold|not yet|later|stay|nahi)\b/.test(text)) {
        onNo();
      }
    };
    recog.onerror = () => setListeningYN(false);
    recogRef.current = recog;
    try { recog.start(); } catch (_) {}
  }, []);

  // ── Doubt: voice & submit ──────────────────────────────────────────────────
  const stopDoubtVoice = useCallback(() => {
    setDoubtListening(false);
    try { doubtRecogRef.current?.abort(); } catch (_) {}
  }, []);

  const startDoubtVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = 'en-IN';
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setDoubtListening(true);
    r.onend   = () => setDoubtListening(false);
    r.onresult = (e) => {
      const txt = e.results[0]?.[0]?.transcript || '';
      setDoubtText(txt);
      if (txt.trim()) submitDoubtRef.current?.(txt);  // always-fresh via ref
    };
    r.onerror = () => setDoubtListening(false);
    doubtRecogRef.current = r;
    try { r.start(); } catch (_) {}
  }, []);

  const handleSubmitDoubt = useCallback((question) => {
    const q = question?.trim();
    if (!q) return;
    const currentSec = sectionsRef.current[secIdxRef.current];
    setDoubtLoad(true);
    setDoubtAnswer('');
    stopAll();
    stopYNListen();
    setWaitingConfirm(false);

    fetch(`${API}/tutor/doubt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        law_code: lawCode,
        section_number: currentSec?.section_number || '',
        section_title:  currentSec?.title || '',
        section_text:   currentSec?.text || currentSec?.summary || '',
        question: q,
        mode, language,
      }),
    })
      .then(r => r.json())
      .then(d => {
        const ans = d.answer || 'Sorry, I could not answer that. Please try again.';
        setDoubtAnswer(ans);
        setDoubtLoad(false);
        if (!mutedRef.current) {
          setJdState('speaking');
          speak(ans, null, () => setJdState('idle'));
        }
      })
      .catch(() => {
        setDoubtLoad(false);
        setDoubtAnswer('Something went wrong. Please try again.');
      });
  }, [lawCode, mode, language, speak, stopAll, stopYNListen]); // eslint-disable-line
  submitDoubtRef.current = handleSubmitDoubt;  // keep ref always fresh

  // ── Advance to next section ────────────────────────────────────────────────
  const goNext = useCallback(() => {
    stopYNListen();
    stopDoubtVoice();
    setWaitingConfirm(false);
    setDoubtOpen(false);
    setDoubtText('');
    setDoubtAnswer('');
    stopAll();
    setJdState('idle');
    setSecIdx(i => i + 1);
  }, [stopAll, stopYNListen, stopDoubtVoice]);

  const stayHere = useCallback(() => {
    stopYNListen();
    setWaitingConfirm(false);
    if (!mutedRef.current) {
      setJdState('speaking');
      speak('No problem! Take your time. Click Next whenever you are ready.', null, () => setJdState('idle'));
    }
  }, [speak, stopYNListen]);

  // ── Speak lesson then ask "move to next?" ─────────────────────────────────
  const speakLesson = useCallback((lessonData, sec, isLastSec) => {
    const parts = [
      `Now teaching: ${lessonData.simple_title || sec.title}.`,
      lessonData.why_it_exists     ? `Why this law exists. ${lessonData.why_it_exists}` : '',
      lessonData.plain_explanation ? `In simple terms. ${lessonData.plain_explanation}` : '',
      lessonData.real_example      ? `Here is a real life example. ${lessonData.real_example}` : '',
      lessonData.remember          ? `Key takeaway. ${lessonData.remember}` : '',
    ].filter(Boolean).join(' ');

    setJdState('speaking');
    speak(parts, null, () => {
      setJdState('idle');
      if (isLastSec || mutedRef.current) return;
      setTimeout(() => {
        setJdState('speaking');
        speak(
          `Great, that covers ${lessonData.simple_title || sec.title}. Shall I move to the next topic? You can say yes or click the button.`,
          null,
          () => {
            setJdState('idle');
            setWaitingConfirm(true);
            startYNListen(goNext, stayHere);
          }
        );
      }, 400);
    });
  }, [speak, startYNListen, goNext, stayHere]);

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

    fetch(`${API}/tutor/chapter/${lawCode}/${chapter.chapter_num}/sections`)
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

        const names = secs.slice(0, 4).map(s => s.title).join(', ');
        const more  = secs.length > 4 ? `, and ${secs.length - 4} more` : '';
        const intro = `Welcome to Chapter ${chapter.chapter_num}: ${chapter.short_name}. In this chapter, we will cover ${secs.length} ${secs.length === 1 ? 'section' : 'sections'} — ${names}${more}. Let me begin with the first lesson!`;

        // Safety: if TTS onDone never fires (e.g. browser blocks autoplay), proceed after 10s
        introTimerRef.current = setTimeout(markReady, 10000);
        setJdState('speaking');
        speak(intro, null, markReady);
      })
      .catch(() => { setSections([]); setLoading(false); setReadyToTeach(true); });
  }, [lawCode, chapter.chapter_num]); // eslint-disable-line

  // ── Load & auto-speak lesson when section changes (after intro done) ───────
  useEffect(() => {
    if (!readyToTeach || !sections.length) return;
    // In JD Voice (Kokoro) mode the JDTeacherPlayer owns the lesson — skip the
    // text-mode generation entirely so we don't double-call the backend.
    if (kokoroMode) return;
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
      headers: { 'Content-Type': 'application/json' },
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
          speakLesson(lessonData, sec, isLastSec);
        } else {
          setJdState('idle');
        }
      })
      .catch(() => { setLessonLoad(false); setJdState('idle'); });
  }, [secIdx, sections.length, readyToTeach, kokoroMode]); // eslint-disable-line

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
      speak('Correct! Well done.', null, () => {});
    } else {
      speak(`Incorrect. The correct answer is ${checkpoint?.correct}. ${checkpoint?.explanation || ''}`, null, () => {});
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
        <button
          className={`tutor-voice-btn${kokoroMode ? ' tutor-voice-btn--muted' : ''}`}
          onClick={() => {
            if (!kokoroMode) { stopAll(); setVoiceMuted(true); setWaitingConfirm(false); stopYNListen(); }
            else { setVoiceMuted(false); }
            setKokoroMode(k => !k);
          }}
          title={kokoroMode ? 'Switch back to text lesson' : 'Switch to JD Voice Lesson (local AI voice)'}
        >
          {kokoroMode ? '📖 Text Lesson' : '🎙️ JD Voice Lesson'}
        </button>
        <span className="tutor-mode-badge">{mode.toUpperCase()}</span>
      </div>

      {/* Chapter title */}
      <div className="tutor-lesson-chapter-label">
        <span style={{ color: chapter.badge?.color }}>{chapter.badge?.icon} Chapter {chapter.chapter_num}</span>
        <span>{chapter.short_name}</span>
      </div>

      {kokoroMode && (
        <JDTeacherPlayer
          lawCode={lawCode}
          chapterNum={chapter.chapter_num}
          sectionIndex={secIdx}
          mode={mode}
          language={language}
          onSectionChange={(idx) => setSecIdx(idx)}
          onChapterComplete={() => { stopAll(); stopYNListen(); stopDoubtVoice(); onComplete(bookmarked, sections); }}
          onClose={() => { setKokoroMode(false); setVoiceMuted(false); }}
        />
      )}

      <div className="tutor-lesson-body" ref={contentRef} style={kokoroMode ? { display: 'none' } : undefined}>
        {/* JD intro row */}
        <div className="tutor-lesson-jd-row">
          <JDAvatar state={jdState} />
          <div className="tutor-lesson-jd-bubble">
            {!readyToTeach
              ? <span>📢 JD is introducing the chapter…</span>
              : lessonLoading
                ? <span>Preparing lesson for Section {sec?.section_number}…</span>
                : jdState === 'speaking'
                  ? <span>🔊 JD is speaking: <strong>{lesson?.simple_title || sec?.title}</strong></span>
                  : lesson?.simple_title
                    ? <span>Now teaching: <strong>{lesson.simple_title}</strong></span>
                    : <span>Section {sec?.section_number}: {sec?.title}</span>
            }
          </div>
          {/* Voice controls */}
          <div className="tutor-voice-controls">
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

        {/* Section header */}
        <div className="tutor-section-header">
          <div className="tutor-section-badge">{lawCode} {sec?.section_number}</div>
          <h3 className="tutor-section-title">{sec?.title}</h3>
        </div>

        {(!readyToTeach || lessonLoading) ? (
          <div className="tutor-lesson-skeleton">
            <div className="tutor-skel" />
            <div className="tutor-skel tutor-skel--sm" />
            <div className="tutor-skel" />
            <div className="tutor-skel tutor-skel--sm" />
          </div>
        ) : lesson ? (
          <AnimatePresence mode="wait">
            <motion.div key={secIdx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
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
                    <div className="tutor-lesson-card-label">Simple Explanation</div>
                    <p>{lesson.plain_explanation}</p>
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

      {/* ── Floating "Ask JD" doubt panel ──────────────────────────────── */}
      <div className="tutor-doubt-floater">
        <AnimatePresence>
          {doubtOpen && (
            <motion.div
              className="tutor-doubt-panel"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            >
              <div className="tutor-doubt-header">
                <JDAvatar state={doubtLoading ? 'thinking' : doubtAnswer ? 'speaking' : 'idle'} />
                <span className="tutor-doubt-title">Ask JD a question</span>
                <button className="tutor-doubt-close" onClick={() => { setDoubtOpen(false); stopDoubtVoice(); setDoubtText(''); setDoubtAnswer(''); }}>✕</button>
              </div>

              {doubtAnswer && (
                <div className="tutor-doubt-answer">
                  <p>{doubtAnswer}</p>
                </div>
              )}

              {doubtLoading && (
                <div className="tutor-doubt-thinking">
                  <div className="tutor-spinner tutor-spinner--sm" />
                  <span>JD is thinking…</span>
                </div>
              )}

              <div className="tutor-doubt-input-row">
                <input
                  ref={doubtInputRef}
                  className="tutor-doubt-input"
                  placeholder="Type your doubt or click mic…"
                  value={doubtText}
                  onChange={e => setDoubtText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmitDoubt(doubtText)}
                  disabled={doubtLoading}
                />
                <button
                  className={`tutor-doubt-mic${doubtListening ? ' tutor-doubt-mic--on' : ''}`}
                  onClick={doubtListening ? stopDoubtVoice : startDoubtVoice}
                  title={doubtListening ? 'Stop' : 'Speak your doubt'}
                  disabled={doubtLoading}
                >
                  {doubtListening ? '⏹' : '🎤'}
                </button>
                <button
                  className="tutor-doubt-send"
                  onClick={() => handleSubmitDoubt(doubtText)}
                  disabled={doubtLoading || !doubtText.trim()}
                >
                  Ask
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          className={`tutor-doubt-fab${doubtOpen ? ' tutor-doubt-fab--open' : ''}`}
          onClick={() => { setDoubtOpen(o => !o); setTimeout(() => doubtInputRef.current?.focus(), 50); }}
          title="Ask JD a doubt"
        >
          {doubtOpen ? '✕ Close' : '💬 Ask JD'}
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
  const [done,      setDone]      = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/tutor/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      .then(d => { setQuestions(d.questions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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

  if (loading) return <div className="tutor-loading"><div className="tutor-spinner" /><p>Generating assessment…</p></div>;
  if (!questions.length) return (
    <div className="tutor-loading">
      <p>Could not generate assessment. Please try again.</p>
      <button className="tutor-nav-btn tutor-nav-btn--secondary" onClick={onBack}>← Back</button>
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
        📝 Chapter {chapter.chapter_num} Test: {chapter.short_name}
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
      headers: { 'Content-Type': 'application/json' },
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

// ── Main LawTutor Component ───────────────────────────────────────────────────
export default function LawTutor() {
  const [view,       setView]       = useState('path_select'); // path_select | chapters | lesson | assessment | results | achievements
  const [lawCode,    setLawCode]    = useState('BNS');
  const [mode,       setMode]       = useState('student');
  const [language]                  = useState('English'); // can expand later
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

  const handlePathSelect = (code, selectedMode) => {
    if (code === '__achievements__') { setView('achievements'); return; }
    setLawCode(code);
    setMode(selectedMode);
    setView('chapters');
  };

  const handleStartChapter = (ch) => {
    setChapter(ch);
    setView('lesson');
    // Save last chapter
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
    setView('chapters');
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
