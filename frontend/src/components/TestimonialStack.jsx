import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquarePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import './TestimonialStack.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/* ── Star SVG ── */
function StarIcon({ fill = "currentColor", stroke = "currentColor" }) {
  return (
    <svg className="ts-star" viewBox="0 0 20 20" fill={fill} stroke={stroke} strokeWidth={stroke === "none" ? "0" : "1"}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

/* ── Single card in the horizontal rail ── */
function TestimonialCard({ testimonial, isActive, index }) {
  return (
    <motion.article
      className={`ts-card${isActive ? ' ts-card-active' : ''}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 4) * 0.06 }}
      aria-roledescription="testimonial"
      aria-label={`Review ${index + 1} by ${testimonial.name}`}
    >
      <span className="ts-badge">{testimonial.badge || 'Community'}</span>

      <div className="ts-stars" aria-label={`${testimonial.rating} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon
            key={i}
            fill={i < testimonial.rating ? "currentColor" : "none"}
            stroke={i < testimonial.rating ? "currentColor" : "rgba(6,182,212,0.5)"}
          />
        ))}
      </div>

      <p className="ts-quote">"{testimonial.quote || testimonial.text}"</p>

      <div className="ts-divider" />

      <div className="ts-profile">
        <div className="ts-avatar-wrap">
          <img
            className="ts-avatar"
            src={testimonial.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name)}&background=3b82f6&color=fff`}
            alt=""
            loading="lazy"
          />
        </div>
        <div className="ts-profile-text">
          <p className="ts-name">{testimonial.name}</p>
          <p className="ts-role">{testimonial.role || 'Verified User'}</p>
        </div>
      </div>
    </motion.article>
  );
}

/* ─── Main export ─── */
export default function TestimonialStack() {
  const scrollerRef = useRef(null);
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [testimonials, setTestimonials] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Only admin-approved ("featured") reviews are shown in this homepage
        // showcase. Every other submitted review still shows on /reviews.
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

  // Which card is centred in the rail, plus whether we've hit either end so the
  // arrows can disable themselves. Driven by real scroll position rather than a
  // counter, so dragging, trackpad flicks and keyboard scrolling all agree.
  const syncToScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll('.ts-card'));
    if (!cards.length) return;

    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActiveIndex(best);
    setEdges({
      atStart: el.scrollLeft <= 2,
      atEnd: el.scrollLeft >= el.scrollWidth - el.clientWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncToScroll();
    el.addEventListener('scroll', syncToScroll, { passive: true });
    window.addEventListener('resize', syncToScroll);
    return () => {
      el.removeEventListener('scroll', syncToScroll);
      window.removeEventListener('resize', syncToScroll);
    };
  }, [syncToScroll, testimonials.length]);

  const scrollToIndex = (i) => {
    const el = scrollerRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('.ts-card');
    const target = cards[Math.max(0, Math.min(i, cards.length - 1))];
    if (!target) return;
    // Centre the card in the rail rather than aligning it left, so partial
    // neighbours stay visible and the rail reads as a continuous strip.
    el.scrollTo({
      left: target.offsetLeft - (el.clientWidth - target.offsetWidth) / 2,
      behavior: 'smooth',
    });
  };

  // Wait for the fetch, and skip the showcase entirely if there are no
  // admin-approved reviews yet — never fall back to fake testimonials.
  if (!loaded || testimonials.length === 0) return null;

  return (
    <section className="ts-section" id="testimonials">
      <div className="ts-heading-wrapper">
        <div className="ts-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Trusted by Thousands
        </div>
        <h2 className="ts-title">Real People,&nbsp;Real Justice</h2>
        <p className="ts-subtitle">
          From tenants to founders, students to activists — see how Vidhan.ai is making India's legal system accessible to everyone.
        </p>

        <button className="write-review-btn" onClick={() => navigate('/reviews')} style={{ marginTop: '20px' }}>
          <MessageSquarePlus size={20} />
          Write a Review
        </button>
      </div>

      <div className="ts-carousel">
        <button
          type="button"
          className="ts-nav ts-nav-prev"
          onClick={() => scrollToIndex(activeIndex - 1)}
          disabled={edges.atStart}
          aria-label="Previous review"
        >
          <ChevronLeft size={22} />
        </button>

        {/* Native horizontal scroll + snap: works with touch, trackpad, shift-
            wheel and arrow keys for free, and needs no scroll hijacking. */}
        <div
          className="ts-scroller"
          ref={scrollerRef}
          tabIndex={0}
          role="region"
          aria-label="Community reviews, scroll horizontally"
        >
          {testimonials.map((t, i) => (
            <TestimonialCard
              key={t.id}
              testimonial={t}
              index={i}
              isActive={i === activeIndex}
            />
          ))}
        </div>

        <button
          type="button"
          className="ts-nav ts-nav-next"
          onClick={() => scrollToIndex(activeIndex + 1)}
          disabled={edges.atEnd}
          aria-label="Next review"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {testimonials.length > 1 && (
        <div className="ts-progress" role="tablist" aria-label="Choose a review">
          {testimonials.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Go to review ${i + 1}`}
              className={`ts-dot${i === activeIndex ? ' active' : ''}`}
              onClick={() => scrollToIndex(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
