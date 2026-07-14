/**
 * VidhanHome — Landing page
 * PERF-H2: Below-fold heavy components are lazy-loaded.
 * Only HeroSection + Navbar render on first paint.
 * Dashboard, AIChatInterface, CaseVisualization, LawComparison
 * load lazily as separate chunks when user scrolls.
 */
import React, { Suspense, lazy, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import Footer from '../components/Footer';
import ScrollReveal from '../components/ScrollReveal';
import TestimonialStack from '../components/TestimonialStack';
import './VidhanHome.css';

const CaseVisualization = lazy(() => import('../components/CaseVisualization'));
const LawComparison    = lazy(() => import('../components/LawComparison'));

/* ── Below-fold section skeleton ── */
function SectionSkeleton({ height = '400px' }) {
  return (
    <div style={{
      height,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s infinite',
    }} aria-hidden="true" />
  );
}

/* ── Lazy section wrapper — only loads when near viewport ── */
function LazySection({ children, height = '400px' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // start loading 200px before viewport
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? (
        <Suspense fallback={<SectionSkeleton height={height} />}>
          <ScrollReveal direction="up" distance={60}>
            {children}
          </ScrollReveal>
        </Suspense>
      ) : (
        <SectionSkeleton height={height} />
      )}
    </div>
  );
}

/* ── Features overview — the 5 core tools, each linking to its page ── */
const FEATURES_OV = [
  {
    to: '/ask-ai',
    iconColor: '#818cf8', iconBg: 'rgba(99,102,241,0.15)',
    title: 'Ask AI',
    desc: 'Get instant AI-powered answers to your legal questions grounded in Indian statutes, judgments, and procedures.',
    renderIcon: () => <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
  },
  {
    to: '/comic',
    iconColor: '#fb923c', iconBg: 'rgba(249,115,22,0.15)',
    title: 'Comic Story',
    desc: 'Understand complex Indian laws through visual storytelling and illustrated real-life case scenarios.',
    renderIcon: () => (
      <>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
        <line x1="10" y1="7" x2="16" y2="7"/>
        <line x1="10" y1="11" x2="14" y2="11"/>
      </>
    ),
  },
  {
    to: '/tutor',
    iconColor: '#34d399', iconBg: 'rgba(16,185,129,0.15)',
    title: 'Tutor',
    desc: 'Learn Indian law interactively with a personal AI law tutor that explains concepts at your own pace.',
    renderIcon: () => (
      <>
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </>
    ),
  },
  {
    to: '/compare',
    iconColor: '#22d3ee', iconBg: 'rgba(6,182,212,0.15)',
    title: 'Compare',
    desc: 'Compare IPC vs BNS and other Indian laws side by side to clearly understand what changed and why.',
    renderIcon: () => (
      <>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </>
    ),
  },
  {
    to: '/quiz',
    iconColor: '#facc15', iconBg: 'rgba(234,179,8,0.15)',
    title: 'Quiz',
    desc: 'Test your legal knowledge with interactive quizzes on BNS 2023 and IPC 1860 sections.',
    renderIcon: () => (
      <>
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </>
    ),
  },
];

