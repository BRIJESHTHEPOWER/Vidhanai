/**
 * L5: 404 Not Found page
 * Shown for any unmatched route.
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const SUGGESTIONS = [
  { label: 'Search Indian Law',  path: '/',          icon: '🔍' },
  { label: 'Ask AI',             path: '/ask-ai',    icon: '🤖' },
  { label: 'Take a Quiz',        path: '/quiz',      icon: '📝' },
  { label: 'Compare Laws',       path: '/compare',   icon: '⚖️'  },
  { label: 'Legal Awareness',    path: '/awareness', icon: '🛡️' },
];

export default function NotFound() {
  useEffect(() => {
    document.title = '404 — Page Not Found | Vidhan.ai';
  }, []);

  return (
    <main className="not-found-page" aria-labelledby="nf-title">
      <div className="not-found-content">

        {/* Animated scales icon */}
        <div className="not-found-icon" aria-hidden="true">⚖️</div>

        {/* 404 code */}
        <div className="not-found-code" aria-hidden="true">404</div>

        <h1 className="not-found-title" id="nf-title">
          Section Not Found
        </h1>
        <p className="not-found-sub">
          This page doesn't exist in our legal database.<br />
          Perhaps the URL was mistyped, or the page was moved.
        </p>

        {/* Actions */}
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary" id="nf-home-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Return Home
          </Link>
          <Link to="/ask-ai" className="btn btn-outline" id="nf-explore-btn">
            Ask AI
          </Link>
        </div>

        {/* Quick links */}
        <nav className="not-found-suggestions" aria-label="Suggested pages">
          <h3>You might be looking for</h3>
          <ul>
            {SUGGESTIONS.map(({ label, path, icon }) => (
              <li key={path}>
                <Link to={path}>
                  <span>{icon}</span>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
