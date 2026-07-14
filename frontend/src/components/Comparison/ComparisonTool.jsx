import React, { useState } from 'react';
import './ComparisonTool.css';

const API_BASE = 'http://localhost:8000';
const CHIPS    = ['Murder', 'Theft', 'Cheating'];

/* ── Change card ────────────────────────────────────────────────────────────── */
function ChangeCard({ change }) {
  const cls = {
    high:    'cc--high',
    medium:  'cc--medium',
    neutral: 'cc--neutral',
    new:     'cc--new',
  }[change.impact] || 'cc--neutral';

  return (
    <div className={`cc ${cls}`}>
      <p className="cc__label">{change.label}</p>
      <div className="cc__body">
        <div className="cc__col">
          <span className="cc__tag cc__tag--ipc">IPC</span>
          <p className="cc__val">{change.ipc}</p>
        </div>
        <span className="cc__arrow" aria-hidden="true">→</span>
        <div className="cc__col">
          <span className="cc__tag cc__tag--bns">BNS</span>
          <p className="cc__val">{change.bns}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function ComparisonTool() {
  const [topic,      setTopic]      = useState('');
  const [ipcSec,     setIpcSec]     = useState('');
  const [bnsSec,     setBnsSec]     = useState('');
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  /* Core search — accepts explicit values so chips can trigger without waiting
     for React state flush */
  const doSearch = async (t, ipc, bns) => {
    if (!t?.trim() && !ipc?.trim() && !bns?.trim()) {
      setError('Please fill at least one field before searching.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setHasSearched(true);

    const params = new URLSearchParams();
    if (t?.trim())   params.set('topic',       t.trim());
    if (ipc?.trim()) params.set('ipc_section', ipc.trim());
    if (bns?.trim()) params.set('bns_section', bns.trim());

    try {
      const res  = await fetch(`${API_BASE}/api/compare?${params}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else            setResult(data);
    } catch {
      setError('Failed to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => doSearch(topic, ipcSec, bnsSec);
  const handleKey    = (e) => { if (e.key === 'Enter') handleSearch(); };

  const handleChip = (chip) => {
    setTopic(chip);
    setIpcSec('');
    setBnsSec('');
    doSearch(chip, '', '');
  };

  /* ── Render ── */
  return (
    <div className="ct">

      {/* Search bar */}
      <div className="ct__bar">
        <div className="ct__inputs">
          <input
            className="ct__input ct__input--topic"
            placeholder="Search by topic — e.g. murder, theft, cheating"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={handleKey}
          />
          <input
            className="ct__input ct__input--ipc"
            placeholder="IPC section no. e.g. 302"
            value={ipcSec}
            onChange={(e) => setIpcSec(e.target.value)}
            onKeyDown={handleKey}
          />
          <input
            className="ct__input ct__input--bns"
            placeholder="BNS section no. e.g. 103"
            value={bnsSec}
            onChange={(e) => setBnsSec(e.target.value)}
            onKeyDown={handleKey}
          />
        </div>
        <button className="ct__btn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching…' : 'Compare →'}
        </button>
      </div>

      {/* Empty state */}
      {!hasSearched && !loading && (
        <div className="ct__empty">
          <p className="ct__empty-hint">Try an example topic to get started:</p>
          <div className="ct__chips">
            {CHIPS.map((chip) => (
              <button key={chip} className="ct__chip" onClick={() => handleChip(chip)}>
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="ct__loading">
          <span className="ct__spinner" aria-hidden="true" />
          <p>Comparing sections…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="ct__error" role="alert">{error}</div>
      )}

      {/* Results */}
      {!loading && result && (
        <>
          {/* Side-by-side cards */}
          <div className="ct__cards">

            {/* IPC Card */}
            <div className="ct__card ct__card--ipc">
              <div className="ct__card-head ct__card-head--ipc">
                <span className="ct__law-tag ct__law-tag--ipc">IPC 1860</span>
                <span className="ct__sec-num">§ {result.ipc?.section_number ?? '—'}</span>
              </div>
              <div className="ct__card-body ct__card-body--ipc">
                {result.ipc ? (
                  <>
                    <h3 className="ct__card-title">{result.ipc.title}</h3>
                    {result.ipc.section_text && (
                      <p className="ct__card-text">{result.ipc.section_text}</p>
                    )}
                  </>
                ) : (
                  <p className="ct__not-found">No matching IPC section found.</p>
                )}
              </div>
              {result.ipc && (
                <div className="ct__card-foot">
                  <span className="ct__badge ct__badge--red">
                    {result.ipc.punishment || 'No punishment / General provision'}
                  </span>
                  {result.ipc.offence_category && (
                    <span className="ct__badge ct__badge--gray">
                      {result.ipc.offence_category}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* VS bubble */}
            <div className="ct__vs" aria-label="versus">VS</div>

            {/* BNS Card */}
            <div className="ct__card ct__card--bns">
              <div className="ct__card-head ct__card-head--bns">
                <span className="ct__law-tag ct__law-tag--bns">BNS 2023</span>
                <span className="ct__sec-num">§ {result.bns?.section_number ?? '—'}</span>
              </div>
              <div className="ct__card-body ct__card-body--bns">
                {result.bns ? (
                  <>
                    <h3 className="ct__card-title">{result.bns.title}</h3>
                    {result.bns.description && (
                      <p className="ct__card-text">{result.bns.description}</p>
                    )}
                  </>
                ) : (
                  <p className="ct__not-found">No matching BNS section found.</p>
                )}
              </div>
              {result.bns && (
                <div className="ct__card-foot">
                  <span className="ct__badge ct__badge--green">
                    {result.bns.punishment || 'No punishment / General provision'}
                  </span>
                  <span className="ct__badge ct__badge--gray">
                    Punishable: {result.bns.is_punishable ? 'Yes' : 'No'}
                  </span>
                  {(result.bns.exceptions || []).length > 0 && (
                    <span className="ct__badge ct__badge--gray">
                      Exceptions: {result.bns.exceptions.length}
                    </span>
                  )}
                  {(result.bns.illustrations || []).length > 0 && (
                    <span className="ct__badge ct__badge--gray">
                      Illustrations: {result.bns.illustrations.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* What Changed */}
          {result.changes && result.changes.length > 0 && (
            <section className="ct__changes">
              <h2 className="ct__changes-title">🔍 What changed in the new law</h2>
              <div className="ct__changes-grid">
                {result.changes.map((ch, i) => (
                  <ChangeCard key={i} change={ch} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
