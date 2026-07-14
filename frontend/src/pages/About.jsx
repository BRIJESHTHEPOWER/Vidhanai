import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ScrollReveal from '../components/ScrollReveal';
import './About.css';

/* ─────────────────── animation presets ─────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] },
});

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};
const staggerChild = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

/* ─────────────────── data ─────────────────── */
const STORY_TIMELINE = [
  {
    year: '2023',
    label: 'The Problem',
    heading: 'A Nation Without Legal Literacy',
    body: "India has 40+ million pending court cases. Most citizens don't know their fundamental rights, can't afford legal counsel, and struggle with laws written in archaic English. We saw a crisis — and a solution.",
    color: '#6366f1',
  },
  {
    year: '2023',
    label: 'The Idea',
    heading: 'AI Meets Indian Law',
    body: 'We built an AI specifically around BNS 2023 and IPC 1860 — India\'s core criminal codes. The goal: make a citizen type any legal question in any Indian language and instantly understand the law.',
    color: '#D4A017',
  },
  {
    year: '2024',
    label: 'Today',
    heading: 'Democratising Legal Knowledge',
    body: 'Vidhan.ai now serves students and everyday citizens across India. From understanding a theft charge to knowing your rights at arrest — clarity is now one question away.',
    color: '#22d3ee',
  },
];

const MISSION_PILLARS = [
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4l3 3"/>
      </svg>
    ),
    title: 'Accessibility',
    body: 'Every citizen — regardless of education, income, or language — deserves to understand the law that governs them. We make legal clarity free and instant.',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Accuracy',
    body: 'We cite the actual statute. Every answer is grounded in verified Indian law — the exact BNS 2023 and IPC 1860 sections — not internet opinions or outdated summaries.',
    color: '#D4A017',
    bg: 'rgba(212,160,23,0.1)',
  },
  {
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Empowerment',
    body: "Knowledge is power. When a citizen knows their rights, they can protect themselves, hold institutions accountable, and participate meaningfully in India's democracy.",
    color: '#22d3ee',
    bg: 'rgba(34,211,238,0.1)',
  },
];

const DIFFERENTIATORS = [
  {
    title: 'BNS 2023 Ready',
    body: 'Built from day one for the Bharatiya Nyaya Sanhita — not retrofitted. We cover the new criminal law framework the moment it went live.',
    icon: '⚖',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.1)',
  },
  {
    title: '7 Indian Languages',
    body: 'Ask in Hindi, reply in Tamil. Or Kannada. Or Malayalam. Legal access shouldn\'t be gated behind English fluency.',
    icon: '🗣',
    color: '#D4A017',
    bg: 'rgba(212,160,23,0.1)',
  },
  {
    title: 'Cites the Source',
    body: 'Every answer references the exact section. You can verify, share, and build on what Vidhan.ai tells you.',
    icon: '📋',
    color: '#22d3ee',
    bg: 'rgba(34,211,238,0.1)',
  },
  {
    title: 'Visual Case Breakdown',
    body: "Don't just read — watch legal scenarios unfold step by step. Theft, assault, fraud — see how the law is applied at each stage.",
    icon: '🎬',
    color: '#f472b6',
    bg: 'rgba(244,114,182,0.1)',
  },
  {
    title: 'Educational, Not Just Lookup',
    body: 'Quiz mode, AI Tutor, Comic Story — we believe you retain law better when you learn it interactively.',
    icon: '📚',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.1)',
  },
  {
    title: 'Old Law vs New Law',
    body: 'Compare IPC 1860 with BNS 2023 side by side. Understand exactly what changed, why it changed, and what it means for you.',
    icon: '🔄',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.1)',
  },
];

const STATS = [
  { value: '10,000+', label: 'Students & Citizens' },
  { value: '500+',    label: 'Laws & Sections'      },
  { value: '7',       label: 'Indian Languages'     },
  { value: '98%',     label: 'Answer Accuracy'      },
];

/* ─────────────────── sub-components ─────────────────── */

function DifferentiatorCard({ item, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      className="about-diff-card"
      style={{ '--diff-color': item.color, '--diff-bg': item.bg }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.55, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -8, transition: { duration: 0.25, ease: 'easeOut' } }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <motion.div
        className="about-diff-icon"
        animate={{ scale: hovered ? 1.12 : 1, rotate: hovered ? 5 : 0 }}
        transition={{ duration: 0.22 }}
      >
        {item.icon}
      </motion.div>
      <h3 className="about-diff-title">{item.title}</h3>
      <p className="about-diff-body">{item.body}</p>

      {/* animated bottom border on hover */}
      <motion.div
        className="about-diff-bar"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: hovered ? 1 : 0 }}
        transition={{ duration: 0.28 }}
      />
    </motion.div>
  );
}

