import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { authHeaders } from '../utils/authHeaders';
import './ComicStory.css';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/* ── Logo import ──────────────────────────────────────────── */
import logoImg from '../assets/logo.png';

/* ═══════════════════════════════════════════════════════════
   Validation — normalise LLM response into 6-panel format
   ═══════════════════════════════════════════════════════════ */

const FALLBACK_PANELS = [
  {
    number: 1, title: "A quiet day in the market...",
    scene_description: "Two friends are at a busy marketplace. One keeps his phone on a table.",
    speech_bubbles: [
      { character: "victim", type: "speech", text: "I'll be right back." },
      { character: "accused", type: "thought", text: "No one is watching..." }
    ],
    caption: "The scene is set in a busy Indian marketplace.",
    image_prompt: ""
  },
  {
    number: 2, title: "The act of theft...",
    scene_description: "The accused quickly takes the phone from the table and walks away.",
    speech_bubbles: [
      { character: "accused", type: "speech", text: "Got it! Let's go..." },
      { character: "victim", type: "speech", text: "Hey! That's my phone!" }
    ],
    caption: "The accused takes the phone without permission and runs away.",
    image_prompt: ""
  },
  {
    number: 3, title: "Complaint is filed...",
    scene_description: "The victim goes to the police station to report the theft.",
    speech_bubbles: [
      { character: "victim", type: "speech", text: "Sir, someone stole my phone!" },
      { character: "officer", type: "speech", text: "We will register your complaint." }
    ],
    caption: "The victim reports the theft to the police.",
    image_prompt: ""
  },
  {
    number: 4, title: "Investigation...",
    scene_description: "Police check CCTV footage and find the accused taking the phone.",
    speech_bubbles: [
      { character: "officer", type: "speech", text: "We found CCTV footage. You stole the phone!" },
      { character: "accused", type: "speech", text: "I... I'm sorry." }
    ],
    caption: "CCTV footage helps identify the accused. He is caught.",
    image_prompt: ""
  },
  {
    number: 5, title: "In the Court...",
    scene_description: "The judge examines the evidence in the courtroom.",
    speech_bubbles: [
      { character: "judge", type: "speech", text: "Taking property without consent is a crime." },
      { character: "accused", type: "speech", text: "I accept my mistake." }
    ],
    caption: "The Judge hears the case and examines all evidence.",
    image_prompt: ""
  },
  {
    number: 6, title: "The Verdict",
    scene_description: "The judge delivers the verdict with a gavel.",
    speech_bubbles: [
      { character: "judge", type: "speech", text: "Guilty under BNS Section 303 (Theft)." },
      { character: "judge_verdict", type: "box", text: "Punishment: Up to 3 years imprisonment, or fine, or both." }
    ],
    caption: "Justice is served!",
    image_prompt: ""
  }
];

function validateComicJSON(data) {
  const fallback = {
    section_number: "303",
    section_title: "Theft",
    act_name: "Bharatiya Nyaya Sanhita",
    tagline: '"Taking Someone\'s Property Without Consent is a Crime!"',
    characters: { accused: "Rahul", victim: "Vikram", officer: "Police Officer", judge: "Judge" },
    panels: FALLBACK_PANELS,
    key_takeaway: "Taking someone else's movable property without their consent is THEFT and is punishable under BNS Section 303.",
    why_applies: [
      "Movable property involved (phone)",
      "Property belonged to another person (Vikram)",
      "Taken without the owner's permission",
      "Dishonest intention to permanently take the property",
      "All essential ingredients of theft are present"
    ],
    remember_message: "Respect others' property. Honesty builds a better society!",
    section_details: {
      section: "303", offence: "Theft",
      type: "Cognizable", bailable: "Yes",
      punishment: "Up to 3 years imprisonment, or fine, or both."
    },
  };

  // Normalise panels — accept 4, 5, or 6 panels; pad to 6 if needed
  let panels = data?.panels || [];
  if (panels.length < 4) {
    panels = fallback.panels;
  } else if (panels.length < 6) {
    // Pad with fallback panels for missing slots
    while (panels.length < 6) {
      panels.push(FALLBACK_PANELS[panels.length]);
    }
  }
  panels = panels.slice(0, 6).map((p, i) => ({
    ...FALLBACK_PANELS[i],
    ...p,
    number: i + 1,
  }));

  return {
    section_number: data?.section_number || fallback.section_number,
    section_title: data?.section_title || fallback.section_title,
    act_name: data?.act_name || fallback.act_name,
    tagline: data?.tagline || fallback.tagline,
    characters: data?.characters || fallback.characters,
    panels,
    key_takeaway: data?.key_takeaway || fallback.key_takeaway,
    why_applies: (data?.why_applies?.length >= 3) ? data.why_applies : fallback.why_applies,
    remember_message: data?.remember_message || data?.footer_remember || fallback.remember_message,
    section_details: data?.section_details || fallback.section_details,
  };
}


