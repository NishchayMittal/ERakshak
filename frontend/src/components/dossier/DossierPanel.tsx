import React, { useEffect, useRef, useState } from 'react';
import { useGraphStore } from '../../state/graphStore';

// Animated risk gauge that counts up to the risk percentage
function RiskGauge({ pct }: { pct: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * pct));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [pct]);

  const color = pct > 70 ? 'var(--accent-threat)' : pct > 40 ? 'var(--accent-secondary)' : '#00C853';
  const gradientStops =
    pct > 70 ? '#00C853, #FFB800, #FF0044' :
    pct > 40 ? '#00C853, #FFB800' :
    '#00C853';

  return (
    <div style={{ marginTop: 12 }}>
      {/* Header row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 6,
        fontFamily: 'var(--font-heading)', fontSize: 9,
        letterSpacing: '0.15em', textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>
        <span>RISK SCORE</span>
        <span style={{ color, fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {display}<span style={{ fontSize: 9, marginLeft: 1 }}>%</span>
        </span>
      </div>
      {/* Track */}
      <div style={{
        height: 6, background: '#0D1117',
        border: '1px solid var(--struct-line)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Fill */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          height: '100%',
          width: `${display}%`,
          background: `linear-gradient(90deg, ${gradientStops})`,
          boxShadow: `0 0 6px ${color}`,
          transition: 'width 0.05s linear',
        }} />
      </div>
      {/* Scale labels */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)', fontSize: 7,
        color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.05em',
      }}>
        <span>LOW</span><span>MED</span><span>HIGH</span>
      </div>
    </div>
  );
}

// Field row with optional redaction blur
interface FieldProps {
  label: string;
  value: string;
  redacted?: boolean;
}

function Field({ label, value, redacted = false }: FieldProps) {
  const [revealed, setRevealed] = useState(!redacted);

  return (
    <div style={{
      padding: '6px 0',
      borderBottom: '1px solid var(--struct-line)',
    }}>
      <div style={{
        fontFamily: 'var(--font-heading)', fontSize: 8,
        color: 'var(--text-muted)', letterSpacing: '0.15em',
        textTransform: 'uppercase', marginBottom: 2,
      }}>
        {label}
      </div>
      <div
        onClick={() => redacted && setRevealed((v) => !v)}
        style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-primary)',
          filter: revealed ? 'none' : 'blur(5px)',
          cursor: redacted ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'filter 0.2s',
          letterSpacing: '0.02em',
        }}
        title={redacted && !revealed ? 'Click to reveal' : undefined}
      >
        {value || '—'}
      </div>
    </div>
  );
}

export default function DossierPanel() {
  const { evidencePack, selectedEntityId, loading } = useGraphStore();

  if (loading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ height: 36, background: 'var(--bg-1)', border: '1px solid var(--struct-line)', animation: 'blink 1.5s step-start infinite' }} />
        ))}
      </div>
    );
  }

  if (!selectedEntityId || !evidencePack) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 12, padding: 24,
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        {/* Mini reticle icon */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '1px solid var(--struct-line)', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--struct-line)' }} />
        </div>
        SELECT A NODE TO<br/>LOAD SUBJECT DOSSIER
      </div>
    );
  }

  // Resolve matching attributes from Evidence Pack
  let displayName = selectedEntityId;
  let attributes: Array<{ key: string; value: string; source: string; confidence: number }> = [];

  // 1. Direct match on identifier values
  const activeIdentifier = evidencePack.identifiers.find(
    (i) => i.id === selectedEntityId || (i.normalizedValue || i.normalized_value || '').toLowerCase() === selectedEntityId.toLowerCase()
  );

  if (activeIdentifier) {
    displayName = activeIdentifier.normalizedValue || activeIdentifier.normalized_value || '';
    attributes = activeIdentifier.findings.map((f) => ({
      key: f.type,
      value: f.value,
      source: f.connector,
      confidence: f.confidence,
    }));
  } else {
    // 2. Search inside child findings values
    for (const ident of evidencePack.identifiers) {
      const match = ident.findings.find(
        (f) => f.value.toLowerCase() === selectedEntityId.toLowerCase() || f.id === selectedEntityId
      );
      if (match) {
        displayName = match.value;
        attributes = ident.findings
          .filter((f) => f.value.toLowerCase() === match.value.toLowerCase())
          .map((f) => ({
            key: f.type,
            value: f.value,
            source: f.connector,
            confidence: f.confidence,
          }));
        break;
      }
    }
  }

  // Derive a fake risk score from the attribute count (demo)
  const riskPct = Math.min(95, 30 + attributes.length * 8);

  // Separate redacted vs normal fields for demo
  const fields = attributes.map((attr, i) => ({
    label: attr.key,
    value: attr.value,
    redacted: i > 2, // blur after first 3 attributes
  }));

  return (
    <div style={{ padding: '0 0 12px 0', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Dossier header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--struct-line)',
        background: '#030609',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: 10,
          color: 'var(--accent-primary)', letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* Bracket corner */}
          <span style={{ fontSize: 14, color: 'var(--accent-primary)', lineHeight: 1 }}>⌐</span>
          SUBJECT DOSSIER
          <span style={{ fontSize: 14, color: 'var(--accent-primary)', lineHeight: 1, transform: 'scaleX(-1)', display: 'inline-block' }}>⌐</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-primary)', marginTop: 4, fontWeight: 600,
          wordBreak: 'break-all',
        }}>
          {displayName}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8,
          color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.08em',
        }}>
          CLASSIFICATION: RESTRICTED // ACCESS LEVEL 5
        </div>
      </div>

      {/* Risk gauge */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--struct-line)', flexShrink: 0 }}>
        <RiskGauge pct={riskPct} />
      </div>

      {/* Attributes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px' }}>
        {fields.length === 0 ? (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center',
            letterSpacing: '0.1em',
          }}>
            NO ATTRIBUTES INDEXED
          </div>
        ) : (
          fields.map((f, i) => (
            <Field key={`${f.label}-${i}`} label={f.label} value={f.value} redacted={f.redacted} />
          ))
        )}
      </div>

      {/* Footer stamp */}
      <div style={{
        padding: '8px 14px 0 14px',
        borderTop: '1px solid var(--struct-line)',
        fontFamily: 'var(--font-mono)', fontSize: 8,
        color: 'var(--text-muted)', letterSpacing: '0.08em',
        flexShrink: 0,
      }}>
        REDACTED FIELDS: CLICK TO REVEAL // AUDIT LOGGED
      </div>
    </div>
  );
}
