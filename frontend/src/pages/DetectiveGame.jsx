import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import './DetectiveGame.css';

const API = 'http://localhost:8000';

export default function DetectiveGame() {
  // Game States: 'menu', 'loading', 'scene', 'interrogation', 'charge', 'solved'
  const [gameState, setGameState] = useState('menu'); 
  const [currentCase, setCurrentCase] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [playerStats, setPlayerStats] = useState({ xp: 0, casesSolved: 0, rank: 'Rookie' });
  const [solveResult, setSolveResult] = useState(null);
  
  // Phase 1: Scene State
  const [foundClues, setFoundClues] = useState([]);
  
  // Phase 2: Interrogation State
  const [selectedSuspect, setSelectedSuspect] = useState(null);
  const [wrongAccusations, setWrongAccusations] = useState(0);
  const [accusedSuspect, setAccusedSuspect] = useState(null); // The correctly accused one

  useEffect(() => {
    fetchLeaderboard();
    const savedXp = localStorage.getItem('detective_xp') || 0;
    const savedCases = localStorage.getItem('detective_cases') || 0;
    updatePlayerStats(parseInt(savedXp), parseInt(savedCases));
  }, []);

  const updatePlayerStats = (xp, cases) => {
    let rank = 'Rookie';
    if (xp > 200) rank = 'Officer';
    if (xp > 500) rank = 'Inspector';
    if (xp > 1000) rank = 'Chief Inspector';
    if (xp > 2500) rank = 'Commissioner';
    
    setPlayerStats({ xp, casesSolved: cases, rank });
    localStorage.setItem('detective_xp', xp);
    localStorage.setItem('detective_cases', cases);
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${API}/detective/leaderboard`);
      if (res.ok) setLeaderboard(await res.json());
    } catch (e) {
      console.error("Leaderboard error", e);
    }
  };

  const generateCase = async () => {
    setGameState('loading');
    setFoundClues([]);
    setSelectedSuspect(null);
    setWrongAccusations(0);
    setAccusedSuspect(null);
    setSolveResult(null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const token = localStorage.getItem('vidhan_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/detective/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ difficulty: 'medium' }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("Failed to generate case");
      const data = await res.json();
      setCurrentCase(data);
      setGameState('scene');
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        alert("HQ is taking too long to respond. Please try again.");
      } else {
        alert("Failed to connect to Police HQ. Try again.");
      }
      setGameState('menu');
    }
  };

  // Phase 1 Action
  const investigateLocation = (index) => {
    if (!foundClues.includes(index)) {
      setFoundClues([...foundClues, index]);
    }
  };

  // Phase 2 Action
  const accuseSuspect = (suspect) => {
    if (suspect.is_guilty) {
      setAccusedSuspect(suspect);
      setGameState('charge'); // Move to Phase 3
    } else {
      setWrongAccusations(prev => prev + 1);
      alert(`"I didn't do it!"\n${suspect.name} is innocent. Keep looking! (-10 XP Penalty)`);
    }
  };

  // Phase 3 Action
  const fileCharge = async (selectedOption) => {
    setGameState('loading');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const user_id = localStorage.getItem('vidhan_user') || 'guest';
      const token = localStorage.getItem('vidhan_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/detective/solve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          case_id: currentCase.case_id,
          selected_section: selectedOption,
          user_id
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      setSolveResult(data);
      
      // Calculate XP (Penalize for wrong accusations)
      if (data.is_correct) {
        const penalty = wrongAccusations * 10;
        const finalXp = Math.max(10, data.xp_earned - penalty);
        updatePlayerStats(playerStats.xp + finalXp, playerStats.casesSolved + 1);
        data.xp_earned = finalXp; // Update object for display
      }
      
      setGameState('solved');
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        alert("HQ is taking too long to process the charge. Please try again.");
      } else {
        alert("Error submitting charge.");
      }
      setGameState('charge');
    }
  };

  return (
    <div className="detective-root">
      <Navbar />
      <div className="cyber-grid-bg"></div>
      <div className="cyber-scanline"></div>
      
      <main className="detective-main">
        {/* HUD */}
        <div className="det-hud">
          <div className="det-hud-left">
            <h1 className="det-logo">VIDHAN.AI <span className="det-logo-accent">DETECTIVE</span></h1>
            <div className="det-rank-badge">RANK: {playerStats.rank}</div>
          </div>
          <div className="det-hud-right">
            <div className="det-stat">
              <span className="det-stat-label">CASES SOLVED</span>
              <span className="det-stat-value text-blue">{playerStats.casesSolved}</span>
            </div>
            <div className="det-stat">
              <span className="det-stat-label">TOTAL XP</span>
              <span className="det-stat-value text-gold">{playerStats.xp}</span>
            </div>
          </div>
        </div>

        {/* ── MENU STATE ── */}
        {gameState === 'menu' && (
          <motion.div className="det-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="det-menu-center">
              <div className="det-glitch-wrapper">
                <h2 className="det-title-glitch" data-text="AWAITING ASSIGNMENT">AWAITING ASSIGNMENT</h2>
              </div>
              <p className="det-subtitle">Enter the crime scene, interrogate suspects, and file official BNS charges.</p>
              <button className="det-btn-primary det-glow" onClick={generateCase}>
                <span className="det-btn-icon">📁</span> START INVESTIGATION
              </button>
            </div>
            <div className="det-leaderboard-panel">
              <h3 className="det-panel-title">🏆 TOP DETECTIVES</h3>
              <div className="det-leaderboard-list">
                {leaderboard.map((lb, idx) => (
                  <div key={idx} className="det-lb-item">
                    <span className="det-lb-rank">#{idx + 1}</span>
                    <span className="det-lb-name">{lb.user_id}</span>
                    <span className="det-lb-xp">{lb.xp} XP</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── LOADING STATE ── */}
        {gameState === 'loading' && (
          <div className="det-loading-screen">
            <div className="det-radar"><div className="det-radar-sweep"></div></div>
            <h3 className="det-loading-text">ACCESSING POLICE NETWORK...</h3>
          </div>
        )}

        {/* ── PHASE 1: CRIME SCENE ── */}
        {gameState === 'scene' && currentCase && (
          <motion.div className="det-phase-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="det-phase-header">
              <h2>PHASE 1: CRIME SCENE INVESTIGATION</h2>
              <p>Case: {currentCase.title}</p>
            </div>
            
            <div className="det-incident-box">
              <span className="det-box-label">🚨 DISPATCH LOG</span>
              <p>{currentCase.incident_report}</p>
            </div>

            <div className="det-scene-area">
              <h3 className="det-scene-title">🔍 Search the Locations</h3>
              <div className="det-locations-grid">
                {currentCase.clues.map((clue, idx) => {
                  const isFound = foundClues.includes(idx);
                  return (
                    <div key={idx} className={`det-location-node ${isFound ? 'found' : ''}`} onClick={() => investigateLocation(idx)}>
                      {isFound ? (
                        <div className="det-clue-revealed">
                          <span className="det-clue-icon">{clue.type.includes('Physical') ? '🔬' : clue.type.includes('Witness') ? '👁️' : '💻'}</span>
                          <h4>{clue.title}</h4>
                          <p>{clue.description}</p>
                        </div>
                      ) : (
                        <div className="det-location-unexplored">
                          <span className="det-search-icon">📍</span>
                          <h4>Investigate:</h4>
                          <p className="det-loc-name">{clue.location}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {foundClues.length === currentCase.clues.length && (
              <motion.div className="det-phase-action" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="det-success-text">All evidence collected!</p>
                <button className="det-btn-primary" onClick={() => setGameState('interrogation')}>
                  PROCEED TO INTERROGATION &gt;&gt;
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── PHASE 2: INTERROGATION ── */}
        {gameState === 'interrogation' && currentCase && (
          <motion.div className="det-phase-container" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}>
            <div className="det-phase-header">
              <h2>PHASE 2: INTERROGATION ROOM</h2>
              <p>Review the evidence and accuse the correct suspect.</p>
            </div>
            
            {/* Show Evidence Recap */}
            <div className="det-evidence-recap">
              <h4>COLLECTED EVIDENCE:</h4>
              <ul>
                {currentCase.clues.map((c, i) => <li key={i}><strong>{c.title}:</strong> {c.description}</li>)}
              </ul>
            </div>

            <div className="det-suspects-grid">
              {currentCase.suspects.map((suspect, idx) => (
                <div key={idx} className={`det-suspect-box ${selectedSuspect === idx ? 'active' : ''}`} onClick={() => setSelectedSuspect(idx)}>
                  <div className="det-suspect-header">
                    <span className="det-suspect-avatar">👤</span>
                    <div>
                      <div className="det-suspect-name">{suspect.name}</div>
                      <div className="det-suspect-role">{suspect.role}</div>
                    </div>
                  </div>
                  
                  {selectedSuspect === idx && (
                    <motion.div className="det-suspect-details" initial={{ height: 0 }} animate={{ height: 'auto' }}>
                      <div className="det-statement">
                        <span className="det-box-label">STATEMENT</span>
                        <p>"{suspect.statement}"</p>
                      </div>
                      <button className="det-btn-accuse" onClick={(e) => { e.stopPropagation(); accuseSuspect(suspect); }}>
                        ACCUSE {suspect.name.toUpperCase()}
                      </button>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
            <button className="det-btn-secondary det-back-btn" onClick={() => setGameState('scene')}>
              &lt;&lt; BACK TO CRIME SCENE
            </button>
          </motion.div>
        )}

        {/* ── PHASE 3: THE CHARGE ── */}
        {gameState === 'charge' && currentCase && accusedSuspect && (
          <motion.div className="det-phase-container" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="det-phase-header">
              <h2 className="text-red">PHASE 3: FILE OFFICIAL CHARGES</h2>
              <p>You caught {accusedSuspect.name}. Now, select the correct BNS law to file the charge.</p>
            </div>
            
            <div className="det-confession-box">
              <span className="det-box-label text-red">CONFESSION LOG</span>
              <p className="det-typewriter-text">"{accusedSuspect.confession}"</p>
            </div>

            <div className="det-terminal-panel">
              <h3 className="det-terminal-title">&gt;&gt; VIDHAN DATABASE: SELECT BNS SECTION</h3>
              <div className="det-options-grid">
                {currentCase.options.map((opt, idx) => (
                  <button key={idx} className="det-option-btn" onClick={() => fileCharge(opt)}>
                    <span className="det-opt-prefix">[{idx + 1}]</span> {opt}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STATE: SOLVED ── */}
        {gameState === 'solved' && solveResult && (
          <motion.div className="det-result-screen" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <div className={`det-result-banner ${solveResult.is_correct ? 'success' : 'fail'}`}>
              <h2 className="det-result-status">
                {solveResult.is_correct ? 'JUSTICE SERVED' : 'MISTRIAL: WRONG CHARGES FILED'}
              </h2>
              <p className="det-result-msg">{solveResult.message}</p>
            </div>
            
            <div className="det-result-details">
              <div className="det-reward-box">
                <span className="det-reward-label">XP GAINED</span>
                <span className={`det-reward-val ${solveResult.is_correct ? 'text-gold' : 'text-red'}`}>
                  +{solveResult.xp_earned} XP
                </span>
                {wrongAccusations > 0 && solveResult.is_correct && (
                  <span className="det-penalty-text">(-{wrongAccusations * 10} XP for false accusations)</span>
                )}
              </div>
              
              <div className="det-law-breakdown">
                <h3 className="det-panel-title text-blue">⚖️ THE LAW EXPLAINED</h3>
                
                <div className="det-law-chips">
                  <div className="det-chip det-chip-bns">BNS {solveResult.bns_section}</div>
                  <div className="det-chip det-chip-ipc">Old IPC {solveResult.ipc_section}</div>
                  <div className={`det-chip ${solveResult.bailable === 'Bailable' ? 'det-chip-safe' : 'det-chip-danger'}`}>
                    {solveResult.bailable}
                  </div>
                  <div className={`det-chip ${solveResult.cognizable === 'Cognizable' ? 'det-chip-warning' : 'det-chip-safe'}`}>
                    {solveResult.cognizable}
                  </div>
                </div>

                <div className="det-correct-law">{solveResult.correct_option}</div>
                <p className="det-law-exp">{solveResult.law_explanation}</p>
                
                <div className="det-differences-box">
                  <span className="det-box-label text-gold">WHAT CHANGED FROM IPC?</span>
                  <p>{solveResult.differences}</p>
                </div>

                <div className="det-punishment-box">
                  <strong>Punishment:</strong> {solveResult.punishment}
                </div>
              </div>
              
              <div className="det-result-actions">
                <button className="det-btn-secondary" onClick={() => setGameState('menu')}>RETURN TO HQ</button>
                <button className="det-btn-primary" onClick={generateCase}>NEXT CASE &gt;&gt;</button>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
