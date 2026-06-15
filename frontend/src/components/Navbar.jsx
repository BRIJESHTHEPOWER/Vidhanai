import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage, LANGUAGES } from '../LanguageContext';
import VidhanLogo from './VidhanLogo';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled]       = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [langOpen, setLangOpen]       = useState(false);
  const [listening, setListening]     = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [searchVal, setSearchVal]     = useState('');
  const [avatar, setAvatar]           = useState(localStorage.getItem('vidhan_avatar') || '');

  const { language, setLanguage, currentLang } = useLanguage();
  const searchRef  = useRef(null);
  const langRef    = useRef(null);
  const recogRef   = useRef(null);
  const navigate   = useNavigate();

  /* scroll effect */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* focus search input when opened */
  useEffect(() => {
    if (searchOpen && searchRef.current) searchRef.current.focus();
  }, [searchOpen]);

  /* close lang dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

  /* search suggestions */
  useEffect(() => {
    if (!searchVal.trim()) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`http://localhost:8000/suggest?query=${encodeURIComponent(searchVal)}`);
        const d = await r.json();
        setSuggestions(d || []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchVal]);

  /* Voice STT in Navbar */
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { navigate('/ask-ai'); return; }
    const recog = new SR();
    recog.lang = language === 'Hindi' ? 'hi-IN'
      : language === 'Kannada'  ? 'kn-IN'
      : language === 'Tamil'    ? 'ta-IN'
      : language === 'Telugu'   ? 'te-IN'
      : language === 'Marathi'  ? 'mr-IN'
      : language === 'Bengali'  ? 'bn-IN'
      : 'en-IN';
    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 3;
    recogRef.current = recog;
    recog.onstart  = () => setListening(true);
    recog.onend    = () => setListening(false);
    recog.onresult = (e) => {
      const results = Array.from(e.results);
      const finalResult = results.find(r => r.isFinal);
      if (finalResult) {
        const txt = finalResult[0].transcript;
        navigate(`/ask-ai?q=${encodeURIComponent(txt)}`);
      }
    };
    recog.onerror = () => setListening(false);
    recog.start();
  };

  const stopVoice = () => {
    recogRef.current?.stop();
    setListening(false);
  };

  const handleLogout = () => {
    // Record logout timestamp (fire-and-forget)
    const email = localStorage.getItem('vidhan_email') || (JSON.parse(localStorage.getItem('vidhan_user') || '{}')?.email);
    if (email) {
      fetch('http://localhost:8000/auth/logout', {
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

  const NAV_LINKS = [
    { label: 'Explore',    to: '/#features' },
    { label: 'Tutor',      to: '/tutor',    badge: 'New'  },
    { label: 'Ask AI',     to: '/ask-ai'    },
    { label: 'Comic Story',to: '/comic',     badge: 'Fun'  },
    { label: 'Compare',    to: '/compare'   },
    { label: 'Quiz',       to: '/quiz'      },
    { label: 'Reviews',    to: '/reviews'   },
  ];

  return (
    <header className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-icon" style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <VidhanLogo size={36} />
          </span>
          <span className="navbar__logo-text">Vidhan<span className="navbar__logo-ai">AI</span></span>
        </Link>

        {/* Center Nav */}
        <nav className="navbar__nav" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.to} className="navbar__nav-link">
              {link.label}
              {link.badge && <span className="navbar__nav-badge">{link.badge}</span>}
              <span className="navbar__nav-underline"></span>
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="navbar__actions">
          {/* Search */}
          <div className={`navbar__search${searchOpen ? ' navbar__search--open' : ''}`}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search IPC sections, laws..."
              className="navbar__search-input"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onBlur={() => setTimeout(() => { setSuggestions([]); setSearchOpen(false); }, 200)}
            />
            {suggestions.length > 0 && (
              <div className="navbar__search-suggestions">
                {suggestions.map((s, i) => (
                  <button key={i} className="navbar__suggestion-item"
                    onMouseDown={() => { navigate(`/ask-ai?q=${encodeURIComponent(s)}`); setSearchOpen(false); setSearchVal(''); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <button className="navbar__icon-btn" aria-label="Search" onClick={() => setSearchOpen(!searchOpen)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
          </div>

          {/* Voice */}
          <button
            className={`navbar__icon-btn navbar__voice-btn${listening ? ' navbar__voice-btn--listening' : ''}`}
            aria-label="Voice input"
            id="nav-voice-btn"
            onClick={listening ? stopVoice : startVoice}
            title={listening ? 'Stop listening' : 'Ask by voice'}
          >
            {listening && <span className="navbar__voice-ring" />}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
          </button>

          {/* User Profile / Login */}
          {localStorage.getItem('vidhan_token') ? (
            <div className="navbar__user-menu">
              <button className="navbar__avatar" onClick={() => navigate('/profile')} title="View Profile">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Profile"
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(99,102,241,0.6)' }}
                  />
                ) : (
                  <span>{localStorage.getItem('vidhan_user')?.charAt(0).toUpperCase() || 'U'}</span>
                )}
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
            <Link to="/login" className="navbar__login-btn" id="nav-login-btn">
              Log In
            </Link>
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
        {NAV_LINKS.map((link) => (
          <Link key={link.label} to={link.to} className="navbar__mobile-link" onClick={() => setMenuOpen(false)}>
            {link.label}
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