function MissionCard({ pillar, index }) {
  return (
    <motion.div
      className="about-mission-card"
      style={{ '--mc-color': pillar.color, '--mc-bg': pillar.bg }}
      variants={staggerChild}
      whileHover={{ y: -6, boxShadow: `0 16px 48px ${pillar.color}22` }}
      transition={{ duration: 0.22 }}
    >
      <div className="about-mission-icon">{pillar.icon}</div>
      <h3 className="about-mission-title">{pillar.title}</h3>
      <p className="about-mission-body">{pillar.body}</p>
    </motion.div>
  );
}

/* ─────────────────── page ─────────────────── */
export default function About() {
  return (
    <div className="about-root">
      <Navbar />

      <main>
        {/* ══════════ HERO ══════════ */}
        <section className="about-hero">
          <div className="about-hero-orb about-hero-orb-1" aria-hidden="true" />
          <div className="about-hero-orb about-hero-orb-2" aria-hidden="true" />

          <div className="about-hero-inner">
            <motion.div className="about-eyebrow" {...fadeUp(0)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              About Vidhan.ai
            </motion.div>

            <motion.h1 className="about-hero-title" {...fadeUp(0.08)}>
              Built for every Indian who<br />
              <span className="about-hero-accent">deserves to know the law</span>
            </motion.h1>

            <motion.p className="about-hero-sub" {...fadeUp(0.18)}>
              Vidhan.ai is India's first AI-powered legal intelligence platform — built specifically for
              BNS 2023 and IPC 1860, available in 7 Indian languages, free to start.
            </motion.p>

            <motion.div className="about-stats-row" {...fadeUp(0.28)}>
              {STATS.map((s) => (
                <div key={s.label} className="about-stat">
                  <span className="about-stat-val">{s.value}</span>
                  <span className="about-stat-lbl">{s.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══════════ OUR STORY ══════════ */}
        <section className="about-story-section">
          <div className="container">
            <ScrollReveal direction="down" distance={30}>
              <div className="section-header">
                <div className="section-label">Our Story</div>
                <h2 className="section-title">
                  Why we built <span className="gradient-text">Vidhan.ai</span>
                </h2>
              </div>
            </ScrollReveal>

            <div className="about-timeline">
              {STORY_TIMELINE.map((item, i) => (
                <ScrollReveal key={item.label} direction={i % 2 === 0 ? 'left' : 'right'} distance={48} delay={i * 0.1}>
                  <motion.div
                    className="about-timeline-item"
                    style={{ '--tl-color': item.color }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="about-tl-year">{item.year}</div>
                    <div className="about-tl-content">
                      <span className="about-tl-label">{item.label}</span>
                      <h3 className="about-tl-heading">{item.heading}</h3>
                      <p className="about-tl-body">{item.body}</p>
                    </div>
                    <div className="about-tl-dot" aria-hidden="true" />
                  </motion.div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ OUR MISSION ══════════ */}
        <section className="about-mission-section">
          <div className="container">
            <ScrollReveal direction="down" distance={30}>
              <div className="section-header">
                <div className="section-label">Our Mission</div>
                <h2 className="section-title">
                  Three pillars of <span className="gradient-text">everything we do</span>
                </h2>
                <p className="section-subtitle">
                  Every feature, every word, every decision at Vidhan.ai is guided by three core principles.
                </p>
              </div>
            </ScrollReveal>

            <motion.div
              className="about-mission-grid"
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
            >
              {MISSION_PILLARS.map((pillar, i) => (
                <MissionCard key={pillar.title} pillar={pillar} index={i} />
              ))}
            </motion.div>
          </div>
        </section>

        {/* ══════════ WHY VIDHAN.AI ══════════ */}
        <section className="about-why-section">
          <div className="container">
            <ScrollReveal direction="down" distance={30}>
              <div className="section-header">
                <div className="section-label">Why Vidhan.ai</div>
                <h2 className="section-title">
                  Not just another <span className="gradient-text">AI chatbot</span>
                </h2>
                <p className="section-subtitle">
                  Generic AI tools hallucinate legal facts. We were built specifically for Indian law — accuracy is non-negotiable.
                </p>
              </div>
            </ScrollReveal>

            <div className="about-why-content">
              <ScrollReveal direction="left" distance={48}>
                <div className="about-why-list">
                  {[
                    { title: 'Indian-law-first AI', desc: 'Built around BNS 2023 and IPC 1860 — India\'s criminal codes, not generic world law.' },
                    { title: 'Cites the actual section', desc: 'Every answer includes the exact BNS/IPC section so you can verify independently.' },
                    { title: 'Explains, not just quotes', desc: 'Plain-language breakdowns anyone can understand, not copy-pasted legalese.' },
                    { title: 'Built for citizens & students', desc: 'Whether you\'re a first-time user or a student preparing for exams, Vidhan.ai scales to your needs.' },
                    { title: 'Continuously updated', desc: 'As Indian law evolves, so does Vidhan.ai — amendments and new acts.' },
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      className="about-why-item"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.5, ease: 'easeOut' }}
                    >
                      <span className="about-why-check" aria-hidden="true">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </span>
                      <div>
                        <strong className="about-why-item-title">{item.title}</strong>
                        <p className="about-why-item-desc">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollReveal>

              <ScrollReveal direction="right" distance={48}>
                <div className="about-why-visual" aria-hidden="true">
                  <div className="about-why-card">
                    <div className="about-why-card-header">
                      <span className="about-why-card-dot" />
                      <span className="about-why-card-label">Ask AI — Live Demo</span>
                    </div>
                    <div className="about-why-card-msg about-why-card-msg--user">
                      What is the punishment for theft, and how did it change from IPC to BNS?
                    </div>
                    <div className="about-why-card-msg about-why-card-msg--ai">
                      Theft is <strong>BNS §303</strong> (earlier <strong>IPC §378/379</strong>):
                      <ul className="about-why-card-list">
                        <li>Dishonestly taking movable property without consent</li>
                        <li>Punishment: up to 3 years imprisonment, or fine, or both</li>
                        <li>BNS adds community service for petty first-time theft</li>
                      </ul>
                      Use the Compare tool to see the old IPC section beside the new BNS one.
                    </div>
                    <div className="about-why-card-input">
                      Ask about any BNS or IPC section...
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ══════════ WHAT MAKES IT DIFFERENT ══════════ */}
        <section className="about-diff-section">
          <div className="container">
            <ScrollReveal direction="down" distance={30}>
              <div className="section-header">
                <div className="section-label">What Makes It Different</div>
                <h2 className="section-title">
                  Six features, <span className="gradient-text">one platform</span>
                </h2>
                <p className="section-subtitle">
                  Hover any card to see what sets Vidhan.ai apart from every other legal tool in India.
                </p>
              </div>
            </ScrollReveal>

            <div className="about-diff-grid">
              {DIFFERENTIATORS.map((item, i) => (
                <DifferentiatorCard key={item.title} item={item} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ══════════ DISCLAIMER ══════════ */}
        <section className="about-disclaimer-section">
          <div className="container">
            <ScrollReveal direction="up" distance={40}>
              <motion.div
                className="about-disclaimer-card"
                whileHover={{ borderColor: 'rgba(212,160,23,0.4)' }}
                transition={{ duration: 0.2 }}
              >
                <div className="about-disclaimer-header">
                  <div className="about-disclaimer-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <h2 className="about-disclaimer-title">Legal Disclaimer</h2>
                </div>
                <div className="about-disclaimer-body">
                  <p>
                    Vidhan.ai is an <strong>educational and informational platform</strong>. The content provided —
                    including AI-generated answers, law summaries, case breakdowns, and comparisons — is intended
                    solely for general awareness and legal literacy.
                  </p>
                  <p>
                    <strong>Vidhan.ai is not a law firm</strong> and does not provide legal advice, legal opinions,
                    or legal representation. Nothing on this platform constitutes or should be construed as
                    professional legal counsel.
                  </p>
                  <p>
                    For any specific legal matter — including criminal proceedings, civil disputes, contractual
                    obligations, or any situation where your rights or liabilities are at stake — you should
                    consult a <strong>qualified and licensed advocate</strong> registered with the Bar Council of India.
                  </p>
                  <p>
                    While we strive for accuracy, Indian law is complex and constantly evolving. Vidhan.ai makes no
                    warranties regarding the completeness, currency, or applicability of any information to your
                    specific circumstances. Use this platform to learn and be informed — not as a substitute for
                    professional legal guidance.
                  </p>
                </div>
                <div className="about-disclaimer-footer">
                  <Link to="/ask-ai" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Ask a Legal Question
                  </Link>
                </div>
              </motion.div>
            </ScrollReveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
