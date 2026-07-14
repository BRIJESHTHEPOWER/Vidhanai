/**
 * JDTeacherPlayer.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Live-class voice lesson player.
 *
 * Pipeline (server-side):
 *   MongoDB (law text) → Groq (JD teaching script) → Sarvam AI TTS → WAV audio
 *
 * Key UX guarantees:
 *  • Audio plays without interruption once loaded (single WAV blob per section).
 *  • Typed doubt input is ALWAYS visible — student can ask without waiting.
 *  • Mic button for voice doubts at any time.
 *  • Doubt → JD answers in same language → "Is your doubt clear now?" → Yes/No.
 *  • Seamless section-to-section via /jd/teach/next.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './JDTeacherPlayer.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const SR_API   = window.SpeechRecognition || window.webkitSpeechRecognition || null;

const LANG_CODE = {
  English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN',
  Tamil: 'ta-IN', Telugu: 'te-IN', Marathi: 'mr-IN',
  Bengali: 'bn-IN', Malayalam: 'ml-IN',
};

const PHASE = {
  LOADING:     'loading',
  LESSON:      'lesson',       // JD speaking the lesson
  END_TOPIC:   'end-topic',    // section finished — continue or doubt?
  LISTENING:   'listening',    // mic open
  ANSWERING:   'answering',    // JD answering a doubt
  DOUBT_WAIT:  'doubt-wait',   // "Is your doubt clear now?"
  DONE:        'done',         // chapter complete
  ERROR:       'error',
};

// ── Animated JD Avatar ────────────────────────────────────────────────────────
function JDAvatar({ phase }) {
  const speaking  = phase === PHASE.LESSON || phase === PHASE.ANSWERING;
  const listening = phase === PHASE.LISTENING;
  const thinking  = phase === PHASE.LOADING;
  return (
    <div className={`jdtp-avatar ${speaking ? 'jdtp-avatar--speaking' : ''} ${listening ? 'jdtp-avatar--listening' : ''} ${thinking ? 'jdtp-avatar--thinking' : ''}`}>
      <div className="jdtp-avatar-inner">
        <span className="jdtp-avatar-label">JD</span>
      </div>
      {speaking  && <div className="jdtp-sound-bars"><span/><span/><span/><span/><span/></div>}
      {thinking  && <div className="jdtp-dots"><span/><span/><span/></div>}
      {listening && <div className="jdtp-mic-pulse" />}
    </div>
  );
}

// ── Always-visible typed doubt input ─────────────────────────────────────────
function DoubtBar({ onSubmit, onMic, micActive, disabled }) {
  const [text, setText] = useState('');
  const ref = useRef(null);

  const submit = () => {
    const q = text.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setText('');
  };

  return (
    <div className="jdtp-doubt-bar">
      <input
        ref={ref}
        className="jdtp-doubt-input"
        placeholder="Ask JD anything about this topic…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submit()}
        disabled={disabled}
        aria-label="Ask a doubt"
      />
      <button
        className={`jdtp-doubt-mic-btn${micActive ? ' jdtp-doubt-mic-btn--active' : ''}`}
        onClick={onMic}
        disabled={disabled && !micActive}
        title={micActive ? 'Stop listening' : 'Voice input'}
        aria-label="Voice doubt"
      >
        {micActive ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        )}
      </button>
      <button
        className="jdtp-doubt-send-btn"
        onClick={submit}
        disabled={!text.trim() || disabled}
        aria-label="Send doubt"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/>
        </svg>
      </button>
    </div>
  );
}

// ── Main player ───────────────────────────────────────────────────────────────
export default function JDTeacherPlayer({
  lawCode,
  chapterNum,
  sectionIndex  = 0,
  mode          = 'general',
  language      = 'English',
  onSectionChange,
  onChapterComplete,
  onClose,
}) {
  const [phase,        setPhase]        = useState(PHASE.LOADING);
  const [sessionId,    setSessionId]    = useState(null);
  const [sectionInfo,  setSectionInfo]  = useState(null);
  const [displayText,  setDisplayText]  = useState('');
  const [ttsAvailable, setTtsAvailable] = useState(true);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [micActive,    setMicActive]    = useState(false);
  const [micTranscript, setMicTranscript] = useState('');

  const audioRef       = useRef(null);
  const lessonAudioUrl = useRef(null);
  const lessonText     = useRef('');
  const resumeTimeRef  = useRef(0);
  const wasAtEndRef    = useRef(false);
  const recogRef       = useRef(null);
  const sessionIdRef   = useRef(null);
  const sectionIndexRef = useRef(sectionIndex);
  const startedKeyRef  = useRef(null);
  const phaseRef       = useRef(phase);

  useEffect(() => { sessionIdRef.current  = sessionId;    }, [sessionId]);
  useEffect(() => { sectionIndexRef.current = sectionIndex; }, [sectionIndex]);
  useEffect(() => { phaseRef.current = phase;              }, [phase]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const playUrl = useCallback((path) => {
    const audio = audioRef.current;
    if (!audio || !path) return;
    audio.src  = `${API_BASE}${path}`;
    audio.currentTime = 0;
    audio.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, []);

  const post = useCallback(async (path, body) => {
    const token = localStorage.getItem('vidhan_token');
    const res  = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`);
    return data;
  }, []);

  const applySection = useCallback((data) => {
    setSectionInfo(data);
    setDisplayText(data.text);
    lessonText.current    = data.text;
    lessonAudioUrl.current = data.audio_url;
    setTtsAvailable(data.tts_available ?? true);
    onSectionChange?.(data.section_index, data.section);

    if (data.audio_url) {
      setPhase(PHASE.LESSON);
      playUrl(data.audio_url);
    } else {
      setPhase(PHASE.END_TOPIC);
    }
  }, [playUrl, onSectionChange]);

  // ── Start a lesson session ───────────────────────────────────────────────
  const startLesson = useCallback(async (secIdx) => {
    setPhase(PHASE.LOADING);
    setErrorMsg('');
    try {
      const data = await post('/jd/teach/start', {
        law_code:      lawCode,
        chapter_num:   chapterNum,
        section_index: secIdx,
        mode,
        language,
      });
      setSessionId(data.session_id);
      applySection(data);
    } catch (e) {
      setErrorMsg(e.message || 'Could not start the lesson. Check your connection.');
      setPhase(PHASE.ERROR);
    }
  }, [lawCode, chapterNum, mode, language, post, applySection]);

  // Guard against StrictMode double-mount and prop-change re-triggers
  useEffect(() => {
    const key = `${lawCode}/${chapterNum}`;
    if (startedKeyRef.current === key) return;
    startedKeyRef.current = key;
    startLesson(sectionIndexRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawCode, chapterNum]);

  // ── Audio events ──────────────────────────────────────────────────────────
  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    const cur = phaseRef.current;
    if (cur === PHASE.LESSON)     setPhase(PHASE.END_TOPIC);
    else if (cur === PHASE.ANSWERING) setPhase(PHASE.DOUBT_WAIT);
  }, []);

  const handleAudioError = useCallback(() => {
    setIsPlaying(false);
    setPhase(phaseRef.current === PHASE.LESSON ? PHASE.END_TOPIC : PHASE.DOUBT_WAIT);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  // ── Continue to next section ──────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (!sessionIdRef.current) return;
    setPhase(PHASE.LOADING);
    setErrorMsg('');
    try {
      const data = await post('/jd/teach/next', { session_id: sessionIdRef.current });
      if (data.done) {
        setDisplayText(data.message || 'Chapter complete!');
        setPhase(PHASE.DONE);
        onChapterComplete?.();
        return;
      }
      applySection(data);
    } catch (e) {
      setErrorMsg(e.message || 'Could not load the next section.');
      setPhase(PHASE.ERROR);
    }
  }, [post, applySection, onChapterComplete]);

  // ── Doubt flow ────────────────────────────────────────────────────────────
  const submitDoubt = useCallback(async (question) => {
    if (!sessionIdRef.current || !question.trim()) return;

    // Pause audio, remember position
    const audio = audioRef.current;
    wasAtEndRef.current  = (phaseRef.current === PHASE.END_TOPIC || phaseRef.current === PHASE.DONE);
    resumeTimeRef.current = audio ? audio.currentTime : 0;
    if (audio && !audio.paused) { audio.pause(); setIsPlaying(false); }

    setPhase(PHASE.LOADING);
    setErrorMsg('');
    try {
      const data = await post('/jd/teach/interrupt', {
        session_id: sessionIdRef.current,
        question,
      });
      setDisplayText(data.text);
      if (data.audio_url) {
        setPhase(PHASE.ANSWERING);
        playUrl(data.audio_url);
      } else {
        setPhase(PHASE.DOUBT_WAIT);
      }
    } catch (e) {
      setErrorMsg(e.message || 'Could not process your question.');
      setPhase(wasAtEndRef.current ? PHASE.END_TOPIC : PHASE.LESSON);
    }
  }, [post, playUrl]);

  // ── Resolve doubt — Yes / No ──────────────────────────────────────────────
  const resolveDoubt = useCallback(async (resolved) => {
    if (!sessionIdRef.current) return;
    setPhase(PHASE.LOADING);
    setErrorMsg('');
    try {
      const data = await post('/jd/teach/doubt-resolved', {
        session_id: sessionIdRef.current,
        resolved,
      });
      if (resolved) {
        setDisplayText(lessonText.current);
        if (wasAtEndRef.current) {
          setPhase(PHASE.END_TOPIC);
        } else {
          setPhase(PHASE.LESSON);
          const audio = audioRef.current;
          if (audio && lessonAudioUrl.current) {
            if (!audio.src.endsWith(lessonAudioUrl.current)) {
              audio.src = `${API_BASE}${lessonAudioUrl.current}`;
            }
            audio.currentTime = resumeTimeRef.current || 0;
            audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          }
        }
      } else {
        setDisplayText(data.text);
        if (data.audio_url) {
          setPhase(PHASE.ANSWERING);
          playUrl(data.audio_url);
        } else {
          setPhase(PHASE.DOUBT_WAIT);
        }
      }
    } catch (e) {
      setErrorMsg(e.message || 'Something went wrong.');
      setPhase(wasAtEndRef.current ? PHASE.END_TOPIC : PHASE.LESSON);
    }
  }, [post, playUrl]);

  // ── Voice mic ─────────────────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    recogRef.current?.stop();
    setMicActive(false);
    setMicTranscript('');
  }, []);

  const toggleMic = useCallback(() => {
    if (micActive) { stopMic(); return; }
    if (!SR_API)   { setErrorMsg('Voice input not supported in this browser. Please type your doubt.'); return; }

    const audio = audioRef.current;
    wasAtEndRef.current   = (phaseRef.current === PHASE.END_TOPIC || phaseRef.current === PHASE.DONE);
    resumeTimeRef.current = audio ? audio.currentTime : 0;
    if (audio && !audio.paused) { audio.pause(); setIsPlaying(false); }

    setMicTranscript('');
    setMicActive(true);
    setPhase(PHASE.LISTENING);

    const recog = new SR_API();
    recog.lang           = LANG_CODE[language] || 'en-IN';
    recog.interimResults = true;
    recog.maxAlternatives = 1;

    recog.onresult = (evt) => {
      const interim  = Array.from(evt.results).map(r => r[0].transcript).join('');
      setMicTranscript(interim);
      if (evt.results[evt.results.length - 1].isFinal) {
        const final = evt.results[evt.results.length - 1][0].transcript;
        stopMic();
        submitDoubt(final);
      }
    };
    recog.onerror = () => {
      stopMic();
      setErrorMsg('Could not hear clearly. Please type your question.');
      setPhase(wasAtEndRef.current ? PHASE.END_TOPIC : PHASE.LESSON);
    };
    recog.onend = () => {
      setMicActive(false);
      recogRef.current = null;
    };

    recogRef.current = recog;
    try { recog.start(); } catch { stopMic(); }
  }, [micActive, language, stopMic, submitDoubt]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => {
    recogRef.current?.stop();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const pct      = sectionInfo?.total_sections
    ? Math.round(((sectionInfo.section_index + 1) / sectionInfo.total_sections) * 100)
    : 0;
  const isLast   = sectionInfo?.is_last_section;
  const inputBusy = phase === PHASE.LOADING || phase === PHASE.LISTENING;

  // ── Phase label shown in JD bubble ───────────────────────────────────────
  const phaseLine = {
    [PHASE.LOADING]:    'JD is preparing your lesson…',
    [PHASE.LESSON]:     isPlaying ? '🔊 JD is teaching…' : '⏸ Paused — press ▶ to resume',
    [PHASE.END_TOPIC]:  'Section complete. Continue or ask a doubt?',
    [PHASE.LISTENING]:  micTranscript ? `🎤 "${micTranscript}"` : '🎤 Listening — speak your doubt…',
    [PHASE.ANSWERING]:  isPlaying ? '🔊 JD is answering…' : '⏸ Answer ready — press ▶',
    [PHASE.DOUBT_WAIT]: 'Is your doubt clear now?',
    [PHASE.DONE]:       '🎉 Chapter complete!',
    [PHASE.ERROR]:      '⚠️ Something went wrong.',
  }[phase] || '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="jdtp-root">
      {/* Hidden audio element — single source of truth for playback */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        hidden
      />

      {/* ── Header: avatar + chapter/section info + close ── */}
      <div className="jdtp-header">
        <JDAvatar phase={phase} />
        <div className="jdtp-header-info">
          <div className="jdtp-chapter-name">
            {sectionInfo?.chapter_name || `${lawCode} · Chapter ${chapterNum}`}
          </div>
          {sectionInfo?.section && (
            <div className="jdtp-section-name">
              §{sectionInfo.section.section_number} — {sectionInfo.section.title}
            </div>
          )}
          <div className="jdtp-phase-line">{phaseLine}</div>
        </div>
        {onClose && (
          <button className="jdtp-close-btn" onClick={onClose} aria-label="Close lesson">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div className="jdtp-progress-track" aria-hidden="true">
        <div className="jdtp-progress-fill" style={{ width: `${pct}%` }} />
        <span className="jdtp-progress-label">
          {sectionInfo ? `${sectionInfo.section_index + 1} / ${sectionInfo.total_sections}` : ''}
        </span>
      </div>

      {/* ── Banner: errors / TTS unavailable ── */}
      {!ttsAvailable && (
        <div className="jdtp-banner jdtp-banner--warn">
          Voice is not available right now — showing the lesson text only.
        </div>
      )}
      {errorMsg && (
        <div className="jdtp-banner jdtp-banner--error">
          {errorMsg}
          <button className="jdtp-banner-dismiss" onClick={() => setErrorMsg('')}>✕</button>
        </div>
      )}

      {/* ── Lesson text ── */}
      <div className="jdtp-body">
        {phase === PHASE.LOADING && (
          <div className="jdtp-loading-state">
            <span className="jdtp-spinner" />
            <span>JD is preparing your lesson…<br/>Warming up his voice…</span>
          </div>
        )}

        {phase !== PHASE.LOADING && phase !== PHASE.ERROR && displayText && (
          <div className="jdtp-lesson-text">
            <p>{displayText}</p>
          </div>
        )}

        {/* Doubt-resolved buttons */}
        {phase === PHASE.DOUBT_WAIT && (
          <div className="jdtp-doubt-resolved">
            <p className="jdtp-doubt-resolved-q">Is your doubt clear now?</p>
            <div className="jdtp-doubt-resolved-btns">
              <button className="jdtp-btn jdtp-btn--yes" onClick={() => resolveDoubt(true)}>
                ✅ Yes, continue the lesson
              </button>
              <button className="jdtp-btn jdtp-btn--no" onClick={() => resolveDoubt(false)}>
                🔄 No, explain differently
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div className="jdtp-footer">

        {/* Audio playback controls */}
        <div className="jdtp-audio-row">
          {(phase === PHASE.LESSON || phase === PHASE.ANSWERING) && (
            <button
              className={`jdtp-btn jdtp-btn--play${isPlaying ? ' active' : ''}`}
              onClick={togglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              }
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          )}

          {phase === PHASE.END_TOPIC && (
            <button className="jdtp-btn jdtp-btn--primary" onClick={handleNext}>
              {isLast ? '✅ Finish Chapter' : 'Next Section ▶'}
            </button>
          )}

          {phase === PHASE.DONE && (
            <span className="jdtp-done-msg">🎉 Chapter complete! Great work.</span>
          )}

          {phase === PHASE.ERROR && (
            <button className="jdtp-btn jdtp-btn--ghost" onClick={() => startLesson(sectionIndexRef.current)}>
              ↺ Retry
            </button>
          )}
        </div>

        {/* Always-visible typed doubt input */}
        {phase !== PHASE.DONE && (
          <DoubtBar
            onSubmit={submitDoubt}
            onMic={toggleMic}
            micActive={micActive}
            disabled={inputBusy || phase === PHASE.DOUBT_WAIT}
          />
        )}
      </div>
    </div>
  );
}
