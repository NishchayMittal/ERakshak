import React from 'react';

const NODE_TYPES = [
  { label: 'PERSON',   shape: 'circle',  color: 'var(--accent-primary)' },
  { label: 'DOMAIN',   shape: 'diamond', color: 'var(--accent-primary)' },
  { label: 'EMAIL',    shape: 'circle',  color: '#00E5FF' },
  { label: 'USERNAME', shape: 'circle',  color: '#00E5FF' },
  { label: 'PHONE',    shape: 'pentagon',color: 'var(--accent-secondary)' },
  { label: 'WALLET',   shape: 'hex',     color: 'var(--accent-secondary)' },
  { label: 'ORG',      shape: 'square',  color: 'var(--accent-primary)' },
  { label: 'FLAGGED',  shape: 'triangle',color: 'var(--accent-threat)' },
];

const EDGE_TYPES = [
  { label: 'VERIFIED LINK',    color: 'var(--accent-primary)' },
  { label: 'MEDIUM RISK',      color: 'var(--accent-secondary)' },
  { label: 'HIGH RISK / FLAGGED', color: 'var(--accent-threat)' },
];

function ShapeIcon({ shape, color }: { shape: string; color: string }) {
  const size = 10;
  if (shape === 'diamond') {
    return (
      <svg width={size + 2} height={size + 2} viewBox="0 0 12 12">
        <polygon points="6,0 12,6 6,12 0,6" fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  if (shape === 'square') {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12">
        <rect x="1" y="1" width="10" height="10" fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  if (shape === 'triangle') {
    return (
      <svg width={size + 2} height={size + 2} viewBox="0 0 12 12">
        <polygon points="6,1 12,11 0,11" fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
  // circle / pentagon / hex → circle for simplicity
  return (
    <svg width={size} height={size} viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="5" fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default function GraphLegend() {
  return (
    <div style={{
      padding: '8px 14px',
      background: '#080c10',
      border: '1px solid var(--struct-line)',
      display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap',
    }}>
      {/* Node types */}
      <div>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: 8, letterSpacing: '0.18em',
          color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6,
        }}>
          NODE TYPES
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
          {NODE_TYPES.map((t) => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShapeIcon shape={t.shape} color={t.color} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: 'var(--text-muted)', letterSpacing: '0.08em',
              }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--struct-line)', flexShrink: 0 }} />

      {/* Edge types */}
      <div>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: 8, letterSpacing: '0.18em',
          color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6,
        }}>
          EDGE RISK
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {EDGE_TYPES.map((e) => (
            <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 1, background: e.color, boxShadow: `0 0 4px ${e.color}` }} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 8,
                color: 'var(--text-muted)', letterSpacing: '0.06em',
              }}>{e.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
