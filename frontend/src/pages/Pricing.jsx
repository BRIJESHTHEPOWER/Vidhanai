import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SubscribeButton from '../components/SubscribeButton';
import './Pricing.css';

/* ── Check and X icons ── */
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

/* ── Plan definitions ── */
const PLANS = [
  {
    key: 'free',
    name: 'Free',
    desc: 'Start exploring Indian law at no cost.',
    monthly: 0,
    annualPerMonth: 0,
    annualTotal: 0,
    badge: null,
    accentClass: 'pricing-card--free',
    ctaClass: 'pricing-cta--ghost',
    cta: 'Get Started Free',
    ctaTo: '/signup',
    features: [
      { text: '5 AI legal questions per day',        on: true  },
      { text: 'BNS & IPC section search',            on: true  },
      { text: 'IPC ↔ BNS Law Comparison',            on: true  },
      { text: 'Know Your Rights (Legal Awareness)',  on: true  },
      { text: 'English language only',               on: true  },
      { text: 'Community support',                   on: true  },
      { text: 'Unlimited AI questions',              on: false },
      { text: 'All 7 Indian languages',              on: false },
      { text: 'Voice input',                         on: false },
      { text: 'Quiz & Learning Hub',                 on: false },
      { text: 'AI Law Tutor',                        on: false },
      { text: 'Comic Story mode',                    on: false },
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    desc: 'Full access for students & serious learners.',
    monthly: 299,
    annualPerMonth: 199,
    annualTotal: 2388,
    badge: 'Most Popular',
    accentClass: 'pricing-card--pro',
    ctaClass: 'pricing-cta--pro',
    cta: 'Start Pro',
    ctaTo: '/signup',
    features: [
      { text: 'Unlimited AI legal questions',        on: true },
      { text: 'BNS & IPC section search',            on: true },
      { text: 'IPC ↔ BNS Law Comparison',            on: true },
      { text: 'Know Your Rights (Legal Awareness)',  on: true },
      { text: 'All 7 Indian languages',              on: true },
      { text: 'Voice input (unlimited)',             on: true },
      { text: 'Quiz & Learning Hub',                 on: true },
      { text: 'AI Law Tutor',                        on: true },
      { text: 'Comic Story mode',                    on: true },
      { text: 'Priority support',                    on: true },
    ],
  },
];

/* ── Savings calc ── */
function savingsPct(monthly, annualPerMonth) {
  if (!monthly) return 0;
  return Math.round(((monthly - annualPerMonth) / monthly) * 100);
}

/* ── FAQ data ── */
const FAQS = [
  {
    q: 'Can I upgrade or downgrade my plan anytime?',
    a: 'Yes. You can switch plans at any time. Upgrades take effect immediately; downgrades apply at the next billing cycle.',
  },
  {
    q: 'Is my payment information secure?',
    a: 'Absolutely. Payments are processed via Razorpay with end-to-end encryption. We never store card details on our servers.',
  },
  {
    q: 'What happens when I reach the Free plan limit?',
    a: 'After 5 questions per day on the Free plan, you can still browse BNS/IPC sections. Upgrade to Pro for unlimited questions.',
  },
  {
    q: 'Do you offer a student or NGO discount?',
    a: 'Yes — students and registered NGOs get 30% off the Pro plan. Email support@vidhan.ai with valid proof.',
  },
  {
    q: 'Is there a free trial for Pro?',
    a: 'Pro includes a 7-day free trial — no credit card required to start. You can also use the Free plan for as long as you like.',
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`pricing-faq-item${open ? ' pricing-faq-item--open' : ''}`}>
      <button
        className="pricing-faq-q"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>{q}</span>
        <svg
          className="pricing-faq-chevron"
          width="16" height="16" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.22s ease' }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && <p className="pricing-faq-a">{a}</p>}
    </div>
  );
}