/* ═══════════════════════════════════════════════════════════
   ImagePanel — loads image with retry and progressive reveal
   ═══════════════════════════════════════════════════════════ */

function ImagePanel({ prompt, alt }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchImage = useCallback(async () => {
    setLoaded(false);
    setError(false);
    setImgSrc(null);

    if (!prompt) {
      setError(true);
      return;
    }

    try {
      const response = await fetch(
        `${API}/comic-story/image?prompt=${encodeURIComponent(prompt)}`,
        { headers: authHeaders() }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (blob.size < 100) throw new Error("Empty image response");
      setImgSrc(URL.createObjectURL(blob));
    } catch (e) {
      console.warn(`[ImagePanel] Failed (attempt ${retryCount + 1}):`, e.message);
      setError(true);
    }
  }, [prompt, retryCount]);

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  const handleRetry = () => {
    setRetryCount(c => c + 1);
  };

  return (
    <>
      {/* Loading */}
      {!loaded && !error && (
        <div className="panel-img-loading">
          <div className="panel-img-loading-spinner" />
          <span className="panel-img-loading-text">Generating...</span>
        </div>
      )}

      {/* Error + retry */}
      {error && (
        <div className="panel-img-error">
          <span className="panel-img-error-icon">🎨</span>
          <span className="panel-img-error-text">Image generation failed</span>
          <button className="panel-retry-btn" onClick={handleRetry}>
            🔄 Retry
          </button>
        </div>
      )}

      {/* Loaded image */}
      {imgSrc && (
        <img
          src={imgSrc}
          alt={alt}
          className="panel-bg"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </>
  );
}


/* ═══════════════════════════════════════════════════════════
   SVG Speech Bubbles
   ═══════════════════════════════════════════════════════════ */

function wrapText(text, charsPerLine) {
  const words = (text || '').split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > charsPerLine) {
      lines.push(current.trim());
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

function SpeechBubble({ type, text, x, y, maxWidth = 100 }) {
  const lines = wrapText(text, 16);
  const bubbleHeight = 14 + lines.length * 13;

  if (type === 'thought') {
    return (
      <g>
        <rect x={x} y={y} width={maxWidth} height={bubbleHeight}
          rx="18" ry="18" fill="white" fillOpacity="0.92" stroke="#555" strokeWidth="1.2" strokeDasharray="4,2" />
        <circle cx={x + 10} cy={y + bubbleHeight + 4} r="3.5" fill="white" stroke="#555" strokeWidth="0.8" />
        <circle cx={x + 6} cy={y + bubbleHeight + 10} r="2" fill="white" stroke="#555" strokeWidth="0.8" />
        {lines.map((line, i) => (
          <text key={i} x={x + maxWidth / 2} y={y + 12 + i * 13}
            textAnchor="middle" fontSize="8" fill="#222" fontWeight="600" fontFamily="'Space Grotesk', sans-serif">{line}</text>
        ))}
      </g>
    );
  }

  if (type === 'box') {
    return (
      <g>
        <rect x={x} y={y} width={maxWidth + 10} height={bubbleHeight + 4}
          rx="4" fill="#fff8e1" fillOpacity="0.95" stroke="#f57f17" strokeWidth="1.5" />
        {lines.map((line, i) => (
          <text key={i} x={x + (maxWidth + 10) / 2} y={y + 13 + i * 13}
            textAnchor="middle" fontSize="8" fill="#222" fontWeight="700" fontFamily="'Space Grotesk', sans-serif">{line}</text>
        ))}
      </g>
    );
  }

  // Default: speech bubble
  return (
    <g>
      <rect x={x} y={y} width={maxWidth} height={bubbleHeight}
        rx="8" fill="white" fillOpacity="0.94" stroke="#333" strokeWidth="1.3" />
      <polygon points={`${x + 14},${y + bubbleHeight} ${x + 7},${y + bubbleHeight + 7} ${x + 22},${y + bubbleHeight}`}
        fill="white" fillOpacity="0.94" stroke="#333" strokeWidth="0.8" />
      {lines.map((line, i) => (
        <text key={i} x={x + maxWidth / 2} y={y + 12 + i * 13}
          textAnchor="middle" fontSize="8" fill="#222" fontWeight="600" fontFamily="'Space Grotesk', sans-serif">{line}</text>
      ))}
    </g>
  );
}


/* ═══════════════════════════════════════════════════════════
   SceneRenderer — image + speech bubble overlay
   ═══════════════════════════════════════════════════════════ */

function SceneRenderer({ panel, index }) {
  let bubbles = panel.speech_bubbles || [];
  if (bubbles.length === 0) {
    bubbles = FALLBACK_PANELS[index]?.speech_bubbles || [];
  }

  // Keep the vertical centre — where the characters' faces are — clear: pin one
  // bubble to the top edge and the other to the bottom edge. The bottom bubble's
  // y is derived from its own text height so it never overflows the 160-tall
  // viewBox or creeps back up into the face zone.
  const bubbleH = (t) => 14 + wrapText(t || '', 16).length * 13;
  const botH = bubbles[1] ? bubbleH(bubbles[1].text) : 30;
  const pos = [
    { x: 8, y: 6 },                                   // top edge (left)
    { x: 150, y: Math.max(96, 150 - botH) },          // bottom edge (right)
  ];

  // Use story-aware image_prompt from backend, fallback to scene_description
  const imagePrompt = panel.image_prompt ||
    `Indian comic book illustration, vibrant colors: ${panel.scene_description || "Legal scene in India"}`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      <ImagePanel prompt={imagePrompt} alt={panel.title} />

      {/* Speech Bubbles Overlay */}
      <svg viewBox="0 0 260 160" xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 10, pointerEvents: 'none' }}>
        {bubbles[0] && <SpeechBubble type={bubbles[0].type} text={bubbles[0].text} x={pos[0].x} y={pos[0].y} />}
        {bubbles[1] && <SpeechBubble type={bubbles[1].type} text={bubbles[1].text} x={pos[1].x} y={pos[1].y} />}
      </svg>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   PanelCard — single comic panel
   ═══════════════════════════════════════════════════════════ */

function PanelCard({ panel, index }) {
  return (
    <div className="panel-card">
      <div className="panel-title-bar">
        <div className="panel-number-badge">{panel.number}</div>
        <div className="panel-title-text">{panel.title}</div>
      </div>
      <div className="panel-scene-area">
        <SceneRenderer panel={panel} index={index} />
      </div>
      <div className="panel-caption-bar">
        {panel.caption}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   ComicExplainer — "Explain this comic simply" + ask a doubt
   ═══════════════════════════════════════════════════════════ */

function ComicExplainer({ data }) {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading]   = useState(false);
  const [question, setQuestion] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const ask = useCallback(async (q) => {
    setLoading(true);
    setExplanation('');
    try {
      const res = await fetch(`${API}/comic-story/explain`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          section_number: data.section_number,
          section_title:  data.section_title,
          tagline:        data.tagline,
          panels: (data.panels || []).map(p => ({
            number: p.number, title: p.title, caption: p.caption,
          })),
          key_takeaway: data.key_takeaway,
          question: q || '',
          language: 'English',
        }),
      });
      const d = await res.json();
      setExplanation(d.explanation || 'Sorry, I could not explain this comic right now.');
    } catch {
      setExplanation('⚠️ Could not reach the explainer. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [data]);

  // Read the explanation aloud with the browser voice
  const toggleListen = useCallback(() => {
    if (!('speechSynthesis' in window) || !explanation) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(explanation);
    u.lang = 'en-IN';
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }, [explanation, speaking]);

  // Stop any narration when this comic unmounts / changes
  useEffect(() => () => { try { window.speechSynthesis.cancel(); } catch (_) {} }, []);

  return (
    <div className="comic-explain">
      <div className="comic-explain-head">
        <span className="comic-explain-icon">🤔</span>
        <div>
          <div className="comic-explain-title">Didn't fully get it?</div>
          <div className="comic-explain-sub">Let JD explain this comic in simple words, or ask a doubt about it.</div>
        </div>
        <button className="comic-explain-btn" onClick={() => ask('')} disabled={loading}>
          {loading ? '⏳ Explaining…' : '💡 Explain this comic'}
        </button>
      </div>

      {(loading || explanation) && (
        <div className="comic-explain-body">
          {loading && !explanation && (
            <div className="comic-explain-loading">
              <span className="comic-explain-spinner" /> JD is reading the comic…
            </div>
          )}
          {explanation && (
            <>
              <p className="comic-explain-text">{explanation}</p>
              {'speechSynthesis' in window && (
                <button className="comic-explain-listen" onClick={toggleListen}>
                  {speaking ? '⏹ Stop' : '🔊 Listen'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <form
        className="comic-explain-ask"
        onSubmit={(e) => { e.preventDefault(); if (question.trim()) ask(question.trim()); }}
      >
        <input
          type="text"
          className="comic-explain-input"
          placeholder="Ask about this comic… e.g. Why is it a crime?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="comic-explain-ask-btn" disabled={loading || !question.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

export default function ComicStory() {
  const [searchParams] = useSearchParams();
  const initialTopic = searchParams.get('q') || '';

  const [topic, setTopic] = useState(initialTopic);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (searchTopic) => {
    if (!searchTopic.trim()) return;
    setLoading(true); setError(null); setData(null);

    try {
      const res = await fetch(`${API}/comic-story`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ topic: searchTopic.trim(), language: 'English' }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Server error ${res.status}: ${errBody}`);
      }

      const rawText = await res.text();
      let parsedData = null;
      try {
        parsedData = JSON.parse(rawText);
      } catch (err) {
        console.error("JSON parse error:", err);
      }

      const validatedData = validateComicJSON(parsedData || {});
      setData(validatedData);

    } catch (err) {
      console.error(err);
      setError('⚠️ Could not generate the comic. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialTopic) {
      handleSearch(initialTopic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="comic-root">
      <Navbar />
      <main className="comic-main">
        {/* Search bar */}
        <div style={{ marginBottom: '8px', textAlign: 'center', width: '100%' }}>
          <form className="comic-form" onSubmit={(e) => { e.preventDefault(); handleSearch(topic); }}>
            <input
              type="text"
              className="comic-input"
              placeholder="e.g. Someone stole my mobile phone at the cafe"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="comic-btn" disabled={loading || !topic.trim()}>
              {loading ? '⏳ Generating...' : '🎬 Generate Comic'}
            </button>
          </form>
        </div>

        {/* Loading */}
        {loading && (
          <div className="comic-loading">
            <div className="comic-loading-spinner" />
            <p className="comic-loading-text">Generating your legal comic story...</p>
            <p className="comic-loading-sub">This may take 15-30 seconds. The AI is crafting your story.</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="comic-error">
            <p className="comic-error-text">{error}</p>
            <button className="comic-error-retry" onClick={() => handleSearch(topic)}>
              🔄 Retry
            </button>
          </div>
        )}

        {/* ═══ THE INFOGRAPHIC ═══ */}
        {!loading && !error && data && (
          <div className="infographic-page">

            {/* ── HEADER ── */}
            <div className="comic-header">
              {/* Logo left */}
              <div className="comic-header-logo">
                <img src={logoImg} alt="VidhanAI" className="comic-header-logo-icon" />
                <div className="comic-header-logo-text">
                  <span className="comic-header-logo-name">VidhanAI</span>
                  <span className="comic-header-logo-tagline">Law Made Simple, For Everyone</span>
                </div>
              </div>

              {/* Center title */}
              <div className="comic-header-center">
                <h1 className="comic-header-title">
                  BNS SECTION {data.section_number} — {data.section_title.toUpperCase()}
                </h1>
                <div className="comic-header-quote">{data.tagline}</div>
              </div>

              {/* Section box right */}
              <div className="comic-header-section-box">
                <span className="comic-header-section-number">SECTION {data.section_number}</span>
                <span className="comic-header-section-act">{data.act_name}</span>
              </div>
            </div>

            {/* ── 6-PANEL GRID (3×2) ── */}
            <div className="panels-grid">
              {data.panels.map((panel, idx) => (
                <PanelCard key={panel.number} panel={panel} index={idx} />
              ))}
            </div>

            {/* ── BOTTOM SUMMARY (3 boxes) ── */}
            <div className="comic-summary-section">

              {/* 1. Key Takeaway */}
              <div className="comic-summary-box comic-summary-takeaway">
                <div className="comic-summary-title">
                  <span>💡</span> KEY TAKEAWAY
                </div>
                <div className="comic-summary-takeaway-text">
                  {data.key_takeaway}
                </div>
              </div>

              {/* 2. Why Section Applies */}
              <div className="comic-summary-box comic-summary-applies">
                <div className="comic-summary-title">
                  <span>❗</span> WHY {data.section_number} APPLIES?
                </div>
                <ul className="comic-summary-applies-list">
                  {data.why_applies.map((item, i) => (
                    <li key={i}>
                      <span className="comic-summary-applies-check">✅</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="comic-summary-book">
                  📖 BNS {data.section_number}
                </div>
              </div>

              {/* 3. Remember */}
              <div className="comic-summary-box comic-summary-remember">
                <div className="comic-summary-title">
                  <span>⭐</span> REMEMBER
                </div>
                <div className="comic-summary-remember-text">
                  {data.remember_message}
                </div>
              </div>
            </div>

            {/* ── EXPLAIN THIS COMIC ── */}
            <ComicExplainer data={data} />

            {/* ── FOOTER BANNER ── */}
            <div className="comic-footer">
              <span className="comic-footer-icon">⚖️</span>
              <span className="comic-footer-text">
                <span className="comic-footer-brand">VidhanAI</span> — Making Law Easy to Understand for Everyone!
              </span>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
