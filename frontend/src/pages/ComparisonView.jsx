import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './ComparisonView.css';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const HIGHLIGHT_TERMS = [
  'death', 'imprisonment for life', 'imprisonment', 'fine', 'intent', 'knowledge',
  'private defence', 'provocation', 'murder', 'culpable homicide', 'punishment',
];

function formatPunishment(pun) {
  if (!pun) return '';
  if (typeof pun === 'string') return pun;
  if (typeof pun === 'object') {
    const parts = [];
    if (pun.death_penalty) parts.push('Death Penalty');
    if (pun.imprisonment) parts.push(pun.imprisonment);
    if (pun.maximum_imprisonment) parts.push(pun.maximum_imprisonment);
    if (pun.fine) parts.push(`Fine: ${pun.fine}`);
    if (parts.length > 0) return parts.join(' | ');
    return JSON.stringify(pun);
  }
  return String(pun);
}

function punishmentToList(pun) {
  if (!pun) return [];
  if (typeof pun === 'string') {
    const items = [];
    const lower = pun.toLowerCase();
    if (lower.includes('death')) items.push('Death Penalty');
    if (lower.includes('life')) items.push('Imprisonment for Life');
    if (lower.includes('fine')) items.push('Fine');
    if (items.length === 0) items.push(pun);
    return items;
  }
  if (typeof pun === 'object') {
    const items = [];
    if (pun.death_penalty) items.push('Death Penalty');
    if (pun.imprisonment) items.push(pun.imprisonment);
    if (pun.maximum_imprisonment) items.push(pun.maximum_imprisonment);
    if (pun.fine) items.push(`Fine: ${pun.fine}`);
    return items.length ? items : [JSON.stringify(pun)];
  }
  return [String(pun)];
}

function highlightText(text, accentClass) {
  if (!text) return null;
  const str = String(text);
  const escaped = HIGHLIGHT_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = str.split(pattern);
  const lowerTerms = new Set(HIGHLIGHT_TERMS.map(t => t.toLowerCase()));
  return parts.map((part, i) =>
    lowerTerms.has(part.toLowerCase())
      ? <span key={i} className={accentClass}>{part}</span>
      : part
  );
}

function changeIcon(title) {
  if (title.includes('Section')) return '🔢';
  if (title.includes('Language')) return '📝';
  if (title.includes('Explanation')) return '📖';
  if (title.includes('Structure')) return '🏗️';
  if (title.includes('Exception')) return '🛡️';
  if (title.includes('Intent') || title.includes('Knowledge')) return '⚖️';
  if (title.includes('Punishment')) return '🔨';
  return '📋';
}

