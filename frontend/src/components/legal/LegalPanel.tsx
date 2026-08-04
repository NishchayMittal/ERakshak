import React, { useEffect, useState, useCallback } from 'react';
import { Scale, ShieldAlert, AlertTriangle, Info, ChevronDown, ChevronUp, RefreshCw, Download } from 'lucide-react';
import { getLegalMapping } from '../../api/endpoints';
import type { LegalFlag, LegalMappingResult } from '../../api/endpoints';

interface LegalPanelProps {
  caseId: string;
}

const SEVERITY_CONFIG = {
  CRITICAL: { color: '#ff2d55', bg: 'rgba(255,45,85,0.1)', border: 'rgba(255,45,85,0.4)', glow: '0 0 12px rgba(255,45,85,0.3)' },
  HIGH:     { color: '#ff9500', bg: 'rgba(255,149,0,0.08)', border: 'rgba(255,149,0,0.35)', glow: '0 0 8px rgba(255,149,0,0.2)' },
  MEDIUM:   { color: '#ffd60a', bg: 'rgba(255,214,10,0.06)', border: 'rgba(255,214,10,0.3)', glow: 'none' },
  LOW:      { color: '#00ffc2', bg: 'rgba(0,255,194,0.04)', border: 'rgba(0,255,194,0.2)', glow: 'none' },
};

const ACT_CONFIG = {
  'IT Act 2000': { color: '#00ffc2', short: 'ITA' },
  'BNS 2023':    { color: '#a78bfa', short: 'BNS' },
  'PMLA 2002':   { color: '#fb923c', short: 'PMLA' },
};

function SeverityBadge({ severity }: { severity: LegalFlag['severity'] }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 8,
      fontWeight: 900,
      letterSpacing: '0.15em',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      padding: '2px 7px',
      flexShrink: 0,
      boxShadow: cfg.glow,
    }}>
      {severity}
    </span>
  );
}

function ActBadge({ act }: { act: LegalFlag['act'] }) {
  const cfg = ACT_CONFIG[act];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: '0.1em',
      color: cfg.color,
      border: `1px solid ${cfg.color}40`,
      padding: '2px 6px',
      flexShrink: 0,
    }}>
      {cfg.short}
    </span>
  );
}

