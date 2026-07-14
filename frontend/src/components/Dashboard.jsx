import React, { useState } from 'react';
import './Dashboard.css';

/* ── Quick Action Card ── */
function QuickAction({ icon, label, desc, color, id }) {
  return (
    <button className="qa-card" id={id} style={{ '--qa-color': color }}>
      <div className="qa-card-icon">{icon}</div>
      <div className="qa-card-text">
        <span className="qa-card-label">{label}</span>
        <span className="qa-card-desc">{desc}</span>
      </div>
      <svg className="qa-card-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  );
}

/* ── Insight card ── */
function InsightCard({ ipc, title, desc, tag }) {
  return (
    <div className="insight-card">
      <div className="insight-card-top">
        <span className="insight-ipc">{ipc}</span>
        <span className="insight-tag">{tag}</span>
      </div>
      <h4 className="insight-title">{title}</h4>
      <p className="insight-desc">{desc}</p>
    </div>
  );
}

/* ── Law of the Day ── */
function LawOfDay() {
  return (
    <div className="law-of-day">
      <div className="law-of-day-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Law of the Day
      </div>
      <div className="law-of-day-body">
        <div className="law-of-day-ipc">IPC 144</div>
        <p className="law-of-day-text">
          Prohibitory orders — empowers a magistrate to issue orders to prevent unlawful assembly of 5 or more persons when immediate remedy is needed.
        </p>
        <div className="law-of-day-tags">
          <span>Public Order</span>
          <span>Criminal Law</span>
        </div>
      </div>
    </div>
  );
}

/* ── Recent Queries ── */
const RECENT = [
  { q: 'Bail conditions under CrPC', time: '2m ago' },
  { q: 'IPC 498A explained', time: '18m ago' },
  { q: 'FIR filing process', time: '1h ago' },
  { q: 'Consumer protection rights', time: '3h ago' },
];

/* ── Insights Panel ── */
const INSIGHTS = [
  { ipc:'302', title:'Murder', desc:'Maximum penalty is death or life imprisonment plus fine.', tag:'Criminal' },
  { ipc:'420', title:'Cheating & Fraud', desc:'7 years imprisonment for dishonest inducement causing harm.', tag:'Fraud' },
  { ipc:'354', title:'Outraging Modesty', desc:'Min 1 year to max 5 years imprisonment.', tag:'Protection' },
];

/* ── Main Dashboard ── */
export default function Dashboard() {
  const [activeQuery, setActiveQuery] = useState(null);

  return (
    <section id="features" className="section dashboard-section">
      {/* Background accents */}
      <div className="bg-orb bg-orb-blue" style={{width:500,height:500,top:'10%',left:'-15%',opacity:0.12}} />
      <div className="bg-orb bg-orb-purple" style={{width:400,height:400,bottom:'0%',right:'-10%',opacity:0.1}} />

      <div className="container">
        <div className="section-header">
          <div className="section-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg>
            Core Dashboard
          </div>
          <h2 className="section-title">Your Legal Command <span className="gradient-text">Center</span></h2>
          <p className="section-subtitle">Everything you need to understand, explore, and act on Indian law — in one intelligent interface.</p>
        </div>

        {/* 3-column grid */}
        <div className="dashboard-grid">
          {/* ── Left Panel ── */}
          <aside className="dash-panel dash-panel--left">
            <div className="dash-panel-title">Quick Actions</div>
            <div className="qa-list">
              <QuickAction id="qa-askai" icon={<AskAIIcon/>} label="Ask AI" desc="Instant legal answers" color="#6366f1"/>
              <QuickAction id="qa-ipc" icon={<IPCIcon/>} label="Browse IPC" desc="5,000+ sections" color="#06b6d4"/>
              <QuickAction id="qa-cases" icon={<CaseIcon/>} label="Case Library" desc="Real precedents" color="#8b5cf6"/>
              <QuickAction id="qa-rights" icon={<RightsIcon/>} label="Know Rights" desc="Awareness guide" color="#f59e0b"/>
            </div>

            <LawOfDay/>

            <div className="dash-panel-title" style={{marginTop:20}}>Recent Queries</div>
            <div className="recent-list">
              {RECENT.map((r, i) => (
                <button
                  key={i}
                  className={`recent-item${activeQuery === i ? ' recent-item--active' : ''}`}
                  onClick={() => setActiveQuery(i)}
                >
                  <span className="recent-dot"/>
                  <span className="recent-text">{r.q}</span>
                  <span className="recent-time">{r.time}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Center Panel — Feature Cards ── */}
          <main className="dash-panel dash-panel--center">
            <div className="dash-panel-title">Platform Features</div>
            <div className="feature-cards-grid">
              <FeatureCard
                icon={<AIBrainIcon/>}
                color="#6366f1"
                title="AI Legal Reasoning"
                desc="Ask complex legal questions in plain language. Get structured answers with IPC references, precedents, and simplified explanations."
                badge="GPT-4 Powered"
                id="feat-ai"
              />
              <FeatureCard
                icon={<VisualizeIcon/>}
                color="#06b6d4"
                title="Case Visualization"
                desc="See how a legal case unfolds step-by-step: Incident → Investigation → Charge → Trial → Outcome."
                badge="Interactive"
                id="feat-viz"
              />
              <FeatureCard
                icon={<CompareIconSvg/>}
                color="#8b5cf6"
                title="IPC vs BNS Compare"
                desc="Side-by-side comparison of old and new laws. Understand what changed with the Bharatiya Vidhan Sanhita."
                badge="2024 Laws"
                id="feat-compare"
              />
              <FeatureCard
                icon={<TranslateIcon/>}
                color="#f59e0b"
                title="Multilingual Support"
                desc="Access legal information in Hindi, Tamil, Bengali, Telugu, Marathi and 8 more Indian languages."
                badge="12 Languages"
                id="feat-lang"
              />
            </div>

            {/* Activity bar */}
            <div className="dash-activity">
              <div className="dash-activity-title">Live Activity</div>
              <div className="dash-activity-bars">
                {[72,45,88,60,95,55,80,43,90,65,78,52].map((h, i) => (
                  <div key={i} className="dash-bar-wrap">
                    <div className="dash-bar" style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
                  </div>
                ))}
              </div>
              <div className="dash-activity-labels">
                <span>2,341 queries today</span>
                <span style={{color:'#22d3ee'}}>↑ 18% from yesterday</span>
              </div>
            </div>
          </main>

          {/* ── Right Panel ── */}
          <aside className="dash-panel dash-panel--right">
            <div className="dash-panel-title">IPC Insights</div>
            <div className="insights-list">
              {INSIGHTS.map(ins => <InsightCard key={ins.ipc} {...ins}/>)}
            </div>

            <div style={{marginTop:16}}>
              <div className="dash-panel-title">Related Cases</div>
              <div className="related-cases">
                {[
                  {name:'Arnab Goswami v. Maharashtra',year:'2020',cat:'Bail'},
                  {name:'Nirbhaya Case',year:'2012',cat:'Criminal'},
                  {name:'Shreya Singhal v. UoI',year:'2015',cat:'IT Law'},
                ].map(c => (
                  <div key={c.name} className="related-case-item">
                    <div className="related-case-info">
                      <span className="related-case-name">{c.name}</span>
                      <span className="related-case-year">{c.year}</span>
                    </div>
                    <span className="related-case-cat">{c.cat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dash-ai-score">
              <div className="dash-ai-score-ring">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="8"/>
                  <circle cx="40" cy="40" r="34" fill="none" stroke="url(#scoreGrad)" strokeWidth="8"
                    strokeDasharray="213.6" strokeDashoffset="43" strokeLinecap="round"
                    style={{transform:'rotate(-90deg)',transformOrigin:'center'}}/>
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#06b6d4"/>
                      <stop offset="100%" stopColor="#6366f1"/>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="dash-ai-score-val">99%</div>
              </div>
              <div className="dash-ai-score-label">
                <div style={{color:'#f1f5f9',fontWeight:600,fontSize:'0.85rem'}}>AI Accuracy Score</div>
                <div style={{color:'#64748b',fontSize:'0.75rem'}}>Based on verified legal data</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ── Feature Card ── */
function FeatureCard({ icon, color, title, desc, badge, id }) {
  return (
    <div className="feat-card" id={id} style={{ '--feat-color': color }}>
      <div className="feat-card-header">
        <div className="feat-icon">{icon}</div>
        <span className="feat-badge">{badge}</span>
      </div>
      <h3 className="feat-title">{title}</h3>
      <p className="feat-desc">{desc}</p>
      <div className="feat-learn-more">
        Learn more
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
      </div>
    </div>
  );
}

/* ── Inline SVG Icons ── */
const AskAIIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/>
  </svg>
);
const IPCIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
  </svg>
);
const CaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);
const RightsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>
  </svg>
);
const AIBrainIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1-4-4 4 4 0 0 1 4-4 4 4 0 0 1 4-4z"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);
const VisualizeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 9 5 12 1.774-5.226L21 14 9 9z"/>
  </svg>
);
const CompareIconSvg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M8 3H2v18h6"/><path d="M16 3h6v18h-6"/><path d="M12 3v18"/>
  </svg>
);
const TranslateIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
  </svg>
);
