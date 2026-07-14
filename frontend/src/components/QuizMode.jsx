import React, { useState, useEffect, useRef, useCallback } from 'react';
import './QuizMode.css';

const API = 'http://localhost:8000';

const QUESTION_TIME = 20; // seconds per question
const SEEN_KEY      = 'vidhan_quiz_seen';  // localStorage key for seen question keys
const MAX_SEEN      = 300;                  // reset after dataset is exhausted

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#6366f1','#22d3ee','#f59e0b','#22c55e','#ec4899','#a78bfa','#34d399'];
function Confetti({ active }) {
  if (!active) return null;
  return (
    <div className="qm-confetti" aria-hidden="true">
      {Array.from({ length: 40 }).map((_, i) => (
        <span key={i} className="qm-confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${1.2 + Math.random() * 0.8}s`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            width: `${6 + Math.random() * 6}px`,
            height: `${6 + Math.random() * 6}px`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}

// ── Circular Timer ─────────────────────────────────────────────────────────────
function CircularTimer({ timeLeft, total }) {
  const radius = 20;
  const circ   = 2 * Math.PI * radius;
  const pct    = timeLeft / total;
  const color  = timeLeft <= 5 ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#6366f1';
  return (
    <div className="qm-timer" title={`${timeLeft}s remaining`}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3"/>
        <circle cx="26" cy="26" r={radius} fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
        />
      </svg>
      <span className="qm-timer-num" style={{ color }}>{timeLeft}</span>
    </div>
  );
}

// ── Streak Badge ──────────────────────────────────────────────────────────────
function StreakBadge({ streak }) {
  if (streak < 2) return null;
  return (
    <div className="qm-streak" key={streak}>
      🔥 {streak} streak!
    </div>
  );
}

// ── Option Button ─────────────────────────────────────────────────────────────
function OptionBtn({ opt, selected, correct, revealed, onClick, index }) {
  let cls = 'qm-option';
  let state = '';
  if (revealed) {
    if (opt.label === correct)             { cls += ' qm-option--correct'; state = 'correct'; }
    else if (opt.label === selected)       { cls += ' qm-option--wrong';   state = 'wrong'; }
    else                                   { cls += ' qm-option--dim'; }
  } else if (opt.label === selected) {
    cls += ' qm-option--selected';
  }

  return (
    <button
      className={cls}
      onClick={() => !revealed && onClick(opt.label)}
      id={`quiz-option-${opt.label}`}
      disabled={revealed}
      style={{ animationDelay: `${index * 60}ms` }}
      aria-label={`Option ${opt.label}: ${opt.text}`}
    >
      <span className="qm-option-label">{opt.label}</span>
      <span className="qm-option-text">{opt.text}</span>
      {state === 'correct' && <span className="qm-opt-icon qm-opt-icon--ok">✓</span>}
      {state === 'wrong'   && <span className="qm-opt-icon qm-opt-icon--x">✗</span>}
    </button>
  );
}

// ── End Screen ────────────────────────────────────────────────────────────────
function EndScreen({ score, total, pct, onRetry, onBack, answersLog }) {
  const [tab, setTab] = useState('summary'); // 'summary' | 'review'
  const grade =
    pct >= 80 ? { label: 'Excellent!', emoji: '🏆', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' }
  : pct >= 60 ? { label: 'Good Job!',  emoji: '👍', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
  :             { label: 'Keep Going!',emoji: '📚', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };

  return (
    <div className="qm-end">
      <Confetti active={pct >= 80} />

      <div className="qm-end-hero" style={{ background: grade.bg }}>
        <div className="qm-end-emoji">{grade.emoji}</div>
        <h2 className="qm-end-title" style={{ color: grade.color }}>{grade.label}</h2>
        <div className="qm-end-score-row">
          <span className="qm-end-big" style={{ color: grade.color }}>{score}</span>
          <span className="qm-end-of">/ {total}</span>
        </div>
        <div className="qm-end-pct">{pct}% correct</div>
        <div className="qm-end-bar-wrap">
          <div className="qm-end-bar" style={{ width: `${pct}%`, background: grade.color }} />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="qm-end-tabs">
        <button className={`qm-end-tab${tab === 'summary' ? ' active' : ''}`} onClick={() => setTab('summary')}>Summary</button>
        <button className={`qm-end-tab${tab === 'review'  ? ' active' : ''}`} onClick={() => setTab('review')}>Review Answers</button>
      </div>

      {tab === 'summary' ? (
        <div className="qm-end-summary">
          <div className="qm-stat-grid">
            <div className="qm-stat"><span className="qm-stat-val" style={{ color: '#22c55e' }}>{score}</span><span className="qm-stat-lbl">Correct</span></div>
            <div className="qm-stat"><span className="qm-stat-val" style={{ color: '#ef4444' }}>{total - score}</span><span className="qm-stat-lbl">Wrong</span></div>
            <div className="qm-stat"><span className="qm-stat-val" style={{ color: grade.color }}>{pct}%</span><span className="qm-stat-lbl">Score</span></div>
          </div>
          <div className="qm-end-tip">
            {pct < 60
              ? '💡 Tip: Use "Learn Mode" to study these sections, then quiz again!'
              : pct < 80
              ? '📖 Almost there! Revisit the wrong answers below and retry.'
              : '🎉 Outstanding! You have mastered these legal sections.'}
          </div>
        </div>
      ) : (
        <div className="qm-review">
          {answersLog.map((a, i) => (
            <div key={i} className={`qm-review-item${a.isCorrect ? ' correct' : ' wrong'}`}>
              <div className="qm-review-q">Q{i + 1}. {a.question}</div>
              <div className="qm-review-row">
                <span className={`qm-review-tag${a.isCorrect ? ' ok' : ' bad'}`}>
                  Your answer: {a.selectedText || a.selected}
                </span>
                {!a.isCorrect && (
                  <span className="qm-review-tag ok">Correct: {a.correctText || a.correct}</span>
                )}
              </div>
              {a.explanation && <p className="qm-review-exp">{a.explanation}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="qm-end-btns">
        <button className="qm-btn qm-btn--primary" onClick={onRetry} id="quiz-retry">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Try Again
        </button>
        <button className="qm-btn qm-btn--outline" onClick={onBack} id="quiz-back">
          Choose Topic
        </button>
      </div>
    </div>
  );
}

// ── Loading Screen ─────────────────────────────────────────────────────────────
function LoadingScreen() {
  const tips = [
    'BNS 2023 (Bharatiya Nyaya Sanhita) replaced IPC 1860 with 358 sections.',
    'BNS 103 covers murder — previously IPC 302.',
    'BNS 303 covers theft — previously IPC 379.',
    'Community service is a new punishment introduced by BNS 2023.',
    'BNS 64 covers rape with stricter provisions than old IPC 376.',
    'BNS 118 covers grievous hurt — new clearer categories than IPC 320.',
    '"Cognizable" means police can arrest without a warrant.',
    'BNS added new chapters on organised crime and terrorism.',
    'All 511 IPC sections were reorganised into 358 BNS sections.',
    'BNS 111 is the new anti-organised crime provision with life imprisonment.',
  ];
  const [tip] = useState(() => tips[Math.floor(Math.random() * tips.length)]);
  return (
    <div className="qm-loading-screen">
      <div className="qm-loading-spinner">
        <div className="qm-spin-ring" />
        <div className="qm-spin-ring qm-spin-ring--2" />
      </div>
      <p className="qm-loading-title">Preparing your quiz…</p>
      <p className="qm-loading-tip">💡 {tip}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function QuizMode({ topic, onBack, onClose }) {
  const [questions, setQuestions]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [current, setCurrent]       = useState(0);
  const [selected, setSelected]     = useState(null);
  const [revealed, setRevealed]     = useState(false);
  const [score, setScore]           = useState(0);
  const [streak, setStreak]         = useState(0);
  const [done, setDone]             = useState(false);
  const [error, setError]           = useState('');
  const [answersLog, setAnswersLog] = useState([]);
  const [submitted, setSubmitted]   = useState(false);
  const [slideDir, setSlideDir]     = useState('enter'); // 'enter' | 'exit'
  const [timeLeft, setTimeLeft]     = useState(QUESTION_TIME);
  const [timedOut, setTimedOut]     = useState(false);
  const timerRef = useRef(null);

  // ── Load quiz ──────────────────────────────────────────────────────────────
  const loadQuiz = useCallback(() => {
    setLoading(true); setDone(false); setCurrent(0);
    setSelected(null); setRevealed(false); setScore(0);
    setStreak(0); setAnswersLog([]); setSubmitted(false);
    setTimeLeft(QUESTION_TIME); setTimedOut(false);

    const cat   = topic?.category || '';
    const sec   = topic?.bns_section || topic?.ipc_section || '';
    const title = topic?.title || '';
    const mode  = topic?.quizMode || 'mixed';

    // Read already-seen question keys from localStorage
    let seenKeys = [];
    try {
      const stored = localStorage.getItem(SEEN_KEY);
      seenKeys = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(seenKeys)) seenKeys = [];
    } catch { seenKeys = []; }

    let url = `${API}/quiz/generate?count=10&mode=${mode}`;
    if (cat)   url += `&category=${encodeURIComponent(cat)}`;
    if (sec)   url += `&section=${encodeURIComponent(sec)}`;
    if (title) url += `&title=${encodeURIComponent(title)}`;
    // Send the last 100 seen keys so backend skips them (cap avoids URL length limit)
    const toExclude = seenKeys.slice(-100);
    if (toExclude.length > 0) {
      url += `&exclude_ids=${encodeURIComponent(toExclude.join(','))}`;
    }

    // Disable cache so repeated attempts work properly
    url += `&_t=${Date.now()}`;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 30000);

    const quizToken = localStorage.getItem('vidhan_token');
    fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: quizToken ? { Authorization: `Bearer ${quizToken}` } : {},
    })
      .then(r => {
        clearTimeout(timeoutId);
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(d => {
        const qs = d.questions || [];
        setQuestions(qs);
        setLoading(false);

        // Persist seen keys so next session gets different questions
        const newKeys      = qs.map(q => `${q.id}::${q.q_type}`).filter(Boolean);
        const updatedSeen  = [...new Set([...seenKeys, ...newKeys])];
        if (updatedSeen.length >= MAX_SEEN) {
          // Full cycle — reset so questions rotate from the beginning again
          localStorage.removeItem(SEEN_KEY);
        } else {
          try { localStorage.setItem(SEEN_KEY, JSON.stringify(updatedSeen)); } catch { /* storage full */ }
        }
      })
      .catch(err => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setError('⏳ The quiz took too long to generate. Please try again.');
        } else {
          setError('Failed to load quiz. Please try again.');
        }
        setLoading(false);
      });
  }, [topic?.category, topic?.ipc_section, topic?.title, topic?.quizMode]);

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || done || revealed) return;
    clearInterval(timerRef.current);
    setTimeLeft(QUESTION_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setTimedOut(true);
          // auto-reveal as wrong
          setRevealed(true);
          setStreak(0);
          const q = questions[current];
          if (q) {
            setAnswersLog(prev => [...prev, {
              question:    q.question,
              correct:     q.correct,
              correctText: q.options.find(o => o.label === q.correct)?.text || '',
              selected:    '—',
              selectedText:'(Time up)',
              isCorrect:   false,
              explanation: q.explanation,
            }]);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [current, loading, done, revealed, questions]);

  // ── Submit results ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!done || submitted || questions.length === 0) return;
    setSubmitted(true);
    const token = localStorage.getItem('vidhan_token');
    fetch(`${API}/quiz/submit`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        score, total: questions.length,
        category: topic?.category || null,
        answers:  answersLog,
      }),
    }).catch(() => {});
  }, [done, submitted, score, questions.length, topic?.category, answersLog]);

  // ── Keyboard nav ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e) => {
      if (e.key === 'Escape')   { onClose(); return; }
      if (done || loading)      return;
      if (!revealed) {
        const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D',
                      'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D',
                      'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D' };
        if (map[e.key]) handleSelect(map[e.key]);
      } else {
        if (e.key === 'Enter' || e.key === 'ArrowRight') handleNext();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });

  // ── Voice Command Listener (JD Assistant) ──────────────────────────────────
  useEffect(() => {
    const handleVoiceCommand = (e) => {
      const { action, payload } = e.detail;
      if (done || loading) return;
      
      if (action === 'quiz_select' && !revealed) {
        handleSelect(payload);
      } else if (action === 'quiz_next' && (revealed || timedOut)) {
        handleNext();
      }
    };
    window.addEventListener('jd_command', handleVoiceCommand);
    return () => window.removeEventListener('jd_command', handleVoiceCommand);
  });

  const handleSelect = (label) => {
    if (revealed) return;
    clearInterval(timerRef.current);
    setSelected(label);
    setRevealed(true);
    const q = questions[current];
    const isCorrect = label === q.correct;
    if (isCorrect) {
      setScore(s => s + 1);
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }
    setAnswersLog(prev => [...prev, {
      question:    q.question,
      correct:     q.correct,
      correctText: q.options.find(o => o.label === q.correct)?.text || '',
      selected:    label,
      selectedText:q.options.find(o => o.label === label)?.text || '',
      isCorrect,
      explanation: q.explanation,
    }]);
  };

  const handleNext = () => {
    setSlideDir('exit');
    setTimeout(() => {
      if (current < questions.length - 1) {
        setCurrent(c => c + 1);
        setSelected(null);
        setRevealed(false);
        setTimedOut(false);
        setSlideDir('enter');
      } else {
        setDone(true);
      }
    }, 220);
  };

  // ── Render States ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="qm-overlay">
      <div className="qm-panel"><LoadingScreen /></div>
    </div>
  );

  if (error) return (
    <div className="qm-overlay">
      <div className="qm-panel qm-panel--center">
        <div className="qm-error-icon">⚠️</div>
        <p className="qm-error-msg">{error}</p>
        <button className="qm-btn qm-btn--outline" onClick={onBack}>Go Back</button>
      </div>
    </div>
  );

  if (!questions.length) return (
    <div className="qm-overlay">
      <div className="qm-panel qm-panel--center">
        <div className="qm-error-icon">📭</div>
        <p className="qm-error-msg">No questions available for this topic.</p>
        <button className="qm-btn qm-btn--outline" onClick={onBack}>Go Back</button>
      </div>
    </div>
  );

  const q        = questions[current];
  const progress = ((current + (revealed ? 1 : 0)) / questions.length) * 100;
  const finalPct = done ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="qm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="qm-panel">

        {/* ── Header ── */}
        <div className="qm-header">
          <button className="qm-nav-btn" onClick={onBack} aria-label="Back">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>

          <div className="qm-header-center">
            <span className="qm-mode-label">
              { topic?.quizMode === 'ipc_only'      ? '📚 IPC 1860 Quiz'
              : topic?.quizMode === 'bns_only'      ? '🟢 BNS 2023 Quiz'
              : topic?.quizMode === 'enriched_only' ? '⚖️ Compare Quiz'
              : '⚡ Mixed Quiz' }
            </span>
            <div className="qm-score-pill">
              Score <strong>{score}</strong>/{questions.length}
            </div>
          </div>

          <button className="qm-close-btn" onClick={onClose} aria-label="Close quiz">✕</button>
        </div>

        {done ? (
          <EndScreen
            score={score} total={questions.length}
            pct={finalPct}
            onRetry={loadQuiz} onBack={onBack}
            answersLog={answersLog}
          />
        ) : (
          <>
            {/* ── Progress bar ── */}
            <div className="qm-prog-wrap">
              <div className="qm-prog-bar" style={{ width: `${progress}%` }} />
            </div>

            {/* ── Question meta row ── */}
            <div className="qm-meta-row">
              <span className="qm-q-counter">Q {current + 1} <span className="qm-q-of">/ {questions.length}</span></span>
              {q.category && <span className="qm-cat-pill">{q.category}</span>}
              <StreakBadge streak={streak} />
              <CircularTimer timeLeft={timeLeft} total={QUESTION_TIME} />
            </div>

            {/* ── Question card ── */}
            <div className={`qm-q-card qm-q-card--${slideDir}`} key={current}>
              {/* Question type tag only — section numbers are hidden to avoid giving away the answer */}
              <div className="qm-tags">
                {q.q_type && <span className="qm-tag qm-tag--type">{
                  { punishment: '⚖️ Punishment', section_ipc: '📜 Old IPC',
                    section_bns: '🟢 BNS Section', category: '🗂️ Category',
                    bailable: '🔓 Bail Status', bns_punishment: '⚖️ BNS Punishment',
                    bns_section_id: '🟢 BNS ID', bns_chapter: '📖 Chapter',
                    bns_definition: '📝 Definition', title_id: '🏷️ Identify',
                    ai_generated: '🤖 AI' }[q.q_type] || '📝 Quiz'
                }</span>}
              </div>

              <h3 className="qm-q-text">{q.question}</h3>

              {/* ── Options ── */}
              <div className="qm-options">
                {q.options.map((opt, i) => (
                  <OptionBtn
                    key={opt.label} opt={opt} index={i}
                    selected={selected} correct={q.correct}
                    revealed={revealed || timedOut}
                    onClick={handleSelect}
                  />
                ))}
              </div>

              {/* ── Explanation ── */}
              {(revealed || timedOut) && (
                <div className={`qm-explanation ${timedOut && !selected ? 'timed-out' : selected === q.correct ? 'correct' : 'wrong'}`}>
                  <div className="qm-exp-header">
                    {timedOut && !selected
                      ? '⏰ Time\'s up!'
                      : selected === q.correct
                      ? '✅ Correct!'
                      : `❌ Wrong — Correct answer: ${q.options.find(o => o.label === q.correct)?.text}`
                    }
                  </div>
                  <p className="qm-exp-text">{q.explanation}</p>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="qm-footer">
              {!revealed && !timedOut && (
                <p className="qm-hint">
                  <kbd>A</kbd><kbd>B</kbd><kbd>C</kbd><kbd>D</kbd> or click an option · <kbd>Esc</kbd> to close
                </p>
              )}
              {(revealed || timedOut) && (
                <button className="qm-btn qm-btn--primary qm-next-btn" onClick={handleNext} id="quiz-next">
                  {current < questions.length - 1 ? 'Next Question' : 'See Results'}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
