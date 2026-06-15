import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import CinematicSectionBackground from './CinematicSectionBackground';
import './LawComparison.css';

const COMPARISONS = [
  {
    id: 'murder',
    title: 'Murder',
    old: { code: 'IPC 302', label: 'Indian Penal Code 1860', desc: 'Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine.', penalty: 'Death / Life + Fine', year: '1860', status: 'Amended' },
    new: { code: 'BNS 101', label: 'Bharatiya Vidhan Sanhita 2023', desc: 'Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine. Community service provisions added for juvenile offenders.', penalty: 'Death / Life + Fine', year: '2023', status: 'Active' },
    diff: 'Added community service clause for juvenile offenders; clarified definition of culpable homicide.',
  },
  {
    id: 'theft',
    title: 'Theft',
    old: { code: 'IPC 379', label: 'Indian Penal Code 1860', desc: 'Punishment for theft — shall be punished with imprisonment of either description for a term which may extend to three years, or with fine, or with both.', penalty: '3 Years + Fine', year: '1860', status: 'Amended' },
    new: { code: 'BNS 303', label: 'Bharatiya Vidhan Sanhita 2023', desc: 'Whoever commits theft shall be punished with rigorous imprisonment for a term which may extend to three years, with mandatory fine proportional to stolen property value.', penalty: '3 Years + Proportional Fine', year: '2023', status: 'Active' },
    diff: 'Mandatory proportional fine added; "rigorous" imprisonment specification introduced.',
  },
  {
    id: 'sedition',
    title: 'Sedition',
    old: { code: 'IPC 124A', label: 'Indian Penal Code 1860', desc: 'Whoever by words, either spoken or written, or by signs, or by visible representation, or otherwise excites disaffection towards the Government...', penalty: 'Life + Fine', year: '1860', status: 'Repealed' },
    new: { code: 'BNS 152', label: 'Bharatiya Vidhan Sanhita 2023', desc: 'Acts endangering sovereignty, unity and integrity of India. More narrowly defined to focus on subversive activity rather than mere expression.', penalty: '7 Years / Life', year: '2023', status: 'Active' },
    diff: 'Sedition replaced with narrower "Acts against state sovereignty"; removes colonial-era ambiguity.',
  },
];

