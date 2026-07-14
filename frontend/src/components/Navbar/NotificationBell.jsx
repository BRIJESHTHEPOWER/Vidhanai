// frontend/src/components/Navbar/NotificationBell.jsx

import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const TAG_STYLES = {
  'New Feature': { background: '#EEEDFE', color: '#3C3489' },
  'Improvement': { background: '#E1F5EE', color: '#0F6E56' },
  'Bug Fix':     { background: '#FCEBEB', color: '#A32D2D' },
  'Coming Soon': { background: '#FAEEDA', color: '#854F0B' },
};

function planLabel(v) {
  return { all: 'All users', free: 'Free plan', pro: 'Pro plan', max: 'Max plan' }[v] || v;
}

export default function NotificationBell() {
  const [open,    setOpen]    = useState(false);
  const [updates, setUpdates] = useState([]);
  const [hasNew,  setHasNew]  = useState(false);
  const wrapRef = useRef(null);

  /* Fetch on mount */
  useEffect(() => {
    fetch(`${API_BASE}/api/announcements`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUpdates(data);
          setHasNew(data.some(d => d.is_new));
        }
      })
      .catch(() => {});
  }, []);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleBellClick = () => {
    const opening = !open;
    setOpen(opening);
    if (opening && hasNew) {
      setHasNew(false);
      /* Mark read fire-and-forget */
      fetch(`${API_BASE}/api/announcements/mark-read`, { method: 'PATCH' }).catch(() => {});
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>

      {/* ── Bell button ── */}
      <button
        onClick={handleBellClick}
        aria-label="Notifications"
        title="What's new"
        style={{
          position:       'relative',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          padding:        '6px',
          borderRadius:   '8px',
          color:          'var(--clr-text-muted)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          transition:     'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(127,119,221,0.1)'; e.currentTarget.style.color = 'var(--clr-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
      >
        {/* Bell SVG */}
        <svg
          width="18" height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>

        {/* Red dot */}
        {hasNew && (
          <span
            aria-label="New notifications"
            style={{
              position:     'absolute',
              top:          '4px',
              right:        '4px',
              width:        '8px',
              height:       '8px',
              borderRadius: '50%',
              background:   '#ef4444',
              border:       '1.5px solid #ffffff',
              pointerEvents:'none',
            }}
          />
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{
            position:     'absolute',
            top:          '110%',
            right:        0,
            width:        '300px',
            background:   '#ffffff',
            borderRadius: '12px',
            boxShadow:    '0 8px 24px rgba(0,0,0,0.12)',
            zIndex:       999,
            overflow:     'hidden',
            border:       '1px solid #f0f0f0',
          }}
        >
          {/* Header */}
          <div style={{
            padding:      '14px 16px 10px',
            borderBottom: '1px solid #f5f5f5',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>
              What's new in Vidhan AI
            </span>
          </div>

          {/* Empty state */}
          {updates.length === 0 ? (
            <p style={{
              padding:   '20px 16px',
              fontSize:  '13px',
              color:     '#94a3b8',
              margin:    0,
              textAlign: 'center',
            }}>
              No updates yet.
            </p>
          ) : (
            <ul style={{
              listStyle:  'none',
              margin:     0,
              padding:    0,
              maxHeight:  '360px',
              overflowY:  'auto',
            }}>
              {updates.map((ann) => {
                const tagStyle = TAG_STYLES[ann.feature_tag] || TAG_STYLES['New Feature'];
                return (
                  <li
                    key={ann._id}
                    style={{
                      padding:      '12px 16px',
                      borderBottom: '1px solid #f5f5f5',
                      cursor:       'default',
                    }}
                  >
                    {/* Tag + NEW badge row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                      <span style={{
                        display:       'inline-block',
                        fontSize:      '10px',
                        fontWeight:    700,
                        padding:       '2px 7px',
                        borderRadius:  '4px',
                        background:    tagStyle.background,
                        color:         tagStyle.color,
                        letterSpacing: '0.03em',
                      }}>
                        {ann.feature_tag}
                      </span>
                      {ann.is_new && (
                        <span style={{
                          fontSize:      '9px',
                          fontWeight:    800,
                          letterSpacing: '0.07em',
                          background:    '#22c55e',
                          color:         '#ffffff',
                          padding:       '2px 6px',
                          borderRadius:  '4px',
                        }}>
                          NEW
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <p style={{
                      fontSize:   '13px',
                      fontWeight: 500,
                      color:      '#1a1a1a',
                      margin:     '0 0 3px',
                      lineHeight: 1.4,
                    }}>
                      {ann.title}
                    </p>

                    {/* Message */}
                    {ann.message && (
                      <p style={{
                        fontSize:   '12px',
                        color:      '#64748b',
                        margin:     '0 0 5px',
                        lineHeight: 1.5,
                      }}>
                        {ann.message}
                      </p>
                    )}

                    {/* Meta */}
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                      {ann.date} · {planLabel(ann.plan)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
