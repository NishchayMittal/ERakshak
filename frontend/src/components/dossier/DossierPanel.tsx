import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGraphStore } from '../../state/graphStore';
import { useTransliterate } from '../ui/Transliterate';
import { BASE_URL } from '../../api/client';


// Animated risk gauge that counts up to the risk percentage
function RiskGauge({ pct }: { pct: number }) {
  const { t } = useTranslation();
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
        <span>{t('dossier.risk_score')}</span>
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
        <span>{t('dossier.low')}</span><span>{t('dossier.med')}</span><span>{t('dossier.high')}</span>
      </div>
    </div>
  );
}

// Field row with optional redaction blur and detail view callback
interface FieldProps {
  label: string;
  value: string;
  redacted?: boolean;
  payload?: Record<string, unknown>;
  onViewDetails?: (payload: Record<string, unknown>) => void;
}

function Field({ label, value, redacted = false, payload, onViewDetails }: FieldProps) {
  const { t } = useTranslation();
  const transliterate = useTransliterate();
  const [revealed, setRevealed] = useState(!redacted);
  
  const isLeak = label.toLowerCase() === 'leak_record';
  const isFaceMatch = label.toLowerCase() === 'face_similarity';

  return (
    <div style={{
      padding: '8px 0',
      borderBottom: '1px solid var(--struct-line)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: 8,
          color: 'var(--text-muted)', letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          {label.replace(/_/g, ' ')}
        </div>
        
        {isLeak && payload && onViewDetails && (
          <button
            onClick={() => onViewDetails(payload)}
            style={{
              background: 'rgba(244,63,94,0.1)',
              border: '1px solid rgba(244,63,94,0.3)',
              color: 'var(--accent-threat)',
              fontFamily: 'var(--font-heading)',
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: '0.15em',
              padding: '2px 6px',
              cursor: 'pointer',
              borderRadius: 2,
              transition: 'all 0.1s linear',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--accent-threat)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(244,63,94,0.1)';
              e.currentTarget.style.color = 'var(--accent-threat)';
            }}
          >
            {t('dossier.view_details')}
          </button>
        )}

        {isFaceMatch && payload && onViewDetails && (
          <button
            onClick={() => onViewDetails(payload)}
            style={{
              background: 'rgba(57,255,20,0.1)',
              border: '1px solid rgba(57,255,20,0.3)',
              color: '#39ff14',
              fontFamily: 'var(--font-heading)',
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: '0.15em',
              padding: '2px 6px',
              cursor: 'pointer',
              borderRadius: 2,
              transition: 'all 0.1s linear',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#39ff14';
              e.currentTarget.style.color = '#000000';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(57,255,20,0.1)';
              e.currentTarget.style.color = '#39ff14';
            }}
          >
            {t('dossier.view_match', 'VIEW MATCH')}
          </button>
        )}
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
          wordBreak: 'break-word',
        }}
        title={redacted && !revealed ? t('dossier.click_reveal') : undefined}
      >
        {transliterate(value || '—')}
      </div>
    </div>
  );
}

interface BreachRecord {
  breach?: string;
  email?: string;
  xposed_date?: string | number;
  exposed_records_count?: number;
  domain?: string;
  password_risk?: string;
  xposed_fields?: string[];
  description?: string;
}