function LegalCard({ flag, index }: { flag: LegalFlag; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[flag.severity];

  return (
    <div style={{
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      boxShadow: cfg.glow,
      transition: 'all 0.15s',
      marginBottom: 8,
    }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Index number */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          minWidth: 18,
          flexShrink: 0,
        }}>
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Section tag */}
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 10,
          fontWeight: 800,
          color: cfg.color,
          letterSpacing: '0.08em',
          minWidth: 100,
          flexShrink: 0,
        }}>
          {flag.section}
        </span>

        {/* Title */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-primary)',
          flex: 1,
          fontWeight: 600,
        }}>
          {flag.title}
        </span>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ActBadge act={flag.act} />
          <SeverityBadge severity={flag.severity} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-muted)',
            minWidth: 40,
            textAlign: 'right',
          }}>
            {Math.round(flag.confidence * 100)}%
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{
          padding: '0 14px 14px 42px',
          borderTop: `1px solid ${cfg.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {/* Description */}
          <div style={{ paddingTop: 12 }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              LEGAL PROVISION
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-primary)',
              lineHeight: 1.6,
              margin: 0,
            }}>
              {flag.description}
            </p>
          </div>

          {/* Punishment */}
          <div style={{
            display: 'flex',
            gap: 20,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                PUNISHMENT
              </div>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: cfg.color,
                margin: 0,
                lineHeight: 1.5,
              }}>
                {flag.punishment}
              </p>
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                BAIL STATUS
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                color: flag.bailable ? '#00ffc2' : '#ff2d55',
              }}>
                {flag.bailable ? '✓ BAILABLE' : '✗ NON-BAILABLE'}
              </span>
            </div>
          </div>

          {/* Investigator note */}
          {flag.notes && (
            <div style={{
              background: 'rgba(0,255,194,0.04)',
              border: '1px solid rgba(0,255,194,0.15)',
              padding: '8px 12px',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}>
              <Info size={11} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}>
                {flag.notes}
              </span>
            </div>
          )}

          {/* Evidence citations */}
          {flag.triggered_by.length > 0 && (
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                EVIDENCE CITATIONS ({flag.triggered_by.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {flag.triggered_by.map((ev, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 10px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: '#a78bfa',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                      minWidth: 100,
                    }}>
                      [{ev.connector}]
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--text-primary)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {ev.value}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                    }}>
                      {Math.round(ev.confidence * 100)}% conf
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LegalPanel({ caseId }: LegalPanelProps) {
  const [result, setResult] = useState<LegalMappingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLegalMapping(caseId);
      setResult(data);
    } catch {
      setError('Failed to run legal mapping. Ensure findings have been collected first.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredFlags = result?.flags.filter(f =>
    filter === 'ALL' || f.severity === filter || f.act === filter
  ) ?? [];

  const exportLegal = () => {
    if (!result) return;
    const text = result.flags.map(f =>
      `${f.section} — ${f.title} [${f.act}]\nSeverity: ${f.severity} | Confidence: ${Math.round(f.confidence * 100)}%\nPunishment: ${f.punishment}\nEvidence: ${f.triggered_by.map(e => `${e.connector}: ${e.value}`).join('; ')}\n`
    ).join('\n─────────────────────────────────────\n');
    const blob = new Blob([`e-Rakshak Legal Section Mapping — Case ${caseId}\n${'═'.repeat(60)}\n\n${result.summary}\n\n${'═'.repeat(60)}\n\n${text}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legal_mapping_${caseId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-0)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--struct-line)',
        background: '#060a0f',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Scale size={14} color="var(--accent-primary)" />
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--accent-primary)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}>
              INDIAN LEGAL SECTION MAPPING
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              marginTop: 2,
              letterSpacing: '0.05em',
            }}>
              IT Act 2000 · Bharatiya Nyaya Sanhita 2023 · PMLA 2002
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={exportLegal}
            disabled={!result || result.total_flags === 0}
            style={{
              background: 'transparent',
              border: '1px solid var(--struct-line)',
              color: 'var(--text-muted)',
              cursor: result && result.total_flags > 0 ? 'pointer' : 'not-allowed',
              padding: '5px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              opacity: result && result.total_flags > 0 ? 1 : 0.4,
            }}
          >
            <Download size={10} /> EXPORT
          </button>
          <button
            onClick={load}
            disabled={loading}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: '5px 10px',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={10} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'SCANNING...' : 'RE-SCAN'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !result && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          <ShieldAlert size={32} color="var(--accent-primary)" style={{ opacity: 0.6, animation: 'intro-live-pulse 1.2s ease infinite' }} />
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            ANALYSING FINDINGS AGAINST LEGAL DATABASE...
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            IT Act 2000 · BNS 2023 · PMLA 2002
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          margin: 16,
          padding: '12px 16px',
          border: '1px solid rgba(255,45,85,0.4)',
          background: 'rgba(255,45,85,0.08)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}>
          <AlertTriangle size={14} color="#ff2d55" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff2d55' }}>
            {error}
          </span>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary bar */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid var(--struct-line)',
            background: 'var(--bg-1)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', flex: 1 }}>
              {result.summary}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {result.critical_count > 0 && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: '#ff2d55',
                  border: '1px solid rgba(255,45,85,0.4)',
                  padding: '3px 10px',
                  fontWeight: 700,
                  background: 'rgba(255,45,85,0.1)',
                }}>
                  {result.critical_count} CRITICAL
                </div>
              )}
              {result.high_count > 0 && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: '#ff9500',
                  border: '1px solid rgba(255,149,0,0.35)',
                  padding: '3px 10px',
                  fontWeight: 700,
                  background: 'rgba(255,149,0,0.08)',
                }}>
                  {result.high_count} HIGH
                </div>
              )}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--text-muted)',
                border: '1px solid var(--struct-line)',
                padding: '3px 10px',
              }}>
                {result.total_flags} TOTAL
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid var(--struct-line)',
            background: '#060a0f',
            flexShrink: 0,
            padding: '0 16px',
          }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'IT Act 2000', 'BNS 2023', 'PMLA 2002'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: filter === f ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: filter === f ? 'var(--accent-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: filter === f ? 700 : 400,
                  letterSpacing: '0.1em',
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  transition: 'color 0.15s, border-color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Flags list */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
          }}>
            {filteredFlags.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 0',
                gap: 12,
                color: 'var(--text-muted)',
              }}>
                <Scale size={28} style={{ opacity: 0.3 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em' }}>
                  NO FLAGS FOR SELECTED FILTER
                </span>
              </div>
            ) : (
              filteredFlags.map((flag, i) => (
                <LegalCard key={`${flag.act}-${flag.section}`} flag={flag} index={i} />
              ))
            )}
          </div>

          {/* Disclaimer footer */}
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--struct-line)',
            background: '#060a0f',
            flexShrink: 0,
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              color: 'var(--text-muted)',
              margin: 0,
              letterSpacing: '0.06em',
              lineHeight: 1.5,
              opacity: 0.7,
            }}>
              ⚠ DISCLAIMER: This legal mapping is AI-assisted and indicative only. It does not constitute legal advice.
              All flagged provisions should be reviewed by a qualified legal professional before use in FIR filing or prosecution.
              Confidence scores reflect OSINT evidence strength, not judicial determination of guilt.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