/* Tilt card with framer-motion */
function TiltCard({ children, className, style }) {
  const cardRef = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 20 });
  const springY = useSpring(y, { stiffness: 150, damping: 20 });
  const rotateX = useTransform(springY, [-0.5, 0.5], ['8deg', '-8deg']);
  const rotateY = useTransform(springX, [-0.5, 0.5], ['-8deg', '8deg']);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5;
    const cy = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(cx);
    y.set(cy);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      className={className}
      style={{ ...style, rotateX, rotateY, transformPerspective: 800, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}

export default function LawComparison() {
  const [selected, setSelected] = useState(0);
  const [mode, setMode]         = useState('split');
  const [slider, setSlider]     = useState(50);
  const sectionRef = useRef(null);
  const navigate = useNavigate();

  const comp = COMPARISONS[selected];

  const handleMouseMove = (e) => {
    if (!sectionRef.current) return;
    const rect = sectionRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    sectionRef.current.style.setProperty('--mouse-x', `${x}%`);
    sectionRef.current.style.setProperty('--mouse-y', `${y}%`);
  };

  return (
    <section
      id="compare"
      className="section compare-section cinematic-section-wrapper"
      ref={sectionRef}
      onMouseMove={handleMouseMove}
    >
      {/* Cinematic 3D Background — floating golden justice rings */}
      <CinematicSectionBackground type="scales" color1="#f59e0b" color2="#6366f1" />

      <div className="container" style={{ position: 'relative', zIndex: 10 }}>
        <div className="section-header">
          <motion.div
            className="section-label"
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H2v18h6"/><path d="M16 3h6v18h-6"/><path d="M12 3v18"/></svg>
            Law Comparison
          </motion.div>
          <motion.h2
            className="story-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Old Law vs <span className="gradient-text">New Law</span>
          </motion.h2>
          <motion.p
            className="section-subtitle"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            Compare IPC sections with the new Bharatiya Vidhan Sanhita (BNS) 2023. Understand what changed and why.
          </motion.p>
        </div>

        {/* Topic selector */}
        <motion.div
          className="compare-topics"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {COMPARISONS.map((c, i) => (
            <motion.button
              key={c.id}
              id={`compare-topic-${c.id}`}
              className={`compare-topic-btn${selected === i ? ' compare-topic-btn--active' : ''}`}
              onClick={() => setSelected(i)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {c.title}
            </motion.button>
          ))}
          <div className="compare-mode-toggle">
            <button
              className={`compare-mode-btn${mode === 'split' ? ' compare-mode-btn--active' : ''}`}
              onClick={() => setMode('split')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H2v18h6"/><path d="M16 3h6v18h-6"/><path d="M12 3v18"/></svg>
              Split
            </button>
            <button
              className={`compare-mode-btn${mode === 'overlay' ? ' compare-mode-btn--active' : ''}`}
              onClick={() => setMode('overlay')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              Overlay
            </button>
          </div>
        </motion.div>

        {/* Comparison area */}
        <AnimatePresence mode="wait">
          {mode === 'split' ? (
            <motion.div
              key={`split-${comp.id}`}
              className="compare-grid"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5 }}
            >
              {/* Old Law — tilt card */}
              <TiltCard className="law-card law-card--old" style={{}}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: 'linear-gradient(90deg, transparent, #ef444488, transparent)',
                  boxShadow: '0 0 12px #ef444466',
                }} />
                <LawCardContent law={comp.old} type="old" />
              </TiltCard>

              {/* Center divider */}
              <div className="compare-divider">
                <div className="compare-divider-line" />
                <motion.div
                  className="compare-divider-badge"
                  animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  VS
                </motion.div>
                <div className="compare-divider-line" />
              </div>

              {/* New Law — tilt card */}
              <TiltCard className="law-card law-card--new" style={{}}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
                  background: 'linear-gradient(90deg, transparent, #22c55e88, transparent)',
                  boxShadow: '0 0 12px #22c55e66',
                }} />
                <LawCardContent law={comp.new} type="new" />
              </TiltCard>
            </motion.div>
          ) : (
            <motion.div
              key={`overlay-${comp.id}`}
              className="compare-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="compare-overlay-track">
                <div className="compare-overlay-old" style={{ width: `${slider}%` }}>
                  <div className="compare-overlay-content compare-overlay-content--old">
                    <div className="compare-overlay-label">IPC (Old)</div>
                    <div className="law-card-code">{comp.old.code}</div>
                    <p className="law-card-desc">{comp.old.desc}</p>
                  </div>
                </div>
                <div className="compare-overlay-new">
                  <div className="compare-overlay-content compare-overlay-content--new">
                    <div className="compare-overlay-label">BNS (New)</div>
                    <div className="law-card-code compare-overlay-code--new">{comp.new.code}</div>
                    <p className="law-card-desc">{comp.new.desc}</p>
                  </div>
                </div>
                <div className="compare-slider-handle" style={{ left: `${slider}%` }}>
                  <div className="compare-slider-line" />
                  <div className="compare-slider-knob">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>
              </div>
              <input
                type="range"
                className="compare-range"
                min={10}
                max={90}
                value={slider}
                onChange={e => setSlider(Number(e.target.value))}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compare CTA */}
        <motion.div
          className="compare-cta"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          key={comp.id}
        >
          <motion.button
            className="compare-cta-btn"
            onClick={() => navigate(`/compare?topic=${comp.id}`)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H2v18h6"/><path d="M16 3h6v18h-6"/><path d="M12 3v18"/></svg>
            Compare Full Details
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

function LawCardContent({ law, type }) {
  return (
    <>
      <div className="law-card-header">
        <div>
          <span className={`law-card-status law-card-status--${law.status.toLowerCase()}`}>{law.status}</span>
          <div className="law-card-code">{law.code}</div>
          <div className="law-card-year-label">{law.label}</div>
        </div>
        <div className="law-card-year-badge">{law.year}</div>
      </div>
      <p className="law-card-desc">{law.desc}</p>
      <div className="law-card-footer">
        <div className="law-card-penalty-label">Penalty</div>
        <div className="law-card-penalty">{law.penalty}</div>
      </div>
    </>
  );
}
