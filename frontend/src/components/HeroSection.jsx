import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Scale, PlayCircle } from 'lucide-react';
import { Particles }  from './ui/Particles';
import { AuroraText } from './ui/AuroraText';
import { ShinyBadge } from './ui/ShinyBadge';
import './HeroSection.css';

/* Aurora colour sweep for the headline accent */
const AURORA_COLORS = ['#4f46e5', '#818cf8', '#a78bfa', '#e879f9'];

/*
 * This hero is a fixed cinematic scene (courthouse photo + dark scrim) that
 * intentionally does not re-theme with the site's light/dark toggle — the
 * photo is inherently a night scene, so the panel stays dark and legible
 * regardless of which theme the rest of the site is in.
 */
export default function HeroSection() {
  const isLoggedIn = Boolean(localStorage.getItem('vidhan_token'));

  return (
    <section id="home" className="hero-section" aria-label="Hero">

      {/* ── Courthouse photo backdrop ───────────────────────── */}
      <div className="hero-bg-photo" aria-hidden="true" />
      <div className="hero-bg-scrim" aria-hidden="true" />

      {/* ── Warm light spilling from the doorway into the dark room ── */}
      <div className="hero-light-spill" aria-hidden="true" />
      <div className="hero-glow-ambient" aria-hidden="true" />

      {/* ── Cinematic film grain ─────────────────────────────── */}
      <div className="hero-grain" aria-hidden="true" />

      {/* ── Magic UI Particles — warm dust motes catching the light ── */}
      <Particles
        quantity  = {70}
        color     = {'#e8b84b'}
        size      = {0.75}
        staticity = {75}
        ease      = {35}
      />

      {/* ── Main content ────────────────────────────────────── */}
      <div className="hero-center">
        <div className="hero-content">

          {/* Magic UI ShinyBadge */}
          <ShinyBadge className="hero-anim-1" icon={<Plus size={12} strokeWidth={3} />}>
            The Future of Legal Tech
          </ShinyBadge>

          {/* Headline */}
          <h1 className="hero-title hero-anim-1">
            Wield the Power to
            <br />
            {/* Magic UI AuroraText */}
            <AuroraText colors={AURORA_COLORS} speed={0.75}>
              Decode the Law.
            </AuroraText>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle hero-anim-2">
            Instantly navigate the complexities of Indian criminal law.
            Decode BNS 2023 and IPC 1860 with absolute precision and clarity.
          </p>

          {/* CTA pair — first-question CTA is for new visitors only */}
          <div className="hero-cta-group hero-anim-2">
            {!isLoggedIn && (
              <Link to="/ask-ai" className="hero-btn-primary">
                <Scale size={16} strokeWidth={2.25} aria-hidden="true" />
                Ask Your First Legal Question
                <svg
                  className="hero-btn-arrow"
                  width="15" height="15"
                  viewBox="0 0 24 24"
                  fill="none" stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            )}
            <Link to="/#features-overview" className="hero-btn-ghost">
              <PlayCircle size={16} strokeWidth={2} aria-hidden="true" />
              Explore All Features
            </Link>
          </div>

        </div>
      </div>

    </section>
  );
}