export default function Pricing() {
  const [billing, setBilling] = useState('monthly');
  const isAnnual = billing === 'annual';

  return (
    <div className="pricing-root">
      <Navbar />

      <main className="pricing-main">

        {/* ── Hero ── */}
        <section className="pricing-hero">
          <div className="pricing-hero-orb pricing-hero-orb-1" aria-hidden="true" />
          <div className="pricing-hero-orb pricing-hero-orb-2" aria-hidden="true" />

          <div className="pricing-hero-inner">
            <div className="pricing-eyebrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Simple, Transparent Pricing
            </div>

            <h1 className="pricing-title">
              Choose your <span className="pricing-title-accent">legal edge</span>
            </h1>
            <p className="pricing-subtitle">
              Start free, scale as you grow. No hidden fees, no surprises.
            </p>

            {/* ── Billing toggle ── */}
            <div className="pricing-toggle" role="group" aria-label="Billing period">
              <button
                className={`pricing-toggle-btn${!isAnnual ? ' pricing-toggle-btn--active' : ''}`}
                onClick={() => setBilling('monthly')}
              >
                Monthly
              </button>
              <button
                className={`pricing-toggle-btn${isAnnual ? ' pricing-toggle-btn--active' : ''}`}
                onClick={() => setBilling('annual')}
              >
                Annual
                <span className="pricing-toggle-save">Save 33%</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Pricing cards ── */}
        <section className="pricing-cards-section">
          <div className="pricing-cards-grid">
            {PLANS.map((plan) => {
              const price = isAnnual ? plan.annualPerMonth : plan.monthly;
              const savings = savingsPct(plan.monthly, plan.annualPerMonth);

              return (
                <article
                  key={plan.key}
                  className={`pricing-card ${plan.accentClass}`}
                  aria-label={`${plan.name} plan`}
                >
                  {plan.badge && (
                    <div className={`pricing-badge pricing-badge--${plan.key}`}>
                      {plan.badge}
                    </div>
                  )}

                  <div className="pricing-card-header">
                    <h2 className="pricing-plan-name">{plan.name}</h2>
                    <p className="pricing-plan-desc">{plan.desc}</p>
                  </div>

                  <div className="pricing-price-block">
                    {price === 0 ? (
                      <div className="pricing-price">
                        <span className="pricing-price-sym">₹</span>
                        <span className="pricing-price-num">0</span>
                        <span className="pricing-price-period">/month</span>
                      </div>
                    ) : (
                      <>
                        <div className="pricing-price">
                          <span className="pricing-price-sym">₹</span>
                          <span className="pricing-price-num">{price}</span>
                          <span className="pricing-price-period">/mo</span>
                        </div>
                        {isAnnual ? (
                          <p className="pricing-price-note">
                            Billed ₹{plan.annualTotal.toLocaleString('en-IN')}/year
                            {savings > 0 && (
                              <span className="pricing-price-save">Save {savings}%</span>
                            )}
                          </p>
                        ) : (
                          <p className="pricing-price-note">
                            or ₹{plan.annualPerMonth}/mo billed annually
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {plan.key === 'pro' ? (
                    <SubscribeButton className={`pricing-cta ${plan.ctaClass}`} plan={billing}>
                      {plan.cta}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                        strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14m-7-7 7 7-7 7"/>
                      </svg>
                    </SubscribeButton>
                  ) : (
                    <Link to={plan.ctaTo} className={`pricing-cta ${plan.ctaClass}`}>
                      {plan.cta}
                    </Link>
                  )}

                  <div className="pricing-divider" aria-hidden="true" />

                  <ul className="pricing-features" role="list">
                    {plan.features.map((f) => (
                      <li
                        key={f.text}
                        className={`pricing-feat-item${f.on ? '' : ' pricing-feat-item--off'}`}
                      >
                        <span className={`pricing-feat-icon${f.on ? '' : ' pricing-feat-icon--off'}`}>
                          {f.on ? <CheckIcon /> : <XIcon />}
                        </span>
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          {/* Enterprise note */}
          <p className="pricing-enterprise">
            Need a custom plan for your law firm or institution?{' '}
            <Link to="/contact" className="pricing-enterprise-link">
              Contact us
            </Link>
          </p>
        </section>

        {/* ── Feature comparison strip ── */}
        <section className="pricing-compare-strip">
          <div className="pricing-compare-inner">
            {[
              { label: 'AI Questions',  free: '5 / day',   pro: 'Unlimited' },
              { label: 'Languages',     free: '1 (EN)',    pro: 'All 7'     },
              { label: 'Voice Input',   free: '—',         pro: 'Unlimited' },
              { label: 'AI Law Tutor',  free: '—',         pro: 'Included'  },
              { label: 'Quiz & Comics', free: '—',         pro: 'Included'  },
              { label: 'Support',       free: 'Community', pro: 'Priority'  },
            ].map((row, i) => (
              <div key={row.label} className={`pricing-cmp-row${i % 2 === 0 ? ' pricing-cmp-row--alt' : ''}`}>
                <span className="pricing-cmp-label">{row.label}</span>
                <span className="pricing-cmp-cell">{row.free}</span>
                <span className="pricing-cmp-cell pricing-cmp-cell--pro">{row.pro}</span>
              </div>
            ))}
            {/* Column headers */}
            <div className="pricing-cmp-header">
              <span />
              <span>Free</span>
              <span className="pricing-cmp-head--pro">Pro</span>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="pricing-faq-section">
          <div className="pricing-faq-inner">
            <div className="pricing-section-label">FAQ</div>
            <h2 className="pricing-section-title">Frequently asked questions</h2>
            <div className="pricing-faq-list">
              {FAQS.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
