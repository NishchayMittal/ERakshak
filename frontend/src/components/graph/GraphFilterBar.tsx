import React from 'react';
import { useGraphStore } from '../../state/graphStore';
import { useTranslation } from 'react-i18next';

const sources = [
  { id: 'whois',               label: 'WHOIS/RDAP' },
  { id: 'dns_resolver',        label: 'DNS' },
  { id: 'crt.sh',             label: 'CRT.SH' },
  { id: 'wayback',            label: 'WAYBACK' },
  { id: 'sherlock',           label: 'SHERLOCK' },
  { id: 'github_commit_email', label: 'GIT COMMITS' },
  { id: 'breach_lookup',       label: 'BREACH SCAN' },
  { id: 'phone_lookup',        label: 'PHONE SCAN' },
  { id: 'wallet_lookup',       label: 'CRYPTO' },
  { id: 'face_matcher',        label: 'FACE MATCH' },
];

export default function GraphFilterBar() {
  const { t } = useTranslation();
  const { confidenceThreshold, setConfidenceThreshold, selectedSources, toggleSourceFilter } = useGraphStore();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16,
      padding: '8px 14px',
      background: '#080c10',
      border: '1px solid var(--struct-line)',
    }}>

      {/* Confidence threshold slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
        <span style={{
          fontFamily: 'var(--font-heading)', fontSize: 9,
          color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>
          {t('graph.confidence_threshold')}
        </span>
        <input
          type="range" min="0" max="1" step="0.05"
          value={confidenceThreshold}
          onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
        />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          color: 'var(--accent-primary)',
          background: 'var(--bg-1)', border: '1px solid var(--struct-line)',
          padding: '2px 6px', minWidth: 36, textAlign: 'center',
        }}>
          {Math.round(confidenceThreshold * 100)}%
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: 'var(--struct-line)', flexShrink: 0 }} />

      {/* Source filter toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--font-heading)', fontSize: 9,
          color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase',
          marginRight: 4, whiteSpace: 'nowrap',
        }}>
          {t('graph.source')}
        </span>
        {sources.map((src) => {
          const active = selectedSources.includes(src.id);
          return (
            <button
              key={src.id}
              onClick={() => toggleSourceFilter(src.id)}
              style={{
                padding: '4px 10px',
                background: active ? 'var(--accent-primary-dim)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--struct-line)'}`,
                color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-heading)', fontSize: 9,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.1s linear',
                boxShadow: active ? '0 0 4px rgba(0,255,194,0.2)' : 'none',
              }}
            >
              {src.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
