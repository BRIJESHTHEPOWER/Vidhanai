import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage, LANGUAGES } from '../LanguageContext';
import { useTheme } from '../context/ThemeContext';
import VidhanButton from './VidhanButton';
import VidhanLogo from './VidhanLogo';
import NotificationBell from './Navbar/NotificationBell';
import usePlanStatus from '../hooks/usePlanStatus';
import './Navbar.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const FEATURES_DROPDOWN = [
  { label: 'Ask AI',      to: '/ask-ai'  },
  { label: 'Comic Story', to: '/comic'   },
  { label: 'Tutor',       to: '/tutor'   },
  { label: 'Compare',     to: '/compare' },
  { label: 'Quiz',        to: '/quiz'    },
];

export default function Navbar() {
  const [scrolled, setScrolled]       = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [langOpen, setLangOpen]       = useState(false);
  const [avatar, setAvatar]           = useState(localStorage.getItem('vidhan_avatar') || '');
  const [featuresOpen, setFeaturesOpen] = useState(false);

  const { language, setLanguage, currentLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isPro, refetch: refetchPlan } = usePlanStatus();
  const langRef      = useRef(null);
  const featuresRef  = useRef(null);
  const navigate   = useNavigate();

  /* scroll effect */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* close lang dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* close features panel on outside click or Escape */
  useEffect(() => {
    const onMouse = (e) => {
      if (featuresRef.current && !featuresRef.current.contains(e.target)) {
        setFeaturesOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === 'Escape') setFeaturesOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  /* listen for avatar updates from Profile page */
  useEffect(() => {
    const handleStorageChange = () => {
      setAvatar(localStorage.getItem('vidhan_avatar') || '');
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('vidhan_avatar_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('vidhan_avatar_updated', handleStorageChange);
    };
  }, []);

  /* Re-read the plan when a subscription completes, so the PRO badge appears
     without a reload. SubscribeSuccess fires this once the backend confirms. */
  useEffect(() => {
    const onPlanChange = () => refetchPlan();
    window.addEventListener('vidhan_plan_updated', onPlanChange);
    return () => window.removeEventListener('vidhan_plan_updated', onPlanChange);
  }, [refetchPlan]);

  const handleLogout = () => {
    // Record logout timestamp (fire-and-forget)
    const email = localStorage.getItem('vidhan_email') || (JSON.parse(localStorage.getItem('vidhan_user') || '{}')?.email);
    if (email) {
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }).catch(() => {});
    }
    localStorage.removeItem('vidhan_token');
    localStorage.removeItem('vidhan_user');
    localStorage.removeItem('vidhan_email');
    localStorage.removeItem('vidhan_avatar');
    setAvatar('');
    navigate('/login');
  };

  /* Desktop nav links — after Features ▾ and How It Works */
  const NAV_LINKS = [
    { label: 'Tutor',       to: '/tutor',   badge: 'New' },
    { label: 'Ask AI',      to: '/ask-ai'               },
    { label: 'Comic Story', to: '/comic',   badge: 'Fun' },
    { label: 'Compare',     to: '/compare'              },
    { label: 'Quiz',        to: '/quiz'                 },
  ];

  /* If the target section is already on the current page (i.e. we're on the
     home page), scroll to it right away. This also covers re-clicking the same
     anchor when the URL hash is unchanged — React Router won't fire in that case.
     When on another page, the element isn't present yet, so we do nothing and
     the global HashScroll handler in App.jsx scrolls after the home page loads. */
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-icon">
            <VidhanLogo size={44} />
          </span>
          <span className="navbar__logo-text">Vidhan<span className="navbar__logo-ai">AI</span></span>
        </Link>

        {/* Center Nav */}
        <nav className="navbar__nav" aria-label="Main navigation">

          {/* ── Features dropdown ── */}
          <div className="navbar__feat-wrap" ref={featuresRef}>
            <button
              className="navbar__nav-link navbar__feat-btn"
              onClick={() => setFeaturesOpen(o => !o)}
              aria-expanded={featuresOpen}
              aria-haspopup="menu"
            >
              Features
              <svg
                width="11" height="11"
                viewBox="0 0 24 24"
                fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  transform: featuresOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.18s ease',
                  marginLeft: '3px',
                }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              <span className="navbar__nav-underline" />
            </button>

            {featuresOpen && (
              <div
                role="menu"
                aria-label="Features"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  background: 'var(--nav-glass-bg-scrolled)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  borderRadius: '10px',
                  border: theme === 'light' ? '0.5px solid rgba(15,23,42,0.08)' : '0.5px solid rgba(255,255,255,0.08)',
                  boxShadow: 'inset 0 1px 0 var(--nav-glass-highlight-scrolled), 0 12px 40px var(--nav-glass-shadow-scrolled)',
                  padding: '6px',
                  minWidth: '180px',
                  zIndex: 50,
                }}
              >
                {FEATURES_DROPDOWN.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    role="menuitem"
                    onClick={() => setFeaturesOpen(false)}
                    style={{
                      display: 'block',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#D4A017';
                      e.currentTarget.style.background = theme === 'light' ? '#f9f6ef' : '#1a1a1a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '';
                      e.currentTarget.style.background = '';
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* ── How It Works ── */}
          <Link to="/#how-it-works" className="navbar__nav-link" onClick={() => scrollToSection('how-it-works')}>
            How It Works
            <span className="navbar__nav-underline" />
          </Link>

          {/* ── Pricing ── */}
          <Link to="/pricing" className="navbar__nav-link">
            Pricing
            <span className="navbar__nav-underline" />
          </Link>

          {/* ── About ── */}
          <Link to="/about" className="navbar__nav-link">
            About
            <span className="navbar__nav-underline" />
          </Link>

          {/* ── Reviews ── */}
          <Link to="/reviews" className="navbar__nav-link">
            Reviews
            <span className="navbar__nav-underline" />
          </Link>

          {/* ── Contact ── */}
          <Link to="/contact" className="navbar__nav-link">
            Contact
            <span className="navbar__nav-underline" />
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="navbar__actions">
          {/* Notification Bell */}
          <NotificationBell />

          {/* Theme Toggle */}
          <button
            className={`navbar__icon-btn navbar__theme-btn${theme === 'light' ? ' navbar__theme-btn--light' : ''}`}
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="navbar__theme-icon">
              {theme === 'dark' ? (
                /* Sun — click to go light */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4.5"/>
                  <line x1="12" y1="2" x2="12" y2="4"/>
                  <line x1="12" y1="20" x2="12" y2="22"/>
                  <line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/>
                  <line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/>
                  <line x1="2" y1="12" x2="4" y2="12"/>
                  <line x1="20" y1="12" x2="22" y2="12"/>
                  <line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/>
                  <line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>
                </svg>
              ) : (
                /* Moon — click to go dark */
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
                </svg>
              )}
            </span>
            <span className="navbar__theme-label">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>

          {/* User Profile / Login */}
          {localStorage.getItem('vidhan_token') ? (
            <div className="navbar__user-menu">
              <button
                className={`navbar__avatar${isPro ? ' navbar__avatar--pro' : ''}`}
                onClick={() => navigate('/profile')}
                title={isPro ? 'Pro member — View Profile' : 'View Profile'}
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Profile"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(99,102,241,0.6)' }}
                  />
                ) : (
                  <span>{localStorage.getItem('vidhan_user')?.charAt(0).toUpperCase() || 'U'}</span>
                )}
                {isPro && <span className="navbar__pro-badge">PRO</span>}
              </button>
              <button
                className="navbar__logout-btn"
                onClick={handleLogout}
                title="Log Out"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" x2="9" y1="12" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <VidhanButton
              variant="primary"
              size="small"
              id="nav-login-btn"
              onClick={() => navigate('/login')}
              className="navbar__login-antd"
            >
              Log In
            </VidhanButton>
          )}

          {/* Mobile Menu */}
          <button
            className={`navbar__hamburger${menuOpen ? ' navbar__hamburger--open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`navbar__mobile${menuOpen ? ' navbar__mobile--open' : ''}`}>
        <Link to="/#how-it-works" className="navbar__mobile-link" onClick={() => { setMenuOpen(false); scrollToSection('how-it-works'); }}>
          How It Works
        </Link>
        <Link to="/pricing" className="navbar__mobile-link" onClick={() => setMenuOpen(false)}>
          Pricing
        </Link>
        <Link to="/about" className="navbar__mobile-link" onClick={() => setMenuOpen(false)}>
          About
        </Link>
        <Link to="/reviews" className="navbar__mobile-link" onClick={() => setMenuOpen(false)}>
          Reviews
        </Link>
        <Link to="/contact" className="navbar__mobile-link" onClick={() => setMenuOpen(false)}>
          Contact
        </Link>
        {NAV_LINKS.map((link) => (
          <Link key={link.label} to={link.to} className="navbar__mobile-link" onClick={() => setMenuOpen(false)}>
            {link.label}
            {link.badge && <span className="navbar__nav-badge">{link.badge}</span>}
          </Link>
        ))}
        <div className="navbar__mobile-lang">
          {LANGUAGES.map(lang => (
            <button key={lang.code}
              className={`navbar__mobile-lang-btn${language === lang.code ? ' active' : ''}`}
              onClick={() => { setLanguage(lang.code); setMenuOpen(false); }}>
              {lang.flag} {lang.native}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}