function LeakRecordField({ payload }: { value: string; payload: Record<string, unknown> }) {
  const { t } = useTranslation();
  const transliterate = useTransliterate();
  const [expanded, setExpanded] = useState(false);
  
  const p = payload as BreachRecord & { leak_samples?: Array<{ email?: string; ip_address?: string; password?: string; phone?: string }> };
  const breach = p.breach || t('dossier.unknown');
  const year = p.xposed_date || "Unknown";
  const fields = p.xposed_fields || [];
  const risk = p.password_risk || "unknown";
  const desc = p.description || "";
  const domain = p.domain || "";
  const records = p.exposed_records_count || 0;
  const samples = p.leak_samples || [];

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--struct-line)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 700,
            color: 'var(--accent-threat)', letterSpacing: '0.05em',
            background: 'rgba(244,63,94,0.15)', padding: '2px 6px',
            border: '1px solid rgba(244,63,94,0.3)', borderRadius: 2
          }}>
            BREACH: {transliterate(breach).toUpperCase()}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            ({year})
          </span>
        </div>
        {risk !== 'unknown' && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 700,
            color: risk === 'plaintext' ? '#FF3B30' : risk === 'easytocrack' ? '#FF9500' : '#4CD964',
            border: `1px solid ${risk === 'plaintext' ? 'rgba(255,59,48,0.3)' : risk === 'easytocrack' ? 'rgba(255,149,0,0.3)' : 'rgba(76,217,100,0.3)'}`,
            padding: '1px 4px', borderRadius: 2, textTransform: 'uppercase',
            background: risk === 'plaintext' ? 'rgba(255,59,48,0.05)' : risk === 'easytocrack' ? 'rgba(255,149,0,0.05)' : 'rgba(76,217,100,0.05)'
          }}>
            {risk} PW
          </span>
        )}
      </div>

      {/* Exposed Fields (Tags) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
        {fields.map((field: string) => (
          <span key={field} style={{
            fontFamily: 'var(--font-mono)', fontSize: 8,
            padding: '2px 4px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-primary)',
            borderRadius: 2
          }}>
            {transliterate(field)}
          </span>
        ))}
      </div>

      {/* Collapsible description / extra stats */}
      {desc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
          <div 
            onClick={() => setExpanded(!expanded)}
            style={{
              fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--accent-primary)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
              userSelect: 'none'
            }}
          >
            {expanded ? t('dossier.hide_context') : t('dossier.view_context')}
          </div>
          
          {expanded && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
              lineHeight: 1.3, background: '#04070a', border: '1px solid var(--struct-line)',
              padding: 8, borderRadius: 2, wordBreak: 'break-word',
              display: 'flex', flexDirection: 'column', gap: 6
            }}>
              <div>{transliterate(desc)}</div>

              {/* Decrypted Raw Leak Samples */}
              {samples.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 7, color: 'var(--accent-threat)', letterSpacing: '0.05em', borderBottom: '1px solid rgba(244,63,94,0.2)', paddingBottom: 2 }}>
                    {t('dossier.raw_samples')}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(samples as Array<{ email?: string; ip_address?: string; password?: string; phone?: string }>).map((s, idx: number) => (
                      <div key={idx} style={{
                        background: 'rgba(255,255,255,0.02)', padding: 6, border: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'var(--font-mono)', fontSize: 8
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#ffffff' }}>{t('dossier.email_label')}{transliterate(s.email || '')}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{t('dossier.ip_label')}{s.ip_address}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#ff4d4d' }}>{t('dossier.pwd_label')}{s.password}</span>
                          <span style={{ color: '#ffffff' }}>{t('dossier.phone_label')}{transliterate(s.phone || '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
                <span>{t('dossier.records_label')}{Number(records).toLocaleString()}</span>
                {domain && (
                  <a href={`https://${domain}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                    {domain} ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default function DossierPanel() {
  const { t } = useTranslation();
  const transliterate = useTransliterate();
  const { evidencePack, selectedEntityId, loading } = useGraphStore();
  const [selectedBreach, setSelectedBreach] = useState<BreachRecord | null>(null);

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
        {t('dossier.select_node')}<br/>{t('dossier.load_dossier')}
      </div>
    );
  }

  // Resolve matching attributes from Evidence Pack
  let displayName = selectedEntityId;
  let attributes: Array<{ key: string; value: string; source: string; confidence: number; payload?: Record<string, unknown> }> = [];

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
      payload: (f.raw_payload || f.rawPayload || {}) as Record<string, unknown>,
    }));
  } else {
    // 2. Search inside child findings values or payloads
    for (const ident of evidencePack.identifiers) {
      const match = ident.findings.find(
        (f) =>
          f.value.toLowerCase() === selectedEntityId.toLowerCase() ||
          f.id === selectedEntityId ||
          (f.type === 'leak_record' && ((f.raw_payload as { breach?: string })?.breach || '').toLowerCase() === selectedEntityId.toLowerCase())
      );
      if (match) {
        displayName = (match.type === 'leak_record' && (match.raw_payload as { breach?: string })?.breach) 
          ? `Breach: ${(match.raw_payload as { breach?: string }).breach}` 
          : match.value;
        attributes = ident.findings
          .filter((f) =>
            f.value.toLowerCase() === match.value.toLowerCase() ||
            (f.type === 'leak_record' && (f.raw_payload as { breach?: string })?.breach === (match.raw_payload as { breach?: string })?.breach)
          )
          .map((f) => ({
            key: f.type,
            value: f.value,
            source: f.connector,
            confidence: f.confidence,
            payload: (f.raw_payload || f.rawPayload || {}) as Record<string, unknown>,
          }));
      }
    }
  }

  if (attributes.length === 0 && selectedEntityId) {
    const graphNode = useGraphStore.getState().graphData?.nodes.find((n) => n.id === selectedEntityId);
    if (graphNode) {
      displayName = graphNode.label || graphNode.id;
      attributes.push({
        key: 'entity_type',
        value: graphNode.type,
        source: 'correlation_engine',
        confidence: graphNode.confidence,
      });
      attributes.push({
        key: 'identifier_value',
        value: graphNode.label || graphNode.id,
        source: 'system',
        confidence: graphNode.confidence,
      });
    }
  }

  // Derive a fake risk score from the attribute count (demo)
  const riskPct = Math.min(95, 30 + attributes.length * 8);

  // Separate redacted vs normal fields for demo
  const fields = attributes.map((attr) => ({
    label: attr.key,
    value: attr.value,
    redacted: false,
    payload: attr.payload,
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
          {t('dossier.subject_dossier')}
          <span style={{ fontSize: 14, color: 'var(--accent-primary)', lineHeight: 1, transform: 'scaleX(-1)', display: 'inline-block' }}>⌐</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--text-primary)', marginTop: 4, fontWeight: 600,
          wordBreak: 'break-all',
        }}>
          {/\.(png|jpg|jpeg|webp|gif|bmp)(?:\?.*)?$/i.test(displayName) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img 
                src={displayName.startsWith('http') ? displayName : `${BASE_URL}/static/uploads/${displayName}`} 
                alt="Upload" 
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--accent-primary)' }} 
              />
              <span>{displayName.split(/[/\\]/).pop()}</span>
            </div>
          ) : transliterate(displayName)}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8,
          color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.08em',
        }}>
          {t('dossier.classification')}
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
            {t('dossier.no_attributes')}
          </div>
        ) : (
          fields.map((f, i) => {
            if (f.label.toLowerCase() === 'leak_record' && f.payload && f.payload.breach) {
              return (
                <LeakRecordField
                  key={`${f.label}-${i}`}
                  value={f.value}
                  payload={f.payload}
                />
              );
            }
            return (
              <Field
                key={`${f.label}-${i}`}
                label={f.label}
                value={f.value}
                redacted={f.redacted}
                payload={f.payload}
                onViewDetails={setSelectedBreach}
              />
            );
          })
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
        {t('dossier.dossier_status')}
      </div>

      {/* Breach Leak Details Inspection Modal */}
      {selectedBreach && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(4, 8, 14, 0.95)', border: '1px solid #ff3b30',
            padding: 20, width: 420, display: 'flex', flexDirection: 'column', gap: 14,
            boxShadow: '0 0 24px rgba(255,59,48,0.15)',
            backdropFilter: 'blur(12px)',
            animation: 'scale-up 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--struct-line)', paddingBottom: 8 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, color: '#ff3b30', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  BREACH REPORT: {transliterate(selectedBreach.breach || '')}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
                  TARGET EMAIL: {selectedBreach.email || ''}
                </div>
              </div>
              <button
                onClick={() => setSelectedBreach(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}
              >
                ✕
              </button>
            </div>

            {/* Grid Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: '#000000', border: '1px solid var(--struct-line)', padding: 10 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('dossier.date_exposure')}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 650, color: '#ffffff', marginTop: 2 }}>{selectedBreach.xposed_date || ''}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('dossier.records_exposed')}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 650, color: '#ffffff', marginTop: 2 }}>{Number(selectedBreach.exposed_records_count || 0).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('dossier.associated_domain')}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 650, color: '#ffffff', marginTop: 2 }}>
                  {selectedBreach.domain ? <a href={`https://${selectedBreach.domain}`} target="_blank" rel="noreferrer" style={{ color: '#39ff14', textDecoration: 'none' }}>{selectedBreach.domain}</a> : (t('dossier.na') || '')}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 7, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('dossier.password_security')}</div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
                  color: selectedBreach.password_risk === 'plaintext' ? '#FF3B30' : selectedBreach.password_risk === 'easytocrack' ? '#FF9500' : '#4CD964',
                  marginTop: 2, textTransform: 'uppercase'
                }}>
                  {selectedBreach.password_risk || ''}
                </div>
              </div>
            </div>

            {/* Exposed Fields */}
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 6 }}>{t('dossier.exposed_classes')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(selectedBreach.xposed_fields || []).map((field: string) => (
                  <span key={field} style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8,
                    padding: '2px 6px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--struct-line)', color: 'var(--text-primary)',
                    borderRadius: 2
                  }}>
                    {field}
                  </span>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>{t('dossier.breach_context')}</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)',
                lineHeight: 1.4, background: '#000000', border: '1px solid var(--struct-line)',
                padding: 10, overflowY: 'auto', maxHeight: 80, wordBreak: 'break-word'
              }}>
                {transliterate(selectedBreach.description || t('dossier.no_description') || '')}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