/* ── How It Works — 3-step explainer ── */
const HOW_STEPS = [
  {
    step: '01',
    accent: '#6366f1',
    accentRgb: '99, 102, 241',
    title: 'Ask in Plain Language',
    desc: 'Type or speak your legal question in English or your regional language. No jargon required — just describe your situation naturally.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    ),
  },
  {
    step: '02',
    accent: '#D4A017',
    accentRgb: '212, 160, 23',
    title: 'AI Decodes the Law',
    desc: 'Vidhan.ai searches every BNS 2023 and IPC 1860 section instantly — surfacing the exact section, its punishment, and how the old and new law compare.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/>
        <path d="M5 3 5.9 5.6 8.5 6.5 5.9 7.4 5 10l-.9-2.6L1.5 6.5l2.6-.9Z"/>
        <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>
      </svg>
    ),
  },
  {
    step: '03',
    accent: '#22d3ee',
    accentRgb: '34, 211, 238',
    title: 'Understand & Act',
    desc: 'Receive clear, simplified explanations with the relevant legal sections highlighted. Know your rights and exactly what to do next.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <polyline points="9 15 11 17 15 13"/>
      </svg>
    ),
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="hiw-section">
      <div className="container">
        <ScrollReveal direction="down" distance={30}>
          <div className="section-header">
            <div className="section-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
              How It Works
            </div>
            <h2 className="section-title">
              Legal clarity in <span className="gradient-text">three steps</span>
            </h2>
            <p className="section-subtitle">
              From question to clarity in seconds — no legal expertise required.
            </p>
          </div>
        </ScrollReveal>

        <div className="hiw-grid">
          {HOW_STEPS.map((s, i) => (
            <ScrollReveal key={s.step} direction="up" distance={48} delay={i * 0.13}>
              <article
                className="hiw-card"
                style={{ '--hiw-accent': s.accent, '--hiw-accent-rgb': s.accentRgb }}
              >
                {/* Step pill */}
                <div className="hiw-step-pill">Step {s.step}</div>

                {/* Background watermark number */}
                <span className="hiw-watermark" aria-hidden="true">{s.step}</span>

                {/* Icon */}
                <div className="hiw-icon-wrap">{s.icon}</div>

                {/* Text */}
                <h3 className="hiw-card-title">{s.title}</h3>
                <p className="hiw-card-desc">{s.desc}</p>

                {/* Bottom accent stripe — revealed on hover */}
                <div className="hiw-stripe" aria-hidden="true" />
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features overview — 5 core tools, each linking to its page ── */
function FeaturesOverview() {
  return (
    <section id="features-overview" className="fov-section">
      <div className="container">
        <ScrollReveal direction="down" distance={30}>
          <div className="section-header">
            <div className="section-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              What's Inside
            </div>
            <h2 className="section-title">
              Everything you need to <span className="gradient-text">understand Indian Law</span>
            </h2>
            <p className="section-subtitle">
              Five purpose-built tools — from AI chat to visual stories to interactive quizzes.
            </p>
          </div>
        </ScrollReveal>

        <div className="fov-grid fov-grid--3col">
          {FEATURES_OV.map((f, i) => (
            <ScrollReveal key={f.title} direction="up" distance={40} delay={i * 0.07}>
              <Link to={f.to} className="fov-card fov-card--link" style={{ '--fov-accent': f.iconColor }}>
                <div className="fov-icon" style={{ background: f.iconBg }}>
                  <svg
                    width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke={f.iconColor}
                    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {f.renderIcon()}
                  </svg>
                </div>
                <h3 className="fov-title">{f.title}</h3>
                <p className="fov-desc">{f.desc}</p>
                <span className="fov-cta" style={{ color: f.iconColor }}>
                  Open
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="m5 12 14 0m-7-7 7 7-7 7"/>
                  </svg>
                </span>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ data — Vidhan.ai website questions ── */
const HOME_FAQS = [
  {
    q: 'What is Vidhan.ai?',
    a: 'Vidhan.ai is an AI-powered platform for learning Indian criminal law. It lets you search, understand, and compare the Bharatiya Nyaya Sanhita (BNS) 2023 and the Indian Penal Code (IPC) 1860 in plain language — without needing a law degree.',
  },
  {
    q: 'Which laws does Vidhan.ai cover?',
    a: 'Vidhan.ai focuses on India\'s two core criminal codes: the Bharatiya Nyaya Sanhita (BNS) 2023 — the current law — and the Indian Penal Code (IPC) 1860, which it replaced. You can browse every section of both codes (over 900 sections in all), compare them side by side, and learn them chapter by chapter.',
  },
  {
    q: 'Is the legal information on Vidhan.ai accurate?',
    a: 'Every answer is grounded in the actual text of the BNS 2023 and IPC 1860 sections in our database, and the AI explains them in simple words. While we strive for accuracy, Vidhan.ai is an educational and research tool — it does not replace advice from a qualified advocate. Always consult a legal professional for your specific situation.',
  },
  {
    q: 'What is the difference between IPC and BNS?',
    a: 'The Indian Penal Code (IPC) 1860 was India\'s primary criminal law, enacted during British rule. The Bharatiya Nyaya Sanhita (BNS) 2023 replaced it with updated provisions, renumbered sections, added community service as a punishment, and removed colonial-era language. Vidhan.ai\'s Compare tool shows you exactly what changed between the two.',
  },
  {
    q: 'Can I ask questions in Hindi or other regional languages?',
    a: 'Yes. Vidhan.ai supports 7 Indian languages including Hindi, Tamil, Telugu, Kannada, Marathi, and Malayalam. You can ask in your language and receive answers — and even voice lessons from the AI Tutor — in the same language. Full multilingual access is included in the Pro plan.',
  },
  {
    q: 'How can I learn the law on Vidhan.ai?',
    a: 'Beyond searching sections, you can use the AI Law Tutor for voice-guided, chapter-by-chapter lessons, take quizzes to test yourself, read law comics that turn a section into a visual story, and compare IPC vs BNS side by side. Pick "Citizen" mode for plain everyday explanations or "Student" mode for legal terminology.',
  },
  {
    q: 'Is my data and conversation private?',
    a: 'Yes. Your questions and history are private to your account. We do not share or sell personal data to third parties, and all communications are encrypted in transit. You can delete your account and data at any time from your Profile page.',
  },
  {
    q: 'How is Vidhan.ai different from a regular Google search?',
    a: 'Google returns a list of links — Vidhan.ai gives you a direct answer grounded in the actual BNS/IPC section, explained in plain language. It compares old (IPC) versus new (BNS) law, cites the exact section, and can even teach you the topic by voice. It\'s a legal learning assistant, not a search engine.',
  },
];

function HomeFAQ() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <section id="faq" className="home-faq-section">
      <div className="container">
        <ScrollReveal direction="down" distance={30}>
          <div className="section-header">
            <div className="section-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              FAQ
            </div>
            <h2 className="section-title">
              Questions about <span className="gradient-text">Vidhan.ai</span>
            </h2>
            <p className="section-subtitle">
              Everything you need to know about how it works, what it covers, and how to get started.
            </p>
          </div>
        </ScrollReveal>

        <div className="home-faq-list">
          {HOME_FAQS.map((item, i) => {
            const isOpen = openIdx === i;
            return (
              <ScrollReveal key={item.q} direction="up" distance={24} delay={i * 0.04}>
                <div className={`home-faq-item${isOpen ? ' home-faq-item--open' : ''}`}>
                  <button
                    className="home-faq-q"
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span className="home-faq-q-text">{item.q}</span>
                    <span className="home-faq-icon" aria-hidden="true">
                      <svg
                        width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.22s ease' }}
                      >
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </span>
                  </button>
                  {isOpen && (
                    <p className="home-faq-a">{item.a}</p>
                  )}
                </div>
              </ScrollReveal>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export default function VidhanHome() {
  return (
    <div className="vidhan-root">
      <Navbar />
      <main>
        {/* HeroSection is above-fold — loads eagerly */}
        <HeroSection />

        {/* 8 feature cards — scrolled to by hero "Explore All Features" */}
        <FeaturesOverview />

        {/* How It Works — scrolled to by navbar link */}
        <HowItWorksSection />

        {/* #features anchor for Navbar "Explore" link */}
        <div id="features" />
        <LazySection height="400px">
          <CaseVisualization />
        </LazySection>

        <LazySection height="400px">
          <LawComparison />
        </LazySection>

        {/* TestimonialStack manages its own 300vh scroll — no LazySection needed */}
        <TestimonialStack />

        {/* LearnSection is lightweight — no lazy needed */}
        <LearnSection />

        {/* FAQ — website-related questions */}
        <HomeFAQ />

        {/* Final CTA banner — last element before footer */}
        <section className="final-cta-section">
          <div className="container">
            <ScrollReveal direction="up" distance={48} delay={0.1}>
              <div className="learn-cta-banner">
                <div className="learn-cta-bg" />
                <div className="learn-cta-content">
                  <div>
                    <h3 className="learn-cta-title">Ready to understand your legal rights?</h3>
                    <p className="learn-cta-sub">Ask Vidhan.ai anything. Get instant, accurate, and simplified legal guidance.</p>
                  </div>
                  <div className="learn-cta-buttons">
                    <Link to="/ask-ai" className="btn btn-primary" id="final-cta-ai">
                      Start with AI
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="m5 12 14 0m-7-7 7 7-7 7"/>
                      </svg>
                    </Link>
                    <Link to="/compare" className="btn btn-outline" id="final-cta-compare">
                      Compare Laws
                    </Link>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/* ── Guide data — rich content for each legal card ── */
const GUIDES = {
  'Know Your Rights': {
    icon: '🏛️', tag: 'Constitutional', color: '#6366f1',
    overview: 'The Indian Constitution guarantees six fundamental rights to every citizen under Articles 12–35. These rights protect your dignity, freedom, and equality before the law — and cannot be taken away by any ordinary law.',
    sections: [
      {
        icon: '⚖️', title: 'Right to Equality (Art. 14–18)',
        content: 'Every person is equal before the law regardless of caste, religion, gender, or birthplace. The State cannot discriminate in public employment. Untouchability is abolished and its practice is a criminal offence (Art. 17). Titles like "Sir" or "Rai Bahadur" conferred by the state are abolished (Art. 18).'
      },
      {
        icon: '🕊️', title: 'Right to Freedom (Art. 19–22)',
        content: 'You have the right to freedom of speech, peaceful assembly, form associations, move freely across India, reside anywhere, and practise any profession. No person can be convicted of an offence not defined by law at the time of commission (Art. 20). You cannot be arrested without being told the reason, and must be produced before a magistrate within 24 hours (Art. 22).'
      },
      {
        icon: '🚫', title: 'Right Against Exploitation (Art. 23–24)',
        content: 'Forced labour, human trafficking, and child labour (under 14 years in hazardous work) are strictly prohibited and punishable. Begging (begar) under coercion is also banned.'
      },
      {
        icon: '📿', title: 'Freedom of Religion (Art. 25–28)',
        content: 'Every person can freely profess, practise, and propagate any religion. No person can be compelled to pay taxes for promotion of a particular religion. Government educational institutions cannot provide religious instruction.'
      },
      {
        icon: '🔴', title: 'Right to Constitutional Remedies (Art. 32)',
        content: 'This is the "heart and soul" of the Constitution (Dr. Ambedkar). If any fundamental right is violated, you can directly approach the Supreme Court under Art. 32 or the High Court under Art. 226 for writs like Habeas Corpus, Mandamus, Certiorari, Prohibition, and Quo Warranto.'
      },
    ],
    keyPoints: [
      'Fundamental Rights apply to all citizens; some also to non-citizens',
      'Rights can be suspended during a National Emergency (Art. 352)',
      'Directive Principles (Art. 36–51) guide state policy but are not enforceable',
      'Supreme Court can issue writs to enforce fundamental rights',
    ],
    helplines: [{ icon: '⚖️', label: 'National Human Rights Commission', number: '14433' }, { icon: '🆓', label: 'National Legal Aid (NALSA)', number: '15100' }],
    quickTips: ['Keep a copy of your Aadhaar/Voter ID when traveling', 'Know Art. 22: demand written grounds for any detention', 'Free legal aid is your right — call NALSA 15100'],
  },

  'Rights When Arrested': {
    icon: '👮', tag: 'Criminal', color: '#ef4444',
    overview: 'If you are ever arrested, knowing your rights under the Code of Criminal Procedure (CrPC) and the Constitution can protect you from illegal detention, torture, or coerced confessions.',
    sections: [
      {
        icon: '📋', title: 'Right to Know the Reason (Art. 22 / S.50 CrPC)',
        content: 'Police MUST tell you, in a language you understand, the grounds for your arrest. An arrest without reason stated is illegal. You also have the right to inspect the arrest warrant. Under S.50A CrPC, police must inform a nominated person about your arrest.'
      },
      {
        icon: '🔕', title: 'Right to Remain Silent (Art. 20(3))',
        content: 'No person accused of an offence can be compelled to be a witness against themselves — this is the constitutional right against self-incrimination. Any confession obtained by force, threat, or promise is NOT admissible in court (S.24 Indian Evidence Act).'
      },
      {
        icon: '⏱️', title: '24-Hour Rule (Art. 22 / S.57 CrPC)',
        content: 'Police cannot keep you in custody for more than 24 hours without producing you before the nearest Magistrate. The 24 hours excludes travel time. After this, only a Magistrate can authorise further detention (judicial remand).'
      },
      {
        icon: '👨‍⚖️', title: 'Right to Legal Aid (Art. 39A / S.304 CrPC)',
        content: 'If you cannot afford a lawyer, the State must provide one free of cost. This applies from the moment of arrest. Ask the police immediately: "I need a lawyer." They cannot deny this. Contact NALSA at 15100 for free legal aid.'
      },
      {
        icon: '🏥', title: 'Right to Medical Examination (S.54 CrPC)',
        content: 'An arrested person has the right to be medically examined at the time of arrest to document any pre-existing injuries. This protects against false allegations of injuries caused in custody. Ask for this examination proactively.'
      },
      {
        icon: '📞', title: 'Right to Inform Family',
        content: 'Immediately upon arrest, police must allow you to inform a family member or friend. Under the D.K. Basu Guidelines (SC 1997), your arrest must be documented in the "Arrest Memo" signed by a family member or witness. Police cannot secretly detain you.'
      },
    ],
    keyPoints: [
      'Memorise D.K. Basu Guidelines — police must follow them during arrest',
      'Bail is your right for bailable offences — police cannot refuse',
      'FIR must be registered for cognizable offences — refusal is an offence',
      'A Magistrate can order release on bail even for non-bailable offences',
      'Custodial torture is a criminal offence — file complaint with NHRC',
    ],
    helplines: [{ icon: '🚨', label: 'Police Emergency', number: '112' }, { icon: '⚖️', label: 'NHRC (Rights Commission)', number: '14433' }, { icon: '🆓', label: 'Free Legal Aid NALSA', number: '15100' }],
    quickTips: ['Never sign a blank paper in police custody', 'Ask for a lawyer before making any statement', 'Demand to see the FIR — it is your legal right (S.207 CrPC)', 'Document every injury — ask for medical check at arrest'],
  },

  'Tenant & Landlord Laws': {
    icon: '🏠', tag: 'Civil', color: '#f59e0b',
    overview: 'Renting a property in India is governed by state-specific Rent Control Acts and the Transfer of Property Act 1882. Understanding your rights prevents illegal eviction, unfair rent hikes, and deposit disputes.',
    sections: [
      {
        icon: '📄', title: 'Rental Agreement — What You Must Have',
        content: 'Any tenancy above 11 months must be registered (under Registration Act 1908) to be legally enforceable. Your agreement must clearly state: monthly rent, security deposit amount, notice period, maintenance responsibilities, and renewal terms. Oral agreements are valid but hard to prove — always get it in writing.'
      },
      {
        icon: '💰', title: 'Security Deposit Rules',
        content: 'Most state laws cap security deposits at 2–3 months rent. In Karnataka (Rent Act 1999) it is 10 months; in Tamil Nadu it can be up to 10 months. The landlord MUST return the deposit within 30 days of vacating (minus legitimate deductions for damage). Deductions for normal wear and tear are NOT allowed. If landlord refuses, file with Rent Court.'
      },
      {
        icon: '🚪', title: 'Eviction — When It Is Legal',
        content: 'Under most Rent Control Acts, a landlord can evict a tenant only for: (1) non-payment of rent for 2+ months, (2) subletting without permission, (3) misuse of property, (4) genuine self-occupation need. Eviction requires a court order — landlords CANNOT forcibly evict you, cut electricity/water, or remove your belongings. Self-help eviction is a criminal offence.'
      },
      {
        icon: '📈', title: 'Rent Increase Restrictions',
        content: 'Under Rent Control Acts, rent can only be increased as per the Act (typically 4–10% per year). Any sudden doubling or tripling of rent is illegal. Even if the agreement allows it, the Act prevails. For properties outside Rent Control jurisdiction (luxury flats), the agreement governs — negotiate before signing.'
      },
      {
        icon: '🔧', title: 'Maintenance & Repairs',
        content: 'The landlord is responsible for structural repairs, plumbing, electrical wiring in walls, and waterproofing. Tenants are responsible for minor day-to-day maintenance (light bulbs, tap washers). Always send repair requests in writing (WhatsApp/email counts as evidence). If landlord ignores, you may withhold rent and deduct repair costs in many states.'
      },
    ],
    keyPoints: [
      'Register any tenancy exceeding 11 months to make it legally enforceable',
      'No landlord can evict without a court order — forcible eviction is a crime',
      'Photograph the property before moving in (dated) to prove pre-existing damage',
      'Security deposit receipt is mandatory — insist on it',
      'RERA protects flat buyers; Consumer Forum can hear landlord-tenant disputes',
    ],
    helplines: [{ icon: '⚖️', label: 'Consumer Helpline', number: '1800-11-4000' }, { icon: '🏠', label: 'RERA Helpline', number: '1800-11-8588' }],
    quickTips: ['Always get a written receipt for rent payments', 'Give notice in writing (registered post + WhatsApp) when vacating', 'Check if your city has a Rent Control Act before signing', 'Keep copies of all repair requests and landlord responses'],
  },

  'Consumer Protection': {
    icon: '💼', tag: 'Consumer', color: '#22c55e',
    overview: 'The Consumer Protection Act 2019 gives you powerful rights against defective products, deficient services, unfair trade practices, and misleading advertisements. Compensation claims can be filed for free up to ₹50 lakh at the District Commission.',
    sections: [
      {
        icon: '📋', title: 'Your 6 Consumer Rights',
        content: '(1) Right to Safety — protection from hazardous goods/services. (2) Right to Information — you must be told price, quality, and ingredients. (3) Right to Choose — no forced bundling of products. (4) Right to be Heard — right to file complaint and be heard. (5) Right to Redressal — compensation for losses. (6) Right to Consumer Education — know your rights.'
      },
      {
        icon: '🏦', title: 'Where to File a Complaint',
        content: 'District Consumer Disputes Redressal Commission (DCDRC): claims up to ₹50 lakh. State Commission: ₹50 lakh to ₹2 crore. National Commission (NCDRC): above ₹2 crore. Online: file at consumerhelpline.gov.in or edaakhil.nic.in. Filing fee is minimal (₹100–₹5000). No lawyer mandatory for amounts below ₹50 lakh.'
      },
      {
        icon: '🛒', title: 'E-Commerce & Online Shopping',
        content: 'Under Consumer Protection (E-Commerce) Rules 2020, online platforms must display seller details, return policy, grievance officer contact, and complete product info. You have the right to return defective products. If an app/website refuses refund unfairly, file at the e-Daakhil portal. Platforms are liable for their sellers\' unfair practices.'
      },
      {
        icon: '🏢', title: 'RERA — Real Estate Protection',
        content: 'Real Estate (Regulation & Development) Act 2016 protects flat/plot buyers. Builders must register projects with RERA, disclose all details, and deliver on time. For any delay or defect, you can claim compensation from the builder through the state RERA authority. Interest @ SBI PLR + 2% is payable for delays.'
      },
      {
        icon: '⚠️', title: 'Unfair Trade Practices & Misleading Ads',
        content: 'Endorsers and celebrities in misleading ads can now be held liable under the 2019 Act. False discounts (marking MRP up then offering "50% off"), fake reviews, and bait-and-switch tactics are all prohibited. You can get penalties up to ₹10 lakh on first offence, ₹50 lakh on repeat.'
      },
    ],
    keyPoints: [
      'Limitation period to file consumer complaint: 2 years from cause of action',
      'You can file online at edaakhil.nic.in from home — no court visit needed',
      'Opposite party must reply within 30 days; dispute resolved in 90–150 days',
      'Product liability: manufacturer is strictly liable for defective products',
      'Service deficiency includes banking, insurance, telecom, hospitals, education',
    ],
    helplines: [{ icon: '📞', label: 'National Consumer Helpline', number: '1800-11-4000' }, { icon: '🌐', label: 'Online Filing', number: 'edaakhil.nic.in' }],
    quickTips: ['Keep all receipts, bills, and chat records as evidence', 'Send legal notice to company before filing — often resolves faster', 'You can claim mental agony and legal costs too', 'Check if seller is RERA/ISO certified before buying property'],
  },

  "Women's Legal Rights": {
    icon: '👩‍⚖️', tag: 'Protection', color: '#ec4899',
    overview: 'Indian law provides strong protection for women against domestic violence, dowry harassment, workplace sexual harassment, and crimes against children. Several dedicated helplines and fast-track courts ensure speedy justice.',
    sections: [
      {
        icon: '🏠', title: 'Domestic Violence — PWDVA 2005',
        content: 'The Protection of Women from Domestic Violence Act 2005 covers physical, emotional, verbal, sexual, and economic abuse within any shared household (including live-in relationships). You can approach a Protection Officer (PO) or directly file in Magistrate Court. Relief includes: Protection Orders (stopping abuser from contacting you), Residence Orders (right to stay in the shared home), and Monetary Relief. No police case required to apply.'
      },
      {
        icon: '💍', title: 'Dowry Harassment — S.498A IPC / Dowry Prohibition Act',
        content: 'Demanding, giving, or taking dowry is a criminal offence under the Dowry Prohibition Act 1961 (up to 5 years + fine). If a woman is harassed for dowry by her husband or in-laws, S.498A IPC applies — punishment up to 3 years imprisonment. In cases of suspicious death within 7 years of marriage, S.304B IPC (Dowry Death) applies with minimum 7 years imprisonment. File FIR immediately at the nearest police station.'
      },
      {
        icon: '👔', title: 'Workplace Sexual Harassment — POSH Act 2013',
        content: 'Every workplace with 10+ employees must have an Internal Complaints Committee (ICC). Harassment includes unwanted advances, demands for sexual favours, showing pornographic material, or any physical conduct of a sexual nature. Complaint must be filed within 3 months of incident. ICC must complete inquiry in 90 days. If employer does not have ICC, file with the Local Complaints Committee (LCC) at district level.'
      },
      {
        icon: '👦', title: 'Child Protection — POCSO Act 2012',
        content: 'The Protection of Children from Sexual Offences Act 2012 protects children under 18. Any sexual assault, harassment, or pornography involving a child is a stringent offence with minimum 10 years to life imprisonment. Reporting is mandatory — even a doctor or teacher who fails to report is guilty. All cases go to designated Special Courts for speedy trial.'
      },
      {
        icon: '⚡', title: 'Fast Track Courts & Special Laws',
        content: 'India has over 1,000 Fast Track Special Courts for cases of rape and POCSO. Rape trials must be completed within 2 months (Nirbhaya Fund 2013 amendment). Section 376 IPC (rape) now carries minimum 10 years to life. Acid attack cases (S.326A) carry minimum 10 years. Emergency response: dial 112 for immediate police help.'
      },
    ],
    keyPoints: [
      'Any woman facing domestic violence can call 181 (Women Helpline) 24×7',
      'Police must register FIR for cognizable offences — refusal is itself an offence',
      'You do not need to leave home — Protection Order keeps abuser away',
      'Free legal aid for women is available at every District Legal Aid Authority',
      'Medical examination after assault must be done by a female doctor (S.164A CrPC)',
    ],
    helplines: [{ icon: '👩', label: 'Women Helpline (24×7)', number: '181' }, { icon: '🚨', label: 'Emergency Police', number: '112' }, { icon: '👶', label: 'Childline (POCSO)', number: '1098' }, { icon: '⚖️', label: 'Free Legal Aid', number: '15100' }],
    quickTips: ['Save domestic violence evidence: photos, medical reports, screenshots', 'ICC complaint is confidential — employer cannot fire you for filing', 'One call to 181 connects you to police, shelter, and legal help', 'A Protection Order can be obtained within 3 days in urgent cases'],
  },

  'Cyber Crime Laws': {
    icon: '📱', tag: 'Technology', color: '#06b6d4',
    overview: 'The Information Technology Act 2000 (amended 2008) along with IPC provisions governs cybercrime in India. From online fraud to cyberbullying, there are specific laws and a dedicated National Cyber Crime Reporting Portal.',
    sections: [
      {
        icon: '💻', title: 'IT Act 2000 — Key Offences & Penalties',
        content: 'S.66 — Hacking/computer damage: up to 3 years + ₹5 lakh fine. S.66C — Identity theft (using someone\'s password/digital signature): up to 3 years + ₹1 lakh. S.66D — Cheating by impersonation online: up to 3 years + ₹1 lakh. S.66E — Violation of privacy (recording/publishing private images without consent): up to 3 years + ₹2 lakh. S.67 — Publishing obscene material online: up to 5 years + ₹10 lakh.'
      },
      {
        icon: '🔐', title: 'Online Fraud & Financial Scams',
        content: 'UPI fraud, phishing, fake KYC calls, and vishing (voice phishing) are covered under S.66C/D IT Act + S.420 IPC (cheating). If money is transferred fraudulently: (1) Call your bank immediately to freeze transaction; (2) Report at cybercrime.gov.in or call 1930 within 24 hours — golden window for fund recovery; (3) File FIR at cyber cell. Never share OTP, CVV, or PIN with anyone.'
      },
      {
        icon: '😡', title: 'Cyberbullying & Online Harassment',
        content: 'Sending threatening, obscene, or offensive messages online is an offence under S.66A (struck down but IPC applies) and S.507 IPC (criminal intimidation). Morphing someone\'s photo and posting it — S.66C/E IT Act + S.509 IPC. Stalking through social media/apps — S.354D IPC (up to 3 years). Defamation online — S.499/500 IPC + S.66A principles.'
      },
      {
        icon: '🔞', title: 'Cybercrime Against Women & Children',
        content: 'Under POCSO + S.67B IT Act: viewing, downloading, or sharing child pornography carries minimum 5 years to 7 years imprisonment. Sextortion (threatening to share intimate images) — S.66E IT Act + S.354A/C IPC. "Revenge porn" — S.67A IT Act (up to 7 years). Report all such material immediately at cybercrime.gov.in — CERT-In can take down the content.'
      },
      {
        icon: '🛡️', title: 'Data Protection & Privacy',
        content: 'The Digital Personal Data Protection Act 2023 (DPDPA) gives you the right to know what data is collected, right to correction, right to erasure ("right to be forgotten"), and right to nominate someone for data management after death. Companies collecting your data must have consent and a Privacy Notice. File complaint with Data Protection Board for violations.'
      },
    ],
    keyPoints: [
      'Report cybercrime within 24 hours at cybercrime.gov.in or call 1930 for money recovery',
      'Screenshot and preserve all evidence before reporting or blocking',
      'Banks can freeze fraudulent transactions if reported within the golden hour',
      'CERT-In (cert-in.org.in) can help take down illegal content within 6 hours',
      'VPN use is legal in India; using it for cybercrime is still an offence',
    ],
    helplines: [{ icon: '💻', label: 'Cyber Crime Helpline', number: '1930' }, { icon: '🌐', label: 'Online Report', number: 'cybercrime.gov.in' }, { icon: '🚨', label: 'Emergency', number: '112' }],
    quickTips: ['Never share OTP, PIN, or CVV with anyone — banks never ask', 'Lock your Aadhaar biometrics at uidai.gov.in when not in use', 'Use 2-factor authentication on all accounts', 'Report lost/stolen SIM immediately to prevent SIM-swap fraud'],
  },
};

/* ── Guide Modal ── */
function GuideModal({ guide, data, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handleKey); };
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        className="guide-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="guide-modal"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="guide-modal-header" style={{ borderBottom: `3px solid ${data.color}` }}>
            <div className="guide-modal-icon" style={{ background: `${data.color}18`, border: `1px solid ${data.color}33` }}>
              {data.icon}
            </div>
            <div className="guide-modal-header-text">
              <span className="guide-modal-tag" style={{ color: data.color, background: `${data.color}18`, border: `1px solid ${data.color}33` }}>
                {data.tag}
              </span>
              <h2 className="guide-modal-title">{guide}</h2>
            </div>
            <button className="guide-modal-close" onClick={onClose}>✕</button>
          </div>

          {/* Scrollable body */}
          <div className="guide-modal-body">
            {/* Overview */}
            <p className="guide-overview">{data.overview}</p>

            {/* Key points */}
            <div className="guide-key-points">
              <h3 className="guide-section-label">📌 Key Points to Remember</h3>
              <ul className="guide-key-list">
                {data.keyPoints.map((pt, i) => (
                  <li key={i} className="guide-key-item">
                    <span className="guide-key-dot" style={{ background: data.color }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>

            {/* Detailed sections */}
            <h3 className="guide-section-label" style={{ marginTop: 28 }}>📖 Detailed Guide</h3>
            <div className="guide-sections">
              {data.sections.map((sec, i) => (
                <details key={i} className="guide-detail" open={i === 0}>
                  <summary className="guide-detail-summary">
                    <span className="guide-detail-icon">{sec.icon}</span>
                    <span className="guide-detail-title">{sec.title}</span>
                    <span className="guide-detail-arrow">›</span>
                  </summary>
                  <p className="guide-detail-content">{sec.content}</p>
                </details>
              ))}
            </div>

            {/* Quick tips */}
            <div className="guide-tips-section">
              <h3 className="guide-section-label">💡 Quick Tips</h3>
              <div className="guide-tips-grid">
                {data.quickTips.map((tip, i) => (
                  <div key={i} className="guide-tip-chip">
                    <span style={{ color: data.color, fontWeight: 700, marginRight: 4 }}>→</span> {tip}
                  </div>
                ))}
              </div>
            </div>

            {/* Helplines */}
            <div className="guide-helplines">
              <h3 className="guide-section-label">📞 Helplines</h3>
              <div className="guide-helpline-row">
                {data.helplines.map((h, i) => (
                  <div key={i} className="guide-helpline-card" style={{ borderColor: `${data.color}33` }}>
                    <span className="guide-helpline-icon">{h.icon}</span>
                    <div>
                      <div className="guide-helpline-label">{h.label}</div>
                      <div className="guide-helpline-number" style={{ color: data.color }}>{h.number}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Inline Learn Section ── */
function LearnSection() {
  const [openGuide, setOpenGuide] = useState(null);
  const closeGuide = useCallback(() => setOpenGuide(null), []);

  // PERF-M2: memoized so array is stable across renders
  const cards = useMemo(() => [
    {
      icon: '🏛️',
      title: 'Know Your Rights',
      desc: 'Learn your fundamental rights guaranteed by the Indian Constitution and when they can be invoked.',
      tag: 'Constitutional',
      color: '#6366f1',
    },
    {
      icon: '👮',
      title: 'Rights When Arrested',
      desc: 'Understand what police can and cannot do, your right to remain silent, and bail procedures under CrPC.',
      tag: 'Criminal',
      color: '#ef4444',
    },
    {
      icon: '🏠',
      title: 'Tenant & Landlord Laws',
      desc: 'Know the Rent Control Act, eviction rules, security deposit regulations and tenant protections.',
      tag: 'Civil',
      color: '#f59e0b',
    },
    {
      icon: '💼',
      title: 'Consumer Protection',
      desc: 'File complaints under the Consumer Protection Act 2019, understand RERA and e-commerce rules.',
      tag: 'Consumer',
      color: '#22c55e',
    },
    {
      icon: '👩‍⚖️',
      title: "Women's Legal Rights",
      desc: 'Protection laws including Domestic Violence Act, dowry prohibition, POCSO, and workplace safety.',
      tag: 'Protection',
      color: '#ec4899',
    },
    {
      icon: '📱',
      title: 'Cyber Crime Laws',
      desc: 'IT Act 2000, cyberbullying, data theft, online fraud and how to file a cybercrime complaint.',
      tag: 'Technology',
      color: '#06b6d4',
    },
  ], []);

  return (
    <section id="learn" className="section learn-section">
      <div className="bg-orb bg-orb-blue" style={{width:400,height:400,bottom:'10%',left:'-8%',opacity:0.09}}/>
      <div className="container">
        <ScrollReveal direction="down" distance={40}>
          <div className="section-header">
            <div className="section-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              Legal Education
            </div>
            <h2 className="section-title">Learn the <span className="gradient-text">Law That Protects You</span></h2>
            <p className="section-subtitle">Beginner-friendly guides on laws that affect everyday life in India. No legal degree required.</p>
          </div>
        </ScrollReveal>

        <div className="learn-grid">
          {cards.map((c, i) => (
            <ScrollReveal key={c.title} direction="up" distance={50} delay={i * 0.1}>
              <div
                className="learn-card"
                id={`learn-card-${i}`}
                style={{ '--learn-color': c.color, cursor: 'pointer' }}
                onClick={() => setOpenGuide(c.title)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setOpenGuide(c.title)}
              >
                <div className="learn-card-top">
                  <span className="learn-card-emoji">{c.icon}</span>
                  <span className="learn-card-tag" style={{ color: c.color, background: `${c.color}18`, border: `1px solid ${c.color}33` }}>
                    {c.tag}
                  </span>
                </div>
                <h3 className="learn-card-title">{c.title}</h3>
                <p className="learn-card-desc">{c.desc}</p>
                <button className="learn-card-cta" style={{ color: c.color }} onClick={e => { e.stopPropagation(); setOpenGuide(c.title); }}>
                  Read Guide
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
                </button>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Guide modal */}
        {openGuide && GUIDES[openGuide] && (
          <GuideModal guide={openGuide} data={GUIDES[openGuide]} onClose={closeGuide} />
        )}

      </div>
    </section>
  );
}
