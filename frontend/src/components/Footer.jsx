import React from 'react';
import './Footer.css';

const COLS = [
  {
    title: 'Product',
    links: ['Ask AI', 'Browse IPC', 'Case Library', 'Law Comparison', 'Voice Input'],
  },
  {
    title: 'Resources',
    links: ['Documentation', 'API Reference', 'IPC Handbook', 'BNS Guide', 'Case Studies'],
  },
  {
    title: 'Legal',
    links: ['Terms of Service', 'Privacy Policy', 'Cookie Policy', 'Disclaimer', 'Accessibility'],
  },
  {
    title: 'Contact',
    links: ['Help Center', 'Community', 'Report Bug', 'Partnerships', 'Press Kit'],
  },
];

const SOCIALS = [
  {
    label: 'Twitter',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
      </svg>
    ),
  },
  {
    label: 'GitHub',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
        <path d="M9 18c-4.51 2-5-2-7-2"/>
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
        <rect width="4" height="12" x="2" y="9"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="footer" id="learn">
      {/* Gradient divider */}
      <div className="footer-divider" />

      <div className="container">
        {/* Top */}
        <div className="footer-top">
          {/* Brand */}
          <div className="footer-brand">
            <div className="footer-logo">
              <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                <defs>
                  <radialGradient id="ftLogo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#22d3ee"/>
                    <stop offset="100%" stopColor="#6366f1"/>
                  </radialGradient>
                </defs>
                <circle cx="14" cy="14" r="13" fill="url(#ftLogo)" opacity="0.15"/>
                <path d="M8 20L14 8L20 20M10.5 16h7" stroke="url(#ftLogo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="14" cy="8" r="1.5" fill="#22d3ee"/>
              </svg>
              <span className="footer-logo-text">Vidhan<span className="footer-logo-ai">AI</span></span>
            </div>
            <p className="footer-tagline">
              AI-powered legal intelligence for every Indian citizen. Simplifying the law, one query at a time.
            </p>
            {/* Newsletter */}
            <div className="footer-newsletter">
              <input
                type="email"
                className="footer-newsletter-input"
                placeholder="Enter your email"
                id="footer-email"
              />
              <button className="footer-newsletter-btn" id="footer-subscribe">Subscribe</button>
            </div>
            <p className="footer-newsletter-hint">Get weekly legal updates. No spam.</p>
          </div>

          {/* Links */}
          <div className="footer-cols">
            {COLS.map(col => (
              <div key={col.title} className="footer-col">
                <h4 className="footer-col-title">{col.title}</h4>
                <ul className="footer-col-links">
                  {col.links.map(link => (
                    <li key={link}>
                      <a href="#" className="footer-link">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <p className="footer-copy">
              © 2024 Vidhan.ai. Built with ❤ for legal awareness in India.
            </p>
            <div className="footer-badges">
              <span className="footer-badge">
                <span className="footer-badge-dot footer-badge-dot--green" />
                All systems operational
              </span>
              <span className="footer-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                256-bit SSL
              </span>
            </div>
          </div>
          <div className="footer-socials">
            {SOCIALS.map(s => (
              <a key={s.label} href="#" className="footer-social-btn" aria-label={s.label} id={`footer-social-${s.label.toLowerCase()}`}>
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