function ComparisonView() {
  const { bns } = useParams();
  const [searchParams] = useSearchParams();
  const ipc = searchParams.get('ipc');
  const navigate = useNavigate();

  const [aiData, setAiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bnsDoc, setBnsDoc] = useState(null);
  const [ipcDoc, setIpcDoc] = useState(null);
  const [lawTitle, setLawTitle] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ bns });
        if (ipc && ipc !== 'N/A' && ipc !== 'null') params.set('ipc', ipc);

        const [lawRes, aiRes] = await Promise.all([
          fetch(`${BASE_URL}/compare-laws?${params}`),
          fetch(`${BASE_URL}/ai-compare?bns=${bns}&ipc=${ipc || ''}`),
        ]);

        if (!aiRes.ok) throw new Error('Failed to generate comparison');

        const laws = await lawRes.json();
        const mainLaw = Array.isArray(laws) ? laws[0] : null;
        const aiJson = await aiRes.json();
        setAiData(aiJson);

        if (mainLaw) {
          setLawTitle(mainLaw.title || '');
          setBnsDoc({
            section: mainLaw.bns_section,
            title: mainLaw.title,
            desc: mainLaw.bns_description || mainLaw.bns_ai_summary || mainLaw.description,
            punishment: mainLaw.bns_punishment || mainLaw.punishment,
            exceptions: mainLaw.exceptions,
            subsections: mainLaw.bns_subsections,
            explanation: mainLaw.simple_explanation || mainLaw.bns_ai_summary,
          });

          const ipcSec = mainLaw.ipc_section || ipc;
          if (ipcSec && ipcSec !== 'N/A' && ipcSec !== 'null') {
            setIpcDoc({
              section: ipcSec,
              title: mainLaw.title,
              desc: mainLaw.description,
              punishment: mainLaw.punishment,
              exceptions: mainLaw.exceptions,
              explanation: mainLaw.simple_explanation,
            });
          }
        }

      } catch (err) {
        console.error(err);
        setError('Unable to load comparison at this time.');
      }
      setLoading(false);
    }
    loadData();
  }, [bns, ipc]);

  if (loading) {
    return (
      <div className="cv-root">
        <Navbar />
        <div className="cv-loading-screen">
          <div className="cv-spinner"></div>
          <h2>Generating AI Comparison...</h2>
          <p>Groq AI is analyzing IPC {ipc || '—'} vs BNS {bns} using your legal database</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cv-root">
        <Navbar />
        <div className="cv-error">
          <p>{error}</p>
          <button onClick={() => navigate('/compare')}>Go Back</button>
        </div>
      </div>
    );
  }

  const ipcPunList = punishmentToList(ipcDoc?.punishment);
  const bnsPunList = punishmentToList(bnsDoc?.punishment);

  return (
    <div className="cv-root">
      <Navbar />

      <div className="cv-container">

        {/* Header */}
        <div className="cv-header">
          <button className="cv-back-btn" onClick={() => navigate('/compare')}>
            ← Back
          </button>
          <div className="cv-header-center">
            <div className="cv-supertitle">LAW COMPARISON</div>
            <h1 className="cv-title">
              <span className="cv-ipc-block">
                <span className="cv-ipc-title">IPC {ipc || 'N/A'}</span>
                <span className="cv-law-sub">Indian Penal Code, 1860</span>
              </span>
              <span className="cv-vs">VS</span>
              <span className="cv-bns-block">
                <span className="cv-bns-title">BNS {bns}</span>
                <span className="cv-law-sub">Bharatiya Nyaya Sanhita, 2023</span>
              </span>
            </h1>
            {lawTitle && (
              <div className="cv-pill-container">
                <div className="cv-pill">⚖️ {lawTitle}</div>
              </div>
            )}
          </div>
          <button className="cv-add-list">🔖 Add to My List</button>
        </div>

        {/* 3 Column Layout */}
        <div className="cv-three-cols">

          {/* IPC Column */}
          <div className="cv-col cv-col--ipc">
            <div className="cv-col-header">
              <div className="cv-col-badge">OLD LAW</div>
              <h2>IPC {ipc || 'N/A'}</h2>
              <p>Indian Penal Code, 1860</p>
              <div className="cv-col-icon cv-col-icon--ipc">📘</div>
            </div>

            <div className="cv-col-content">
              {ipcDoc ? (
                <>
                  <div className="cv-section">
                    <div className="cv-sec-title">👤 1. Definition</div>
                    <div className="cv-sec-body">{highlightText(ipcDoc.desc || 'Definition not explicitly provided.', 'cv-hl--ipc')}</div>
                  </div>
                  <div className="cv-section">
                    <div className="cv-sec-title">🔨 2. Punishment</div>
                    <ul className="cv-pun-list cv-pun-list--ipc">
                      {ipcPunList.length ? ipcPunList.map((p, i) => (
                        <li key={i}>{highlightText(p, 'cv-hl--ipc')}</li>
                      )) : <li>None specified</li>}
                    </ul>
                  </div>
                  {ipcDoc.exceptions && (
                    <div className="cv-section">
                      <div className="cv-sec-title">🛡️ 3. Exception</div>
                      <div className="cv-sec-body">{highlightText(ipcDoc.exceptions, 'cv-hl--ipc')}</div>
                    </div>
                  )}
                  {ipcDoc.explanation && (
                    <div className="cv-section">
                      <div className="cv-sec-title">ℹ️ 4. Explanation</div>
                      <div className="cv-sec-body">{highlightText(ipcDoc.explanation, 'cv-hl--ipc')}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="cv-none-box">
                  No direct IPC equivalent. This is a new provision under BNS.
                </div>
              )}
            </div>
          </div>

          {/* Center Column */}
          <div className="cv-col cv-col--center">
            <div className="cv-center-title">
              <span className="cv-line"></span>
              WHAT'S CHANGED?
              <span className="cv-line"></span>
            </div>

            <div className="cv-changes">
              {aiData?.changes?.map((c, i) => (
                <div className="cv-change-card" key={i}>
                  <div className="cv-change-icon">{changeIcon(c.title)}</div>
                  <div className="cv-change-text">
                    <div className="cv-change-title">{c.title}</div>
                    <div className="cv-change-desc">{c.description}</div>
                    {c.section_ref && (
                      <div className="cv-section-ref">{c.section_ref}</div>
                    )}
                  </div>
                  <div className={`cv-change-tag tag-${(c.tag || 'updated').toLowerCase()}`}>{c.tag}</div>
                </div>
              ))}
            </div>
          </div>

          {/* BNS Column */}
          <div className="cv-col cv-col--bns">
            <div className="cv-col-header">
              <div className="cv-col-badge">NEW LAW</div>
              <h2>BNS {bns}</h2>
              <p>Bharatiya Nyaya Sanhita, 2023</p>
              <div className="cv-col-icon cv-col-icon--bns">📗</div>
            </div>

            <div className="cv-col-content">
              {bnsDoc && (
                <>
                  <div className="cv-section">
                    <div className="cv-sec-title">👤 1. Definition</div>
                    <div className="cv-sec-body">{highlightText(bnsDoc.desc || 'Definition not explicitly provided.', 'cv-hl--bns')}</div>
                  </div>
                  <div className="cv-section">
                    <div className="cv-sec-title">🔨 2. Punishment</div>
                    <ul className="cv-pun-list cv-pun-list--bns">
                      {bnsPunList.length ? bnsPunList.map((p, i) => (
                        <li key={i}>{highlightText(p, 'cv-hl--bns')}</li>
                      )) : <li>None specified</li>}
                    </ul>
                  </div>
                  {bnsDoc.exceptions && (
                    <div className="cv-section">
                      <div className="cv-sec-title">🛡️ 3. Exception</div>
                      <div className="cv-sec-body">{highlightText(bnsDoc.exceptions, 'cv-hl--bns')}</div>
                    </div>
                  )}
                  {(bnsDoc.subsections?.length > 0 || bnsDoc.explanation) && (
                    <div className="cv-section">
                      <div className="cv-sec-title">ℹ️ 4. Explanation</div>
                      <div className="cv-sec-body">
                        {bnsDoc.subsections?.map((sub, i) => (
                          <p key={i}>{highlightText(sub.text || sub, 'cv-hl--bns')}</p>
                        ))}
                        {!bnsDoc.subsections?.length && bnsDoc.explanation && (
                          <p>{highlightText(bnsDoc.explanation, 'cv-hl--bns')}</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* JD Insight + Legend */}
        {aiData && (
          <div className="cv-jd-insight">
            <div className="cv-jd-left">
              <div className="cv-jd-icon">✨</div>
              <div className="cv-jd-text">
                <span className="cv-jd-label">JD Insight</span>
                {aiData.jd_insight}
              </div>
            </div>
            <div className="cv-jd-right">
              <div className="cv-impact-lbl">Change Impact</div>
              <div className="cv-impact-track">
                <div className="cv-impact-fill" style={{ width: `${aiData.impact_percentage || 0}%` }}></div>
              </div>
              <div className="cv-impact-val">{aiData.impact_percentage || 0}% Modified</div>
            </div>
          </div>
        )}

        <div className="cv-legend">
          <span className="cv-legend-item"><span className="cv-dot cv-dot--green"></span> Added / Improved</span>
          <span className="cv-legend-item"><span className="cv-dot cv-dot--yellow"></span> Updated</span>
          <span className="cv-legend-item"><span className="cv-dot cv-dot--purple"></span> Reorganized</span>
          <span className="cv-legend-item"><span className="cv-dot cv-dot--red"></span> Removed</span>
        </div>

      </div>
    </div>
  );
}

export default ComparisonView;
