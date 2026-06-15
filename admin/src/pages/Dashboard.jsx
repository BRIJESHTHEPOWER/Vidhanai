import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Overview   from '../components/sections/Overview';
import UsersPanel from '../components/sections/UsersPanel';
import ReviewsPanel from '../components/sections/ReviewsPanel';
import QueriesPanel from '../components/sections/QueriesPanel';
import LawsPanel  from '../components/sections/LawsPanel';
import SettingsPanel from '../components/sections/SettingsPanel';
import logo from '../assets/logo.png';
import './Dashboard.css';

const NAV = [
  { to: '/',         icon: <GridIcon />,   label: 'Overview'  },
  { to: '/users',    icon: <UsersIcon />,  label: 'Users'     },
  { to: '/reviews',  icon: <StarIcon />,   label: 'Reviews'   },
  { to: '/queries',  icon: <MsgIcon />,    label: 'Queries'   },
  { to: '/laws',     icon: <BookIcon />,   label: 'Laws'      },
  { to: '/settings', icon: <GearIcon />,   label: 'Settings'  },
];

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSide, setMobileSide] = useState(false);
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('vadmin_user') || '{}'); }
    catch { return {}; }
  })();

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  function logout() {
    localStorage.removeItem('vadmin_token');
    localStorage.removeItem('vadmin_user');
    navigate('/login');
  }

  return (
    <div className={`dash${collapsed ? ' dash--collapsed' : ''}${mobileSide ? ' dash--mobile-open' : ''}`}>

      {/* ── Sidebar ── */}
      <aside className="dash-sidebar">
        {/* Logo */}
        <div className="dash-brand">
          <img src={logo} alt="VidhanAI" className="dash-brand-icon" />
          {!collapsed && (
            <div className="dash-brand-text">
              <span>Vidhan<span className="dash-brand-ai">AI</span></span>
              <span className="dash-brand-sub">Admin Console</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="dash-nav">
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `dash-nav-item${isActive ? ' dash-nav-item--active' : ''}`}
              onClick={() => setMobileSide(false)}
              title={collapsed ? n.label : ''}
            >
              <span className="dash-nav-icon">{n.icon}</span>
              {!collapsed && <span className="dash-nav-label">{n.label}</span>}
              {!collapsed && <span className="dash-nav-arrow">›</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button className="dash-collapse-btn" onClick={() => setCollapsed(c => !c)} title="Toggle sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: '0.3s' }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>

        {/* User panel */}
        <div className="dash-user">
          <div className="dash-user-avatar">
            {(user.name?.[0] || 'A').toUpperCase()}
          </div>
          {!collapsed && (
            <div className="dash-user-info">
              <span className="dash-user-name">{user.name || 'Admin'}</span>
              <span className="dash-user-role">Administrator</span>
            </div>
          )}
          {!collapsed && (
            <button className="dash-logout-btn" onClick={logout} title="Logout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileSide && <div className="dash-overlay" onClick={() => setMobileSide(false)} />}

      {/* ── Main ── */}
      <div className="dash-main">
        {/* Top bar */}
        <header className="dash-topbar">
          <button className="dash-menu-btn" onClick={() => setMobileSide(s => !s)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>
            </svg>
          </button>

          <div className="dash-topbar-info">
            <div className="dash-live-dot" />
            <span>Live Dashboard</span>
          </div>

          <div className="dash-topbar-stats">
            {stats && (
              <>
                <div className="dash-top-stat">
                  <span className="dash-top-stat-num">{stats.total_users}</span>
                  <span>Users</span>
                </div>
                <div className="dash-top-stat-divider" />
                <div className="dash-top-stat">
                  <span className="dash-top-stat-num">{stats.total_reviews}</span>
                  <span>Reviews</span>
                </div>
                <div className="dash-top-stat-divider" />
                <div className="dash-top-stat">
                  <span className="dash-top-stat-num">{stats.avg_rating}★</span>
                  <span>Avg</span>
                </div>
              </>
            )}
          </div>

          <div className="dash-topbar-right">
            <div className="dash-topbar-avatar" title={user.email}>
              {(user.name?.[0] || 'A').toUpperCase()}
            </div>
            <button className="dash-topbar-logout" onClick={logout}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" x2="9" y1="12" y2="12"/>
              </svg>
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="dash-content">
          <Routes>
            <Route path="/"         element={<Overview stats={stats} />} />
            <Route path="/users"    element={<UsersPanel />} />
            <Route path="/reviews"  element={<ReviewsPanel />} />
            <Route path="/queries"  element={<QueriesPanel />} />
            <Route path="/laws"     element={<LawsPanel />} />
            <Route path="/settings" element={<SettingsPanel />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/* ── Nav Icons ── */
function GridIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>;
}
function UsersIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function StarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function MsgIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function BookIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>;
}
function GearIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
}
