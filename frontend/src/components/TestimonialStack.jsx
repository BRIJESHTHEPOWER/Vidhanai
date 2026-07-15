import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useSpring, useScroll } from 'framer-motion';
import { MessageSquarePlus } from 'lucide-react';
import './TestimonialStack.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/* fan config: index 0 = front card */
const STACK_CONFIG = [
  { rotate: 0,   tx: 0,   ty: 0,   z: 100 },
  { rotate: 6,   tx: 28,  ty: -10, z: 90  },
  { rotate: 12,  tx: 56,  ty: -20, z: 80  },
  { rotate: 18,  tx: 84,  ty: -30, z: 70  },
  { rotate: 24,  tx: 112, ty: -40, z: 60  },
  { rotate: 30,  tx: 140, ty: -50, z: 50  },
];

/* ── Star SVG ── */
function StarIcon({ fill = "currentColor", stroke = "currentColor" }) {
  return (
    <svg className="ts-star" viewBox="0 0 20 20" fill={fill} stroke={stroke} strokeWidth={stroke === "none" ? "0" : "1"}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.54-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

/* ── Single animated card ── */
function TestimonialCard({ testimonial, stackPosition, isActive, totalCount }) {
  const cfg = STACK_CONFIG[stackPosition] ?? STACK_CONFIG[STACK_CONFIG.length - 1];

  const rotate = useSpring(cfg.rotate, { stiffness: 120, damping: 18 });
  const tx     = useSpring(cfg.tx,     { stiffness: 120, damping: 18 });
  const ty     = useSpring(cfg.ty,     { stiffness: 120, damping: 18 });

  useEffect(() => {
    rotate.set(cfg.rotate);
    tx.set(cfg.tx);
    ty.set(cfg.ty);
  }, [cfg.rotate, cfg.tx, cfg.ty]);

  return (
    <motion.div
      className={`ts-card${isActive ? ' ts-card-active' : ''}`}
      style={{
        rotate,
        x: tx,
        y: ty,
        zIndex: cfg.z,
        opacity: stackPosition >= STACK_CONFIG.length ? 0 : isActive ? 1 : 0.65,
      }}
      initial={{ opacity: 0, y: 30 }}
      animate={{
        opacity: stackPosition >= STACK_CONFIG.length ? 0 : isActive ? 1 : 0.65,
        y: cfg.ty,
        transition: { type: 'spring', stiffness: 100, damping: 20, delay: stackPosition * 0.04 },
      }}
      whileHover={
        isActive
          ? {
              y: cfg.ty - 12,
              scale: 1.015,
              boxShadow:
                '0 60px 120px rgba(0,0,0,0.75), 0 0 80px rgba(99,102,241,0.18) inset',
              transition: { type: 'spring', stiffness: 300, damping: 22 },
            }
          : {}
      }
    >
      {/* badge */}
      <span className="ts-badge">{testimonial.badge || 'Community'}</span>

      {/* stars */}
      <div className="ts-stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} fill={i < testimonial.rating ? "currentColor" : "none"} stroke={i < testimonial.rating ? "currentColor" : "rgba(6,182,212,0.5)"} />
        ))}
      </div>

      {/* quote */}
      <p className="ts-quote">"{testimonial.quote || testimonial.text}"</p>

      {/* divider */}
      <div className="ts-divider" />

      {/* profile */}
      <div className="ts-profile">
        <div className="ts-avatar-wrap">
          <img
            className="ts-avatar"
            src={testimonial.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(testimonial.name)}&background=3b82f6&color=fff`}
            alt={testimonial.name}
            loading="lazy"
          />
        </div>
        <div className="ts-profile-text">
          <p className="ts-name">{testimonial.name}</p>
          <p className="ts-role">{testimonial.role || 'Verified User'}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main export ─── */
export default function TestimonialStack() {
  const sectionRef = useRef(null);
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [testimonials, setTestimonials] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const fetchReviews = async () => {
    try {
      // Only admin-approved ("featured") reviews are shown in this homepage
      // showcase. Every other submitted review still shows on /reviews.
      const res = await fetch(`${API_BASE}/reviews`);
      if (res.ok) {
        const data = await res.json();
        const formatted = data.map((d, i) => ({
          ...d,
          quote: d.text,
          id: d.id || i,
          badge: i === 0 ? 'Newest' : 'Community'
        }));
        setTestimonials(formatted);
      }
    } catch (err) {
      console.error("Failed to fetch reviews:", err);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  useEffect(() => {
    if (testimonials.length === 0) return;
    const unsub = scrollYProgress.on('change', (v) => {
      const idx = Math.min(
        Math.floor(v * testimonials.length),
        testimonials.length - 1
      );
      setActiveIndex(idx);
    });
    return unsub;
  }, [scrollYProgress, testimonials]);

  const getStackPos = (cardIndex) => {
    const diff = cardIndex - activeIndex;
    return diff < 0 ? -1 : diff;
  };

  // Wait for the fetch, and skip the showcase entirely if there are no
  // admin-approved reviews yet — never fall back to fake testimonials.
  if (!loaded || testimonials.length === 0) return null;

  return (
    <section className="ts-section" ref={sectionRef} id="testimonials">
      {/* ── Heading (not sticky, scrolls out) ── */}
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

      {/* ── Sticky card stack ── */}
      <div className="ts-sticky">
        <div className="ts-stack-wrapper">
          {/* render back-to-front */}
          {[...testimonials].reverse().map((t, ri) => {
            const cardIndex = testimonials.length - 1 - ri;
            const stackPos  = getStackPos(cardIndex);
            const isActive  = cardIndex === activeIndex;

            /* departed — fly out upward */
            if (stackPos < 0) {
              return (
                <motion.div
                  key={t.id}
                  className="ts-card"
                  initial={false}
                  animate={{ y: -680, opacity: 0, rotate: -18, scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                  style={{ zIndex: 5, pointerEvents: 'none' }}
                />
              );
            }

            return (
              <TestimonialCard
                key={t.id}
                testimonial={t}
                stackPosition={stackPos}
                isActive={isActive}
                totalCount={testimonials.length}
              />
            );
          })}

          {/* progress dots */}
          <div className="ts-progress">
            {testimonials.map((_, i) => (
              <div
                key={i}
                className={`ts-dot${i === activeIndex ? ' active' : ''}`}
              />
            ))}
          </div>

          {/* scroll hint — only show on first card */}
          {activeIndex === 0 && testimonials.length > 0 && (
            <div className="ts-scroll-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
              </svg>
              Scroll to explore
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
