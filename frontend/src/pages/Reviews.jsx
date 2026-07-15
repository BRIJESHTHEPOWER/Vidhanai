import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, MessageSquarePlus, Quote, Award, Users, TrendingUp, Filter } from 'lucide-react';
import confetti from 'canvas-confetti';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Lanyard from '../components/Lanyard/Lanyard';
import './Reviews.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

/* ── Star renderer ── */
function StarRow({ rating, size = 18, interactive = false, onRate }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="rv-star-row">
      {[1, 2, 3, 4, 5].map(s => (
        <span
          key={s}
          className={`rv-star ${(interactive ? (hover || rating) : rating) >= s ? 'rv-star--filled' : ''} ${interactive ? 'rv-star--interactive' : ''}`}
          style={{ fontSize: size }}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onRate?.(s)}
        >★</span>
      ))}
    </div>
  );
}

/* ── Single review card ── */
function ReviewCard({ review, index }) {
  const initials = review.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#6366f1', '#06b6d4', '#f59e0b', '#ec4899', '#22c55e', '#ef4444'];
  const color = colors[review.name.charCodeAt(0) % colors.length];
  const date = new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <motion.div
      className="rv-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
    >
      <div className="rv-card-glow" style={{ '--glow-color': color }} />

      {/* Quote icon */}
      <Quote className="rv-card-quote-icon" size={32} />

      {/* Stars */}
      <StarRow rating={review.rating} />

      {/* Review text */}
      <p className="rv-card-text">"{review.text}"</p>

      {/* Divider */}
      <div className="rv-card-divider" />

      {/* Author row */}
      <div className="rv-card-author">
        <div className="rv-card-avatar" style={{ background: `linear-gradient(135deg, ${color}cc, ${color}55)`, borderColor: color + '44' }}>
          {initials}
        </div>
        <div className="rv-card-author-info">
          <span className="rv-card-name">{review.name}</span>
          <span className="rv-card-date">{date}</span>
        </div>
        <div className="rv-card-rating-badge" style={{ background: `${color}18`, borderColor: `${color}44`, color }}>
          {review.rating}.0 ★
        </div>
      </div>
    </motion.div>
  );
}

