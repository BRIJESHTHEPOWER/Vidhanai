import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import usePlanStatus from '../hooks/usePlanStatus';
import './SubscribeSuccess.css';

/**
 * Demo Pro-only page. Reachable only through <ProRoute>, which redirects
 * non-Pro users to /pricing. This is a placeholder showing how to gate real
 * Pro features later — wrap the route in <ProRoute> and you're done.
 */
export default function ProDemo() {
  const { data } = usePlanStatus();

  return (
    <div className="subsuccess-root">
      <Navbar />
      <main className="subsuccess-main">
        <div className="subsuccess-card">
          <span className="subsuccess-testmode">🧪 TEST MODE</span>
          <div className="subsuccess-check" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="subsuccess-title">Pro feature unlocked 🔓</h1>
          <p className="subsuccess-text">
            You’re seeing this because your <strong>plan_status</strong> is
            <strong> pro</strong>. Any component wrapped in <code>&lt;ProRoute&gt;</code>
            renders only for confirmed Pro users.
          </p>
          {data?.current_period_end && (
            <p className="subsuccess-hint">
              Current period ends: {new Date(data.current_period_end).toLocaleString()}
            </p>
          )}
          <div className="subsuccess-actions">
            <Link to="/" className="subsuccess-btn subsuccess-btn--primary">Back to home</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
