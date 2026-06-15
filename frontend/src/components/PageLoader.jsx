/* ── PageLoader — shown while lazy chunks download ── */
import React from 'react';

const style = {
  root: {
    position: 'fixed', inset: 0,
    background: '#060b18',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    gap: '1.5rem',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#f1f5f9',
  },
  logoAI: { color: '#22d3ee' },
  bar: {
    width: '180px',
    height: '3px',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    width: '40%',
    background: 'linear-gradient(90deg, #6366f1, #22d3ee)',
    borderRadius: '2px',
    animation: 'loader-slide 1.2s ease-in-out infinite',
  },
  hint: {
    fontSize: '0.75rem',
    color: '#334155',
    letterSpacing: '0.05em',
  },
};

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('vidhan-loader-style')) {
  const el = document.createElement('style');
  el.id = 'vidhan-loader-style';
  el.textContent = `
    @keyframes loader-slide {
      0%   { transform: translateX(-100%); }
      50%  { transform: translateX(200%); }
      100% { transform: translateX(200%); }
    }
  `;
  document.head.appendChild(el);
}

export default function PageLoader() {
  return (
    <div style={style.root} aria-label="Loading Vidhan.ai" role="status">
      <div style={style.logo}>
        <img src="/vidhan-logo.png" alt="Vidhan.ai Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', marginRight: '10px', verticalAlign: 'middle', objectFit: 'cover' }} />
        Vidhan<span style={style.logoAI}>AI</span>
      </div>
      <div style={style.bar}>
        <div style={style.barFill} />
      </div>
      <span style={style.hint}>Loading…</span>
    </div>
  );
}
