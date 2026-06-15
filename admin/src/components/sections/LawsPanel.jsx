import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import './sections.css';

// ── Safe display helper — many dataset fields (punishment, bailable, …) can be
//    plain strings, arrays, or nested objects like {available, reason} or
//    {death_penalty, life_imprisonment, fine}. React can't render objects, so
//    flatten anything non-string into readable text. ───────────────────────────
function displayText(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(displayText).filter(Boolean).join(', ');
  if (typeof val === 'object') {
    return Object.entries(val)
      .filter(([, v]) => v != null && v !== '' && v !== false)
      .map(([k, v]) => {
        const label = k.replace(/_/g, ' ');
        const inner = displayText(v);
        // For boolean-ish flags (true), just show the label
        return v === true ? label : `${label}: ${inner}`;
      })
      .filter(Boolean)
      .join('; ');
  }
  return String(val);
}

// ── Shared form fields for both BNS and IPC ───────────────────────────────────
const EMPTY_FORM = {
  title: '', description: '', section_number: '',
  ipc_section: '', bns_section: '', category: 'General', chapter: '',
  punishment: '', bns_punishment: '', bailable: '', cognizable: '',
  keywords: '', simple_explanation: '', real_life_example: '',
};

function lawToForm(law) {
  return {
    ...EMPTY_FORM,
    ...law,
    keywords: Array.isArray(law.keywords) ? law.keywords.join(', ') : (law.keywords || ''),
    // Flatten any object-valued fields so the text inputs receive strings
    punishment:         displayText(law.punishment),
    bns_punishment:     displayText(law.bns_punishment),
    bailable:           typeof law.bailable === 'string' ? law.bailable : displayText(law.bailable),
    cognizable:         typeof law.cognizable === 'string' ? law.cognizable : displayText(law.cognizable),
    description:        displayText(law.description),
    simple_explanation: displayText(law.simple_explanation),
    real_life_example:  displayText(law.real_life_example),
    category:           displayText(law.category) || 'General',
    chapter:            displayText(law.chapter),
  };
}

function formToPayload(form) {
  return {
    ...form,
    keywords: form.keywords
      ? form.keywords.split(',').map(k => k.trim()).filter(Boolean)
      : [],
  };
}

