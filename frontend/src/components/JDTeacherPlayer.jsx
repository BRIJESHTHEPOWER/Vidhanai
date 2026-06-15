/**
 * JDTeacherPlayer.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Voice-driven chapter lesson player powered by the local Kokoro TTS pipeline.
 *
 * Pipeline (all server-side):
 *   legal dataset (Mongo) -> Groq (JD teaching script) -> Kokoro TTS -> audio/wav
 *
 * Flow:
 *  1. On mount, calls POST /jd/teach/start -> gets the first section's lesson
 *     text + audio, plays it automatically.
 *  2. While JD speaks, the student can press "Ask a doubt" -> mic records a
 *     question (browser SpeechRecognition) -> POST /jd/teach/interrupt ->
 *     JD answers (Kokoro audio) and asks "Is your doubt clear now?".
 *  3. Yes -> resumes the lesson exactly where it paused.
 *     No  -> JD re-explains more simply, then asks again.
 *  4. At the end of a section, JD asks whether to continue or raise a doubt.
 *     "Continue" -> POST /jd/teach/next for the following section.
 *  5. When the chapter is finished, shows a completion message.
 *
 * If Kokoro isn't installed on the server, `tts_available` is false and the
 * player falls back to text-only mode (no autoplay, manual "Continue").
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './JDTeacherPlayer.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const SR_API = window.SpeechRecognition || window.webkitSpeechRecognition || null;

const LANG_CODE = {
  English: 'en-IN', Hindi: 'hi-IN', Kannada: 'kn-IN', Tamil: 'ta-IN',
  Telugu: 'te-IN', Marathi: 'mr-IN', Bengali: 'bn-IN', Malayalam: 'ml-IN',
};

// Phases
const PHASE = {
  LOADING:    'loading',
  LESSON:     'lesson',          // lesson audio playing/paused
  END_TOPIC:  'end-of-topic',    // ended naturally — continue or ask doubt?
  LISTENING:  'listening',       // mic capturing the student's question
  ANSWERING:  'answering',       // JD answering a doubt
  DOUBT_WAIT: 'doubt-wait',      // "Is your doubt clear now?"
  DONE:       'done',            // chapter complete
  ERROR:      'error',
};

function Avatar({ phase, ttsAvailable }) {
  const speaking = phase === PHASE.LESSON || phase === PHASE.ANSWERING;
  const thinking = phase === PHASE.LOADING;
  const listening = phase === PHASE.LISTENING;
  return (
    <div className={`jdtp-avatar ${speaking ? 'jdtp-avatar--speaking' : ''} ${listening ? 'jdtp-avatar--listening' : ''}`}>
      <div className="jdtp-avatar-core">JD</div>
      {speaking && <div className="jdtp-wave"><span/><span/><span/><span/></div>}
      {thinking && <div className="jdtp-dots"><span/><span/><span/></div>}
      {listening && <div className="jdtp-mic-ring" />}
      {!ttsAvailable && <div className="jdtp-mute-badge" title="Voice unavailable on this server">🔇</div>}
    </div>
  );
}

export default function JDTeacherPlayer({
  lawCode,
  chapterNum,
  sectionIndex = 0,
  mode = 'student',
  language = 'English',
  onSectionChange,
  onChapterComplete,
  onClose,
}) {
  const [phase, setPhase]           = useState(PHASE.LOADING);
  const [sessionId, setSessionId]   = useState(null);
  const [sectionInfo, setSectionInfo] = useState(null); // {section_number, title, section_index, total_sections, is_last_section, chapter_name}
  const [displayText, setDisplayText] = useState('');
  const [ttsAvailable, setTtsAvailable] = useState(true);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [transcript, setTranscript] = useState('');

  const audioRef       = useRef(null);
  const lessonAudioUrl = useRef(null);   // for resuming after a doubt
  const lessonText     = useRef('');
  const resumeTimeRef  = useRef(0);
  const wasAtEndRef    = useRef(false);  // doubt was asked after the lesson already ended
  const recogRef       = useRef(null);
  const sessionIdRef   = useRef(null);
  const sectionIndexRef = useRef(sectionIndex);  // latest start index without retriggering the effect
  const startedKeyRef  = useRef(null);           // guards StrictMode double-mount from starting twice

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { sectionIndexRef.current = sectionIndex; }, [sectionIndex]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const playUrl = useCallback((path) => {
    const audio = audioRef.current;
    if (!audio || !path) return;
    audio.src = `${API_BASE}${path}`;
    audio.currentTime = 0;
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, []);

  const post = useCallback(async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Request failed (${res.status})`);
    }
    return data;
  }, []);

  // ── Start a lesson session ───────────────────────────────────────────────
  const startLesson = useCallback(async (secIdx) => {
    setPhase(PHASE.LOADING);
    setErrorMsg('');
    try {
      const data = await post('/jd/teach/start', {
        law_code: lawCode,
        chapter_num: chapterNum,
        section_index: secIdx,
        mode,
        language,
      });
      setSessionId(data.session_id);
      setTtsAvailable(data.tts_available);
      setSectionInfo(data);
      setDisplayText(data.text);
      lessonText.current = data.text;
      lessonAudioUrl.current = data.audio_url;
      onSectionChange?.(data.section_index, data.section);

      if (data.audio_url) {
        setPhase(PHASE.LESSON);
        playUrl(data.audio_url);
      } else {
        // No TTS available — text-only, show controls immediately
        setPhase(PHASE.END_TOPIC);
      }
    } catch (e) {
      setErrorMsg(e.message || 'Failed to start the lesson.');
      setPhase(PHASE.ERROR);
    }
  }, [lawCode, chapterNum, mode, language, post, playUrl, onSectionChange]);

  // Start ONLY when the chapter (or law) changes — NOT when sectionIndex changes.
  // The player advances sections itself via /jd/teach/next and reports back through
  // onSectionChange; reacting to that prop change would re-create the session and
  // cut off the audio mid-sentence (the "stops suddenly" / repeated-greeting bug).
  // The startedKeyRef guard also stops React StrictMode's dev double-mount from
  // kicking off two sessions (two slow Kokoro syntheses) for the same chapter.
  useEffect(() => {
    const key = `${lawCode}/${chapterNum}`;
    if (startedKeyRef.current === key) return;
    startedKeyRef.current = key;
    startLesson(sectionIndexRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lawCode, chapterNum]);

  // ── Audio element events ─────────────────────────────────────────────────
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (phase === PHASE.LESSON) {
      setPhase(PHASE.END_TOPIC);
    } else if (phase === PHASE.ANSWERING) {
      setPhase(PHASE.DOUBT_WAIT);
    }
  }, [phase]);

  // ── Play / Pause toggle ───────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  // ── Continue to next section ─────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (!sessionIdRef.current) return;
    setPhase(PHASE.LOADING);
    setErrorMsg('');
    try {
      const data = await post('/jd/teach/next', { session_id: sessionIdRef.current });
      if (data.done) {
        setDisplayText(data.message);
        setPhase(PHASE.DONE);
        onChapterComplete?.();
        return;
      }
      setSectionInfo(data);
      setDisplayText(data.text);
      lessonText.current = data.text;
      lessonAudioUrl.current = data.audio_url;
      onSectionChange?.(data.section_index, data.section);

      if (data.audio_url) {
        setPhase(PHASE.LESSON);
        playUrl(data.audio_url);
      } else {
        setPhase(PHASE.END_TOPIC);
      }
    } catch (e) {
      setErrorMsg(e.message || 'Could not load the next section.');
      setPhase(PHASE.ERROR);
    }
  }, [post, playUrl, onSectionChange, onChapterComplete]);

  // ── Doubt / interruption flow ────────────────────────────────────────────
  const askDoubt = useCallback(async (question) => {
    if (!sessionIdRef.current || !question.trim()) {
      setPhase(phase === PHASE.LISTENING ? (wasAtEndRef.current ? PHASE.END_TOPIC : PHASE.LESSON) : phase);
      return;
    }
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
  }, [post, playUrl, phase]);

  // Begin listening for the student's spoken question
  const startListening = useCallback(() => {
    const audio = audioRef.current;

    // Remember exactly where we were so we can resume.
    wasAtEndRef.current = (phase === PHASE.END_TOPIC || phase === PHASE.DONE);
    resumeTimeRef.current = audio ? audio.currentTime : 0;
    if (audio && !audio.paused) audio.pause();
    setIsPlaying(false);

    if (!SR_API) {
      setErrorMsg('Voice input is not supported in this browser. Type your doubt instead.');
      return;
    }

    setTranscript('');
    setPhase(PHASE.LISTENING);

    const recog = new SR_API();
    recog.lang = LANG_CODE[language] || 'en-IN';
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onresult = (evt) => {
      const text = evt.results?.[0]?.[0]?.transcript || '';
      setTranscript(text);
      askDoubt(text);
    };
    recog.onerror = () => {
      setErrorMsg('Could not hear you clearly. Please try again.');
      setPhase(wasAtEndRef.current ? PHASE.END_TOPIC : PHASE.LESSON);
    };
    recog.onend = () => {
      recogRef.current = null;
    };

    recogRef.current = recog;
    recog.start();
  }, [phase, language, askDoubt]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setPhase(wasAtEndRef.current ? PHASE.END_TOPIC : PHASE.LESSON);
  }, []);

  // Submit a typed doubt (fallback when SpeechRecognition is unavailable)
  const submitTypedDoubt = useCallback((text) => {
    wasAtEndRef.current = (phase === PHASE.END_TOPIC || phase === PHASE.DONE);
    const audio = audioRef.current;
    resumeTimeRef.current = audio ? audio.currentTime : 0;
    if (audio && !audio.paused) audio.pause();
    setIsPlaying(false);
    askDoubt(text);
  }, [phase, askDoubt]);

  // "Is your doubt clear now?" — Yes/No
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
        if (wasAtEndRef.current) {
          setDisplayText(lessonText.current);
          setPhase(PHASE.END_TOPIC);
        } else {
          setDisplayText(lessonText.current);
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

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      recogRef.current?.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const pct = sectionInfo?.total_sections
    ? Math.round(((sectionInfo.section_index + 1) / sectionInfo.total_sections) * 100)
    : 0;

  return (
    <div className="jdtp-panel">
      <audio ref={audioRef} onEnded={handleEnded} hidden />

      <div className="jdtp-header">
        <Avatar phase={phase} ttsAvailable={ttsAvailable} />
        <div className="jdtp-header-text">
          <div className="jdtp-chapter">{sectionInfo?.chapter_name || `${lawCode} — Chapter ${chapterNum}`}</div>
          {sectionInfo && (
            <div className="jdtp-section">
              Section {sectionInfo.section?.section_number}: {sectionInfo.section?.title}
              <span className="jdtp-progress-txt"> · {sectionInfo.section_index + 1} / {sectionInfo.total_sections}</span>
            </div>
          )}
        </div>
        {onClose && <button className="jdtp-close" onClick={onClose} title="Close">✕</button>}
      </div>

      {sectionInfo && (
        <div className="jdtp-progress-track">
          <div className="jdtp-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {!ttsAvailable && (
        <div className="jdtp-banner jdtp-banner--warn">
          🔇 Voice is unavailable on this server (Kokoro not installed). Showing lesson text only.
        </div>
      )}

      {errorMsg && (
        <div className="jdtp-banner jdtp-banner--error">{errorMsg}</div>
      )}

      <div className="jdtp-body">
        {phase === PHASE.LOADING && (
          <div className="jdtp-loading">
            <span className="jdtp-spinner" /> JD is preparing the lesson…
          </div>
        )}

        {phase !== PHASE.LOADING && phase !== PHASE.ERROR && (
          <p className="jdtp-text">{displayText}</p>
        )}

        {phase === PHASE.LISTENING && (
          <div className="jdtp-listening">
            🎤 Listening… {transcript && <em>“{transcript}”</em>}
            <button className="jdtp-btn jdtp-btn--ghost" onClick={stopListening}>Cancel</button>
          </div>
        )}

        {phase === PHASE.ERROR && (
          <div className="jdtp-banner jdtp-banner--error">{errorMsg || 'Something went wrong.'}</div>
        )}
      </div>

      <div className="jdtp-controls">
        {phase === PHASE.LESSON && (
          <>
            <button className="jdtp-btn jdtp-btn--icon" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? '⏸' : '▶️'}
            </button>
            <button className="jdtp-btn jdtp-btn--mic" onClick={startListening} title="Ask a doubt">
              🎤 Ask a doubt
            </button>
          </>
        )}

        {phase === PHASE.END_TOPIC && (
          <>
            <button className="jdtp-btn jdtp-btn--primary" onClick={handleNext}>
              {sectionInfo?.is_last_section ? 'Finish chapter' : 'Continue to next topic ▶'}
            </button>
            <button className="jdtp-btn jdtp-btn--mic" onClick={startListening} title="Ask a doubt">
              🎤 Ask a doubt
            </button>
          </>
        )}

        {phase === PHASE.DOUBT_WAIT && (
          <>
            <span className="jdtp-prompt">Is your doubt clear now?</span>
            <button className="jdtp-btn jdtp-btn--primary" onClick={() => resolveDoubt(true)}>Yes, continue</button>
            <button className="jdtp-btn jdtp-btn--ghost" onClick={() => resolveDoubt(false)}>No, explain again</button>
          </>
        )}

        {phase === PHASE.ANSWERING && (
          <button className="jdtp-btn jdtp-btn--icon" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶️'}
          </button>
        )}

        {phase === PHASE.DONE && (
          <span className="jdtp-prompt">🎉 Chapter complete!</span>
        )}

        {!SR_API && (phase === PHASE.LESSON || phase === PHASE.END_TOPIC) && (
          <TypedDoubtInput onSubmit={submitTypedDoubt} />
        )}
      </div>
    </div>
  );
}

function TypedDoubtInput({ onSubmit }) {
  const [text, setText] = useState('');
  return (
    <div className="jdtp-typed-doubt">
      <input
        type="text"
        value={text}
        placeholder="Type your doubt…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) {
            onSubmit(text.trim());
            setText('');
          }
        }}
      />
      <button
        className="jdtp-btn jdtp-btn--ghost"
        disabled={!text.trim()}
        onClick={() => { onSubmit(text.trim()); setText(''); }}
      >
        Ask
      </button>
    </div>
  );
}
