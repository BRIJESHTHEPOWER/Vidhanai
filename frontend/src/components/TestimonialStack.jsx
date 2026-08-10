import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import './TestimonialStack.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/* Pixels per second the rail drifts. Slow enough to read a card as it passes. */
const SPEED = 34;

/* ── Star SVG ── */
function StarIcon({ filled }) {
  return (
    <svg
      className="ts-star"
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'currentColor' : 'var(--ts-star-empty)'}
      strokeWidth={filled ? 0 : 1}
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

function TestimonialCard({ t }) {
  return (
    <article className="ts-card">
      <span className="ts-badge">{t.badge || 'Community'}</span>

      <div className="ts-stars" aria-label={`${t.rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} filled={i < t.rating} />
        ))}
      </div>

      <p className="ts-quote">"{t.quote || t.text}"</p>

      <div className="ts-divider" />

      <div className="ts-profile">
        <div className="ts-avatar-wrap">
          <img
            className="ts-avatar"
            src={t.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&background=3b82f6&color=fff`}
            alt=""
            loading="lazy"
          />
        </div>
        <div className="ts-profile-text">
          <p className="ts-name">{t.name}</p>
          <p className="ts-role">{t.role || 'Verified User'}</p>
        </div>
      </div>
    </article>
  );
}

export default function TestimonialStack() {
  const railRef = useRef(null);
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Auto-drift is suspended while any of these hold. Kept in a ref so the
  // animation loop reads the latest value without being torn down/rebuilt.
  const paused = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/reviews`);
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setTestimonials(data.map((d, i) => ({
            ...d,
            quote: d.text,
            id: d.id || i,
            badge: i === 0 ? 'Newest' : 'Community',
          })));
        }
      } catch (err) {
        console.error('Failed to fetch reviews:', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setPaused = useCallback((v) => { paused.current = v; }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || testimonials.length === 0) return;

    // Someone who asked for less motion should not be handed a moving wall of
    // text — leave the rail as a plain, manually scrollable strip.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) return;

    let raf = 0;
    let last = performance.now();

    const step = (now) => {
      const dt = Math.min(now - last, 64) / 1000;  // clamp after tab-switch stalls
      last = now;

      if (!paused.current && !document.hidden) {
        // The list is rendered twice, so one full copy is exactly half the
        // scroll width. Wrapping by that amount lands on an identical frame,
        // which is what makes the loop seamless rather than snapping back.
        const half = rail.scrollWidth / 2;
        let next = rail.scrollLeft + SPEED * dt;
        if (half > 0 && next >= half) next -= half;
        rail.scrollLeft = next;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [testimonials.length]);

  if (!loaded || testimonials.length === 0) return null;

  // Second copy is decorative: screen readers would otherwise announce every
  // review twice.
  const loop = [
    ...testimonials.map((t) => ({ t, key: `a-${t.id}`, clone: false })),
    ...testimonials.map((t) => ({ t, key: `b-${t.id}`, clone: true })),
  ];

  return (
    <section className="ts-section" id="testimonials">
      <div className="ts-heading-wrapper">
        <div className="ts-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Trusted by Thousands
        </div>
        <h2 className="ts-title">Real People,&nbsp;Real Justice</h2>
        <p className="ts-subtitle">
          From tenants to founders, students to activists — see how VidhanAI is making India's legal system accessible to everyone.
        </p>

        <button className="write-review-btn" onClick={() => navigate('/reviews')} style={{ marginTop: '20px' }}>
          <MessageSquarePlus size={20} />
          Write a Review
        </button>
      </div>

      {/* Pausing on hover alone would strand touch users, who have no hover, and
          keyboard users tabbing through. Cover all three. */}
      <div
        className="ts-marquee"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerCancel={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        <div
          className="ts-rail"
          ref={railRef}
          tabIndex={0}
          role="region"
          aria-label="Community reviews. Scrolls automatically; hover or focus to pause."
        >
          {loop.map(({ t, key, clone }) => (
            <div key={key} className="ts-slot" aria-hidden={clone || undefined}>
              <TestimonialCard t={t} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