// ── Law Form Modal ─────────────────────────────────────────────────────────────
function LawModal({ law, source, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => law ? lawToForm(law) : { ...EMPTY_FORM });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(formToPayload(form));
  };

  const isBns = source === 'bns';

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div className="adm-modal adm-modal--wide" onClick={e => e.stopPropagation()}>
        <div className="adm-modal-header">
          <span className="adm-modal-title">
            {law ? 'Edit' : 'Add'}&nbsp;
            <span style={{ color: isBns ? '#22c55e' : '#60a5fa' }}>{source.toUpperCase()}</span>
            &nbsp;Law
          </span>
          <button className="adm-modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="adm-modal-body">
            {/* Row 1 */}
            <div className="adm-form-row">
              <div className="adm-form-group adm-form-group--full">
                <label>Title *</label>
                <input required value={form.title} onChange={e => set('title', e.target.value)}
                  placeholder="e.g. Punishment for Murder" />
              </div>
            </div>

            {/* Row 2 — section numbers */}
            <div className="adm-form-row">
              <div className="adm-form-group">
                <label>Section Number</label>
                <input value={form.section_number} onChange={e => set('section_number', e.target.value)}
                  placeholder="e.g. 103" />
              </div>
              {isBns ? (
                <div className="adm-form-group">
                  <label>BNS Section</label>
                  <input value={form.bns_section} onChange={e => set('bns_section', e.target.value)}
                    placeholder="e.g. 103" />
                </div>
              ) : (
                <div className="adm-form-group">
                  <label>IPC Section</label>
                  <input value={form.ipc_section} onChange={e => set('ipc_section', e.target.value)}
                    placeholder="e.g. 302" />
                </div>
              )}
              <div className="adm-form-group">
                <label>Category</label>
                <input value={form.category} onChange={e => set('category', e.target.value)}
                  placeholder="e.g. Offences Against Body" />
              </div>
              <div className="adm-form-group">
                <label>Chapter</label>
                <input value={form.chapter} onChange={e => set('chapter', e.target.value)}
                  placeholder="Chapter name" />
              </div>
            </div>

            {/* Row 3 — punishment */}
            <div className="adm-form-row">
              <div className="adm-form-group">
                <label>Punishment</label>
                <input value={form.punishment} onChange={e => set('punishment', e.target.value)}
                  placeholder="e.g. Death or imprisonment for life" />
              </div>
              <div className="adm-form-group">
                <label>Bailable</label>
                <select value={form.bailable} onChange={e => set('bailable', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                  <option value="Depends">Depends</option>
                </select>
              </div>
              <div className="adm-form-group">
                <label>Cognizable</label>
                <select value={form.cognizable} onChange={e => set('cognizable', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            {/* Keywords */}
            <div className="adm-form-group">
              <label>Keywords <span style={{ color: '#475569', fontWeight: 400 }}>(comma-separated)</span></label>
              <input value={form.keywords} onChange={e => set('keywords', e.target.value)}
                placeholder="e.g. murder, homicide, death" />
            </div>

            {/* Description */}
            <div className="adm-form-group">
              <label>Description *</label>
              <textarea required rows={3} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Full text of the law section..." />
            </div>

            {/* Simple explanation */}
            <div className="adm-form-group">
              <label>Simple Explanation</label>
              <textarea rows={2} value={form.simple_explanation} onChange={e => set('simple_explanation', e.target.value)}
                placeholder="Plain-language explanation for students..." />
            </div>

            {/* Real life example */}
            <div className="adm-form-group">
              <label>Real-Life Example</label>
              <textarea rows={2} value={form.real_life_example} onChange={e => set('real_life_example', e.target.value)}
                placeholder="Scenario-based example..." />
            </div>
          </div>

          <div className="adm-modal-footer">
            <button type="button" className="adm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="adm-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : law ? `Update ${source.toUpperCase()} Law` : `Create ${source.toUpperCase()} Law`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Law Table (shared for BNS and IPC) ────────────────────────────────────────
function LawTable({ source, token }) {
  const isBns = source === 'bns';

  const [data,      setData]      = useState({ laws: [], total: 0, pages: 1 });
  const [page,      setPage]      = useState(1);
  const [searchVal, setSearchVal] = useState('');
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);   // null | 'add' | law-obj
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(null);

  const load = useCallback(async (p = page, q = search) => {
    setLoading(true);
    try {
      const res = isBns
        ? await api.laws(p, 20, q)
        : await api.ipcLaws(p, 20, q);
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, isBns]);

  useEffect(() => { setPage(1); setSearch(''); setSearchVal(''); load(1, ''); }, [source]);
  useEffect(() => { load(page, search); }, [page, search]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchVal); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchVal]);

  const openAdd  = ()    => setModal('add');
  const openEdit = (law) => setModal(law);
  const closeModal = ()  => { setModal(null); setSaving(false); };

  const handleSave = async (payload) => {
    setSaving(true);
    try {
      if (modal && modal !== 'add') {
        isBns
          ? await api.updateLaw(modal.id, payload)
          : await api.updateIpcLaw(modal.id, payload);
      } else {
        isBns
          ? await api.createLaw(payload)
          : await api.createIpcLaw(payload);
      }
      closeModal();
      load(page, search);
    } catch (err) { alert(err.message); setSaving(false); }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      isBns ? await api.deleteLaw(id) : await api.deleteIpcLaw(id);
      load(page, search);
    } catch (err) { alert(err.message); }
    finally { setDeleting(null); }
  };

  const secKey   = isBns ? 'bns_section' : 'ipc_section';
  const secLabel = isBns ? 'BNS §'       : 'IPC §';
  const badgeCls = isBns ? 'adm-badge--green' : 'adm-badge--blue';

  return (
    <>
      {modal && (
        <LawModal
          law={modal === 'add' ? null : modal}
          source={source}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
        />
      )}

      {/* Toolbar */}
      <div className="adm-toolbar" style={{ marginBottom: 16 }}>
        <div className="adm-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder={`Search ${source.toUpperCase()} laws…`}
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
          />
        </div>
        <span className="laws-count">{data.total} laws</span>
        <button className="adm-btn-primary" onClick={openAdd}>
          ➕ Add {source.toUpperCase()} Law
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /><p>Loading…</p></div>
      ) : data.laws.length === 0 ? (
        <div className="adm-empty">
          <div className="adm-empty-icon">{isBns ? '📗' : '📘'}</div>
          <h3>No {source.toUpperCase()} laws found</h3>
          <p>Try a different search or add a new law.</p>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{secLabel}</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Bailable</th>
                  <th>Punishment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.laws.map(law => (
                  <tr key={law.id}>
                    <td>
                      <span className={`adm-badge ${badgeCls}`}>
                        {displayText(law[secKey]) || displayText(law.section_number) || '—'}
                      </span>
                    </td>
                    <td className="laws-title-cell" title={law.title}>{law.title}</td>
                    <td>
                      <span className="adm-badge adm-badge--amber">
                        {displayText(law.category) || displayText(law.chapter) || 'General'}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const bail = displayText(law.bailable);
                        const cls  = bail === 'Yes' ? 'adm-badge--green'
                                   : bail === 'No'  ? 'adm-badge--red'
                                   : 'adm-badge--muted';
                        return <span className={`adm-badge ${cls}`} title={bail}>{bail || '—'}</span>;
                      })()}
                    </td>
                    <td className="laws-punishment-cell">
                      {(() => {
                        const pun = displayText(law.punishment);
                        if (!pun) return '—';
                        return pun.length > 55 ? pun.slice(0, 55) + '…' : pun;
                      })()}
                    </td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-icon-btn" title="Edit" onClick={() => openEdit(law)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                        </button>
                        <button className="adm-delete-btn" title="Delete"
                          disabled={deleting === law.id}
                          onClick={() => handleDelete(law.id, law.title)}>
                          {deleting === law.id
                            ? <div className="adm-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="adm-pagination">
              <span>
                Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}
              </span>
              <div className="adm-pagination-btns">
                <button className="adm-pag-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    className={`adm-pag-btn${p === page ? ' adm-pag-btn--active' : ''}`}
                    onClick={() => setPage(p)}
                  >{p}</button>
                ))}
                <button className="adm-pag-btn" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ── Main LawsPanel ────────────────────────────────────────────────────────────
