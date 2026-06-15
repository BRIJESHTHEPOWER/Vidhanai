import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import LawCard from '../components/LawCard';

const BASE_URL = 'http://localhost:8000';

const CAT_COLORS = {
  women_safety:         '#e91e8c',
  cyber_crime:          '#1976d2',
  arrest_rights:        '#00c853',
  property_crimes:      '#f57c00',
  crimes_against_children: '#7b1fa2',
};

export default function Awareness() {
  const [categories, setCategories]   = useState([]);
  const [selected,   setSelected]     = useState(null);  // selected category key
  const [detail,     setDetail]       = useState(null);  // { title, laws, tips, ... }
  const [loading,    setLoading]      = useState(true);
  const [user,       setUser]         = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('vidhan_token');
    const name  = localStorage.getItem('vidhan_user');
    if (token && name) setUser({ name, token });
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BASE_URL}/awareness`);
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      setCategories([]);
    }
    setLoading(false);
  };

  const fetchDetail = async (key) => {
    setSelected(key);
    setDetail(null);
    try {
      const res  = await fetch(`${BASE_URL}/awareness?category=${key}`);
      const data = await res.json();
      setDetail(data);
    } catch {
      setDetail({ title: key, laws: [], tips: [] });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vidhan_token');
    localStorage.removeItem('vidhan_user');
    setUser(null);
  };

  // ────────────────────────────────────────────
  // DETAIL VIEW
  // ────────────────────────────────────────────
  if (selected && detail) {
    return (
      <div className="page-wrap">
        <Navbar user={user} onLogout={handleLogout} />
        <div className="container awareness-detail">
          <button className="back-btn" onClick={() => { setSelected(null); setDetail(null); }}>
            ← Back to Know Your Rights
          </button>

          {/* Header */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '2rem',
            marginBottom: '2rem',
            borderLeft: `4px solid ${detail.color || 'var(--primary)'}`
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{detail.icon}</div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' }}>
              {detail.title}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 600 }}>
              {detail.description}
            </p>
          </div>

          {/* Quick Tips */}
          {detail.tips?.length > 0 && (
            <>
              <h2 className="section-heading" style={{ marginBottom: '1rem' }}>
                Quick Tips & Helplines<span className="dot">.</span>
              </h2>
              <div className="tips-grid" style={{ marginBottom: '2.5rem' }}>
                {detail.tips.map((tip, i) => (
                  <div key={i} className="tip-card">{tip}</div>
                ))}
              </div>
            </>
          )}

          {/* Laws */}
          <h2 className="section-heading" style={{ marginBottom: '1rem' }}>
            Relevant Laws<span className="dot">.</span>
          </h2>
          {!detail.laws || detail.laws.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No laws loaded yet. Please seed the database.</p>
          ) : (
            detail.laws.map(law => <LawCard key={law.id} law={law} />)
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────
  // MAIN AWARENESS DASHBOARD
  // ────────────────────────────────────────────
  return (
    <div className="page-wrap">
      <Navbar user={user} onLogout={handleLogout} />

      <div className="container">
        <div className="page-header">
          <div className="hero-badge" style={{ display: 'inline-flex' }}>
            🛡️ Legal Awareness
          </div>
          <h1 className="page-title">Know Your Rights</h1>
          <p className="page-subtitle">
            Learn about the laws that protect you. Choose a category to explore relevant
            laws, your rights, and emergency helplines in simple language.
          </p>
        </div>

        {loading ? (
          <div className="awareness-grid" aria-busy="true">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="awareness-card" style={{ pointerEvents: 'none' }}>
                <div className="awareness-icon" style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.05) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite'
                  }} />
                </div>
                <div style={{
                  height: '18px', borderRadius: '6px', margin: '0.5rem 0',
                  background: 'linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.05) 75%)',
                  backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', width: '70%'
                }} />
                <div style={{
                  height: '12px', borderRadius: '5px',
                  background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)',
                  backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite 0.1s', width: '90%'
                }} />
                <div style={{
                  height: '12px', borderRadius: '5px', marginTop: '6px',
                  background: 'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)',
                  backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite 0.2s', width: '60%'
                }} />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="awareness-grid">
              {categories.map(cat => (
                <div
                  key={cat.key}
                  className="awareness-card"
                  onClick={() => fetchDetail(cat.key)}
                >
                  <div
                    className="awareness-icon"
                    style={{ background: `${CAT_COLORS[cat.key]}18`, border: `1px solid ${CAT_COLORS[cat.key]}33` }}
                  >
                    {cat.icon}
                  </div>
                  <div className="awareness-title">{cat.title}</div>
                  <div className="awareness-desc">{cat.description}</div>
                  <div className="awareness-meta">
                    <span>📋 {cat.law_count} Laws</span>
                    <span>💡 {cat.tips_count} Tips</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Emergency numbers */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,200,83,0.07), transparent)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              marginBottom: '3rem'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
                📞 Emergency Helplines in India
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {[
                  { icon: '🚨', label: 'Police Emergency', number: '112' },
                  { icon: '👩', label: 'Women Helpline', number: '181' },
                  { icon: '🧒', label: 'Childline', number: '1098' },
                  { icon: '💻', label: 'Cyber Crime', number: '1930' },
                  { icon: '⚖️', label: 'Legal Aid (NLSA)', number: '15100' },
                  { icon: '🏥', label: 'Ambulance', number: '108' },
                  { icon: '🔥', label: 'Fire', number: '101' },
                  { icon: '👨‍⚖️', label: 'Human Rights (NHRC)', number: '14433' },
                ].map(h => (
                  <div key={h.number} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '0.85rem 1rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>{h.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{h.label}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{h.number}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Awareness article */}
            <div style={{ marginBottom: '3rem' }}>
              <h2 className="section-heading" style={{ marginBottom: '1.25rem' }}>
                Key Legal Facts Every Indian Should Know<span className="dot">.</span>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {[
                  { icon: '🔒', title: 'Right to Remain Silent', desc: 'Article 20(3) of the Constitution: No person accused of an offense shall be compelled to be a witness against themselves.' },
                  { icon: '⏰', title: '24 Hour Rule', desc: 'Police CANNOT keep you in custody for more than 24 hours without producing you before a Magistrate.' },
                  { icon: '📱', title: 'Right to Call Family', desc: 'You have the right to inform a family member or friend immediately after arrest. Police cannot deny this.' },
                  { icon: '📝', title: 'Right to Know Charges', desc: 'You must be informed in writing about the reason for your arrest. Arrests without grounds are illegal.' },
                  { icon: '👨‍⚖️', title: 'Free Legal Aid', desc: 'If you cannot afford a lawyer, the state must provide one free of cost (Article 39A). Call Legal Aid: 15100.' },
                  { icon: '🛡️', title: 'Protection from Torture', desc: 'Any confession obtained by force or torture is NOT valid in court. Report police brutality to the NHRC.' },
                ].map(f => (
                  <div key={f.title} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1.25rem'
                  }}>
                    <div style={{ fontSize: '1.75rem', marginBottom: '0.6rem' }}>{f.icon}</div>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>{f.title}</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