/* ── Stats banner ── */
function StatsBanner({ reviews }) {
  if (!reviews.length) return null;
  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  const dist = [5, 4, 3, 2, 1].map(s => ({ star: s, count: reviews.filter(r => r.rating === s).length }));

  return (
    <div className="rv-stats-banner">
      <div className="rv-stats-score">
        <span className="rv-stats-big">{avg}</span>
        <div>
          <StarRow rating={Math.round(avg)} size={22} />
          <span className="rv-stats-count">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="rv-stats-bars">
        {dist.map(({ star, count }) => (
          <div key={star} className="rv-stats-bar-row">
            <span className="rv-stats-bar-label">{star} ★</span>
            <div className="rv-stats-bar-track">
              <motion.div
                className="rv-stats-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
            <span className="rv-stats-bar-num">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Submit modal ── */
function SubmitModal({ onClose, onSuccess }) {
  const navigate = useNavigate();
  const accountName = localStorage.getItem('vidhan_user') || '';
  // Real login state = a token AND a name are both present. A stale name alone
  // (from an expired/cleared session) must not look "logged in".
  const isLoggedIn = !!(localStorage.getItem('vidhan_token') && accountName);
  const [role, setRole] = useState('');
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const goLogin = () => { onClose(); navigate('/login'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) { setError('Review text is required.'); return; }
    if (text.trim().length < 10) { setError('Review must be at least 10 characters.'); return; }

    const token = localStorage.getItem('vidhan_token');
    if (!token) { setError('Please log in to submit a review.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role: role.trim(), rating, text: text.trim() }),
      });
      if (res.status === 401) {
        // Token missing/expired/invalid — clear the stale session so the UI stops
        // pretending we're logged in, and prompt a fresh login.
        localStorage.removeItem('vidhan_token');
        localStorage.removeItem('vidhan_user');
        throw new Error('Your session has expired. Please log in again.');
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to submit');
      }
      const newReview = await res.json();
      onSuccess(newReview);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="rv-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          className="rv-modal"
          initial={{ scale: 0.9, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          <button className="rv-modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>

          <div className="rv-modal-header">
            <div className="rv-modal-icon"><MessageSquarePlus size={22} /></div>
            <div>
              <h2 className="rv-modal-title">Share Your Experience</h2>
              <p className="rv-modal-sub">Help others understand how Vidhan.ai helped you</p>
            </div>
          </div>

          {!isLoggedIn ? (
            <div className="rv-login-required" style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
              {error && <div className="rv-modal-error" style={{ marginBottom: 16 }}><X size={14} /> {error}</div>}
              <p style={{ color: 'var(--clr-text-muted, #94a3b8)', fontSize: 15, lineHeight: 1.6, margin: '0 0 20px' }}>
                You need to be logged in to post a review — this keeps every review
                tied to a real account and shown under your real name.
              </p>
              <button type="button" className="rv-modal-submit" onClick={goLogin} style={{ width: '100%' }}>
                <MessageSquarePlus size={18} /> Log In to Continue
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="rv-modal-form">
            <div className="rv-modal-row">
              <div className="rv-field">
                <label>Posting As</label>
                <input type="text" value={accountName} disabled readOnly />
              </div>
              <div className="rv-field">
                <label>Your Role <span>(optional)</span></label>
                <input
                  type="text"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  placeholder="e.g. Student, Business Owner"
                  maxLength={50}
                  autoFocus
                />
              </div>
            </div>

            <div className="rv-field">
              <label>Rating *</label>
              <div className="rv-modal-stars">
                {[1,2,3,4,5].map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`rv-modal-star-btn ${rating >= s ? 'active' : ''}`}
                    onClick={() => setRating(s)}
                    title={`${s} star${s > 1 ? 's' : ''}`}
                  >
                    <Star size={32} fill={rating >= s ? 'currentColor' : 'none'} />
                  </button>
                ))}
                <span className="rv-modal-star-label">
                  {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
                </span>
              </div>
            </div>

            <div className="rv-field">
              <label>Your Review * <span className="rv-char-count">{text.length}/1000</span></label>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="How did Vidhan.ai help you? Share your experience with legal queries, explanations, case understanding..."
                maxLength={1000}
                rows={5}
                required
              />
            </div>

            {error && <div className="rv-modal-error"><X size={14} /> {error}</div>}

            <button type="submit" className="rv-modal-submit" disabled={submitting}>
              {submitting ? (
                <><span className="rv-spinner" /> Submitting...</>
              ) : (
                <><MessageSquarePlus size={18} /> Submit Review</>
              )}
            </button>
          </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/* ── Thank You Card Modal ──
   Stays MOUNTED at all times (hidden via CSS) so the Lanyard's WebGL canvas,
   physics world and environment lighting are fully initialised on page load.
   Toggling `visible` is then instant — no re-mount, no loading delay. */
function ThankYouCard({ review, visible, onClose, onAnother }) {
  useEffect(() => {
    if (!visible) return;
    // Trigger confetti when the card is revealed
    const duration = 2500;
    const end = Date.now() + duration;
    let cancelled = false;

    const frame = () => {
      if (cancelled) return;
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        zIndex: 10001,   // above the thank-you overlay (z 10000)
        colors: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        zIndex: 10001,
        colors: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
    return () => { cancelled = true; };
  }, [visible]);

  return createPortal(
      <div
        className={`rv-thank-you-overlay${visible ? '' : ' rv-thank-you-overlay--hidden'}`}
        aria-hidden={!visible}
        onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{ padding: 0, alignItems: 'stretch' }}
      >
        <button 
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 32, right: 32, zIndex: 100,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8',
            width: 48, height: 48, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
        >
          <X size={24} />
        </button>

        <div className="rv-thankyou-banner">
          <h2>Thank you for your review!</h2>
          <p>
            {review?.name
              ? `We appreciate it, ${review.name.split(' ')[0]} — your story helps others find justice.`
              : 'Your story helps others find justice.'}
          </p>
        </div>

        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}>
          <Lanyard position={[0, 0, 24]} gravity={[0, -40, 0]} transparent={true} name={review?.name?.split(' ')[0]} replay={visible} />
        </div>
        
        <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: 16 }}>
          <button className="rv-btn-primary" onClick={onClose} style={{ pointerEvents: 'auto' }}>
            Continue Exploring
          </button>
          <button className="rv-btn-secondary" onClick={onAnother} style={{ pointerEvents: 'auto', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
            Submit Another Review
          </button>
        </div>
      </div>,
    document.body
  );
}

/* ── Main Page ── */
export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterRating, setFilterRating] = useState(0); // 0 = all
  const [sortBy, setSortBy] = useState('newest');
  const [submittedReview, setSubmittedReview] = useState(null);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/reviews?limit=100&featured_only=false`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleNewReview = (review) => {
    setReviews(prev => [review, ...prev]);
    setSubmittedReview(review);
  };

  // Filter + sort
  const displayed = reviews
    .filter(r => filterRating === 0 || r.rating === filterRating)
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'highest') return b.rating - a.rating;
      if (sortBy === 'lowest') return a.rating - b.rating;
      return 0;
    });

  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—';

  return (
    <div className="rv-page">
      <Navbar />

      {/* ── Hero ── */}
      <section className="rv-hero">
        <div className="rv-hero-orb rv-hero-orb-1" />
        <div className="rv-hero-orb rv-hero-orb-2" />
        <motion.div
          className="rv-hero-content"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="rv-hero-badge">
            <Award size={14} />
            Community Reviews
          </div>
          <h1 className="rv-hero-title">
            Community Voices,<br /><span className="rv-hero-gradient">Real Impact</span>
          </h1>
          <p className="rv-hero-sub">
            From students to business owners — see how Vidhan.ai is making India's legal system accessible to everyone.
          </p>

          {/* Quick stats */}
          <div className="rv-hero-stats">
            <div className="rv-hero-stat">
              <Users size={18} />
              <span><strong>{reviews.length}</strong> Reviews</span>
            </div>
            <div className="rv-hero-stat">
              <Star size={18} />
              <span><strong>{avg}</strong> Avg Rating</span>
            </div>
            <div className="rv-hero-stat">
              <TrendingUp size={18} />
              <span><strong>100%</strong> Real Users</span>
            </div>
          </div>

          <button className="rv-hero-cta" onClick={() => setShowModal(true)}>
            <MessageSquarePlus size={20} />
            Write a Review
          </button>
        </motion.div>
      </section>

      <div className="rv-body">
        {/* Stats banner */}
        <StatsBanner reviews={reviews} />

        {/* Removed Toast in favor of Thank You Card */}

        {/* ── Filter bar ── */}
        <div className="rv-filterbar">
          <div className="rv-filterbar-left">
            <Filter size={15} />
            <span>Filter:</span>
            {[0,5,4,3,2,1].map(s => (
              <button
                key={s}
                className={`rv-filter-chip ${filterRating === s ? 'active' : ''}`}
                onClick={() => setFilterRating(s)}
              >
                {s === 0 ? 'All' : `${s} ★`}
              </button>
            ))}
          </div>
          <select className="rv-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
          </select>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="rv-loading">
            <div className="rv-loading-spinner" />
            <p>Loading reviews...</p>
          </div>
        ) : displayed.length === 0 ? (
          <motion.p className="rv-empty-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            No reviews yet{filterRating ? ` for ${filterRating} stars` : ''}.
          </motion.p>
        ) : (
          <>
            <p className="rv-result-count">
              Showing <strong>{displayed.length}</strong> of <strong>{reviews.length}</strong> reviews
            </p>
            <div className="rv-grid">
              {displayed.map((r, i) => (
                <ReviewCard key={r.id || i} review={r} index={i} />
              ))}
            </div>
          </>
        )}

      </div>

      <Footer />

      {showModal && (
        <SubmitModal
          onClose={() => setShowModal(false)}
          onSuccess={handleNewReview}
        />
      )}

      {/* Always mounted (hidden until a review is submitted) so the 3D lanyard
          is pre-initialised and appears instantly — see ThankYouCard note. */}
      <ThankYouCard
        review={submittedReview}
        visible={Boolean(submittedReview)}
        onClose={() => setSubmittedReview(null)}
        onAnother={() => {
          setSubmittedReview(null);
          setShowModal(true);
        }}
      />
    </div>
  );
}