export default function LawsPanel() {
  const [summary, setSummary] = useState(null);
  const [tab,     setTab]     = useState('bns');   // 'bns' | 'ipc'

  useEffect(() => {
    api.lawsSummary()
      .then(setSummary)
      .catch(() => setSummary({ bns: { total: 0 }, ipc: { total: 0 }, grand_total: 0 }));
  }, []);

  const bnsTotal   = summary?.bns?.total      ?? 0;
  const ipcTotal   = summary?.ipc?.total      ?? 0;
  const grandTotal = summary?.grand_total     ?? (bnsTotal + ipcTotal);
  const bnsCats    = Object.keys(summary?.bns?.by_category || {}).length;
  const ipcCats    = Object.keys(summary?.ipc?.by_category || {}).length;

  return (
    <div>
      <div className="sec-header">
        <h1 className="sec-title">Laws Database</h1>
        <p className="sec-sub">Manage and update IPC and BNS law records</p>
      </div>

      {/* Summary cards */}
      <div className="stat-grid laws-stat-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-card-glow" style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }} />
          <div className="stat-card-icon" style={{ background: '#6366f118', border: '1px solid #6366f130' }}>📚</div>
          <div className="stat-card-value gradient-text">{grandTotal.toLocaleString()}</div>
          <div className="stat-card-label">Total Laws</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setTab('bns')}>
          <div className="stat-card-glow" style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)' }} />
          <div className="stat-card-icon" style={{ background: '#22c55e18', border: '1px solid #22c55e30' }}>📗</div>
          <div className="stat-card-value" style={{ color: '#22c55e' }}>{bnsTotal.toLocaleString()}</div>
          <div className="stat-card-label">BNS 2023 Laws</div>
          <div className="stat-card-sub">{bnsCats} categories</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setTab('ipc')}>
          <div className="stat-card-glow" style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }} />
          <div className="stat-card-icon" style={{ background: '#3b82f618', border: '1px solid #3b82f630' }}>📘</div>
          <div className="stat-card-value" style={{ color: '#60a5fa' }}>{ipcTotal.toLocaleString()}</div>
          <div className="stat-card-label">IPC 1860 Laws</div>
          <div className="stat-card-sub">{ipcCats} categories</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="laws-tabs">
        <button
          className={`laws-tab ${tab === 'bns' ? 'laws-tab--active laws-tab--bns' : ''}`}
          onClick={() => setTab('bns')}
        >
          <span className="laws-tab-dot laws-tab-dot--bns" />
          📗 BNS 2023
          <span className="laws-tab-count">{bnsTotal}</span>
        </button>
        <button
          className={`laws-tab ${tab === 'ipc' ? 'laws-tab--active laws-tab--ipc' : ''}`}
          onClick={() => setTab('ipc')}
        >
          <span className="laws-tab-dot laws-tab-dot--ipc" />
          📘 IPC 1860
          <span className="laws-tab-count">{ipcTotal}</span>
        </button>
      </div>

      {/* Panel box */}
      <div className="panel-box">
        <LawTable key={tab} source={tab} />
      </div>
    </div>
  );
}
