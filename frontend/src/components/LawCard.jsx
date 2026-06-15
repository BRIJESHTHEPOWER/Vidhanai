import React from 'react';
import { useNavigate } from 'react-router-dom';

const CATEGORY_LABELS = {
  crimes_against_body:      'Body Crime',
  crimes_against_women:     'Women Safety',
  crimes_against_property:  'Property Crime',
  crimes_against_children:  'Child Protection',
  cyber_crimes:             'Cyber Crime',
  rights_during_arrest:     'Arrest Rights',
  public_order:             'Public Order',
  offences_against_reputation: 'Reputation',
  general_provisions:       'General Law',
};

export default function LawCard({ law, onClick }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(law);
    } else if (law.id) {
      navigate(`/section/${law.id}`);
    }
  };

  const categoryLabel = CATEGORY_LABELS[law.category] || law.category || '';

  return (
    <div className="law-card" onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && handleClick()}>
      <div className="law-card-top">
        <div>
          <div className="law-sections">
            {law.ipc_section && (
              <span className="section-badge badge-ipc">IPC {law.ipc_section}</span>
            )}
            {law.bns_section && !law.bns_section.startsWith('IT_Act') && (
              <span className="section-badge badge-bns">BNS {law.bns_section}</span>
            )}
          </div>
        </div>
        {categoryLabel && (
          <span className="law-category-badge">{categoryLabel}</span>
        )}
      </div>

      <div className="law-card-title">{law.title}</div>

      {law.simple_explanation && (
        <div className="law-card-explanation">{law.simple_explanation}</div>
      )}

      {law.punishment && (
        <div className="law-card-punishment">
          <span>⚖️</span> {law.punishment}
        </div>
      )}

      <div className="law-bailable-row">
        {law.bailable !== undefined && (
          <span className={`bail-chip ${law.bailable ? 'bail-yes' : 'bail-no'}`}>
            {law.bailable ? '✓ Bailable' : '✗ Non-Bailable'}
          </span>
        )}
        {law.cognizable !== undefined && (
          <span className={`bail-chip ${law.cognizable ? 'cog-yes' : ''}`}
            style={!law.cognizable ? { background: 'rgba(148,163,184,0.1)', color: 'var(--text-dim)' } : {}}>
            {law.cognizable ? '🔍 Cognizable' : '○ Non-Cognizable'}
          </span>
        )}
      </div>
    </div>
  );
}
