import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './Contact.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const CATEGORIES = [
  { value: 'General Query', label: '💬 General Query' },
  { value: 'Complaint',     label: '⚠️ Complaint' },
  { value: 'Bug Report',    label: '🐞 Bug Report' },
  { value: 'Feedback',      label: '⭐ Feedback' },
  { value: 'Partnership',   label: '🤝 Partnership' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] },
});

export default function Contact() {
  const [name, setName]         = useState(localStorage.getItem('vidhan_user') || '');
  const [email, setEmail]       = useState(localStorage.getItem('vidhan_email') || '');
  const [category, setCategory] = useState('General Query');
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');

  const [state, setState] = useState('idle'); // idle | loading | ok | error
  const [error, setError] = useState('');

  const reset = () => {
    setSubject(''); setMessage(''); setCategory('General Query');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim())            { setError('Please enter your name.'); return; }
    if (!EMAIL_RE.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (message.trim().length < 5) { setError('Please write a little more in your message.'); return; }

    // Fold the category into the subject line the backend emails out.
    const finalSubject = subject.trim()
      ? `${category} — ${subject.trim()}`
      : category;

    setState('loading');
    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: finalSubject,
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Could not send your message. Please try again.');
      setState('ok');
      reset();
    } catch (err) {
      setState('error');
      setError(err.message || 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="contact-root">
      <Navbar />

      <main className="contact-main">
        <motion.div className="contact-head" {...fadeUp(0)}>
          <span className="contact-eyebrow">We're here to help</span>
          <h1 className="contact-title">Get in touch</h1>
          <p className="contact-sub">
            Have a question about Indian law, hit a bug, or want to raise a complaint?
            Send us a message and we'll get back to you by email.
          </p>
        </motion.div>

        <div className="contact-grid">
          {/* Info panel */}
          <motion.aside className="contact-info" {...fadeUp(0.08)}>
            <div className="contact-info-item">
              <div className="contact-info-icon">✉️</div>
              <div>
                <div className="contact-info-label">Email us</div>
                <a className="contact-info-value" href="mailto:noreply@vidhanai.me">support@vidhanai.me</a>
              </div>
            </div>
            <div className="contact-info-item">
              <div className="contact-info-icon">⏱️</div>
              <div>
                <div className="contact-info-label">Response time</div>
                <div className="contact-info-value">Usually within 1–2 days</div>
              </div>
            </div>
            <div className="contact-info-item">
              <div className="contact-info-icon">⚖️</div>
              <div>
                <div className="contact-info-label">Legal disclaimer</div>
                <div className="contact-info-value contact-info-muted">
                  VidhanAI is an awareness tool, not a substitute for professional legal advice.
                </div>
              </div>
            </div>
          </motion.aside>

          {/* Form / success */}
          <motion.div className="contact-card" {...fadeUp(0.14)}>
            {state === 'ok' ? (
              <div className="contact-success" role="status">
                <div className="contact-success-check">✓</div>
                <h2>Message sent!</h2>
                <p>Thanks for reaching out. We've emailed you a confirmation and will reply soon.</p>
                <button className="contact-btn" onClick={() => setState('idle')}>
                  Send another message
                </button>
              </div>
            ) : (
              <form className="contact-form" onSubmit={submit} noValidate>
                <div className="contact-row">
                  <label className="contact-field">
                    <span>Name</span>
                    <input
                      type="text" value={name} placeholder="Your name"
                      onChange={e => setName(e.target.value)}
                      autoComplete="name" maxLength={100}
                    />
                  </label>
                  <label className="contact-field">
                    <span>Email</span>
                    <input
                      type="email" value={email} placeholder="you@example.com"
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email" maxLength={254}
                    />
                  </label>
                </div>

                <div className="contact-row">
                  <label className="contact-field">
                    <span>Type</span>
                    <select value={category} onChange={e => setCategory(e.target.value)}>
                      {CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="contact-field">
                    <span>Subject <em>(optional)</em></span>
                    <input
                      type="text" value={subject} placeholder="Short summary"
                      onChange={e => setSubject(e.target.value)}
                      maxLength={130}
                    />
                  </label>
                </div>

                <label className="contact-field">
                  <span>Message</span>
                  <textarea
                    value={message} rows={6}
                    placeholder="Describe your query or complaint in detail…"
                    onChange={e => setMessage(e.target.value)}
                    maxLength={4000}
                  />
                  <span className="contact-count">{message.length}/4000</span>
                </label>

                {error && <p className="contact-error" role="alert">{error}</p>}

                <button type="submit" className="contact-btn" disabled={state === 'loading'}>
                  {state === 'loading' ? 'Sending…' : 'Send message →'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
