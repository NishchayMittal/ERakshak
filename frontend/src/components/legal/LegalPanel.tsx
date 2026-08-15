import React, { useEffect, useState, useCallback } from 'react';
import { Scale, ShieldAlert, AlertTriangle, Info, ChevronDown, ChevronUp, RefreshCw, Download } from 'lucide-react';
import { getLegalMapping } from '../../api/endpoints';
import type { LegalFlag, LegalMappingResult } from '../../api/endpoints';
import { useTransliterate } from '../ui/Transliterate';
import { useTranslation } from 'react-i18next';

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
      fontSize: "calc(8px * var(--font-scale))",
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
      fontSize: "calc(8px * var(--font-scale))",
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
  const transliterate = useTransliterate();
  const { t } = useTranslation();
  const cfg = SEVERITY_CONFIG[flag.severity];

  const getSectionKey = (act: string, section: string) => {
    const cleanAct = act.replace(' Act ', '_').replace(' ', '_');
    const cleanSection = section.replace('Section ', '').replace('(', '_').replace(')', '');
    return `${cleanAct.split('_')[0]}_${cleanSection}`;
  };

  const key = getSectionKey(flag.act, flag.section);

  const getTranslated = (field: 'title' | 'desc' | 'punish', defaultValue: string) => {
    const tKey = `legal.sections.${key}_${field}`;
    const val = t(tKey);
    return val && val !== tKey ? val : transliterate(defaultValue);
  };

  const translateNote = (note: string) => {
    if (!note) return '';
    if (note.includes("Subject's data was found in a breach")) {
      return t('legal.notes.breach');
    }
    if (note.includes("Leaked passwords/credentials")) {
      return t('legal.notes.creds');
    }
    if (note.includes("Cryptocurrency wallet with significant transaction")) {
      return t('legal.notes.crypto');
    }
    if (note.includes("Subdomain name pattern strongly suggests")) {
      return t('legal.notes.phish_domain');
    }
    if (note.includes("Phishing subdomains indicate")) {
      return t('legal.notes.phish_fraud');
    }
    if (note.includes("Known CVEs on the target")) {
      return t('legal.notes.cve');
    }
    if (note.includes("Publicly accessible cloud storage")) {
      return t('legal.notes.bucket');
    }
    if (note.includes("Historical snapshots showing")) {
      return t('legal.notes.wayback');
    }
    return transliterate(note);
  };

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
          fontSize: "calc(9px * var(--font-scale))",
          color: 'var(--text-muted)',
          minWidth: 18,
          flexShrink: 0,
        }}>
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Section tag */}
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: "calc(10px * var(--font-scale))",
          fontWeight: 800,
          color: cfg.color,
          letterSpacing: '0.08em',
          minWidth: 100,
          flexShrink: 0,
        }}>
          {flag.section.replace('Section', t('legal.section_prefix', 'Section'))}
        </span>

        {/* Title */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: "calc(11px * var(--font-scale))",
          color: 'var(--text-primary)',
          flex: 1,
          fontWeight: 600,
        }}>
          {getTranslated('title', flag.title)}
        </span>

        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ActBadge act={flag.act} />
          <SeverityBadge severity={flag.severity} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: "calc(9px * var(--font-scale))",
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
              fontSize: "calc(9px * var(--font-scale))",
              color: 'var(--text-muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              {t('legal.provision', 'LEGAL PROVISION')}
            </div>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: "calc(11px * var(--font-scale))",
              color: 'var(--text-primary)',
              lineHeight: 1.6,
              margin: 0,
            }}>
              {getTranslated('desc', flag.description)}
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
                fontSize: "calc(9px * var(--font-scale))",
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                {t('legal.punishment', 'PUNISHMENT')}
              </div>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: "calc(10px * var(--font-scale))",
                color: cfg.color,
                margin: 0,
                lineHeight: 1.5,
              }}>
                {getTranslated('punish', flag.punishment)}
              </p>
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: "calc(9px * var(--font-scale))",
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                {t('legal.bail_status', 'BAIL STATUS')}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: "calc(10px * var(--font-scale))",
                fontWeight: 700,
                color: flag.bailable ? '#00ffc2' : '#ff2d55',
              }}>
                {flag.bailable ? t('legal.bailable', '✓ BAILABLE') : t('legal.non_bailable', '✗ NON-BAILABLE')}
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
                fontSize: "calc(10px * var(--font-scale))",
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}>
                {translateNote(flag.notes)}
              </span>
            </div>
          )}

          {/* Evidence citations */}
          {flag.triggered_by.length > 0 && (
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: "calc(9px * var(--font-scale))",
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
                      fontSize: "calc(8px * var(--font-scale))",
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
                      fontSize: "calc(9px * var(--font-scale))",
                      color: 'var(--text-primary)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {transliterate(ev.value)}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: "calc(8px * var(--font-scale))",
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
  const transliterate = useTransliterate();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLegalMapping(caseId);
      setResult(data);
    } catch {
      setError(t('legal.failed_mapping', 'Failed to run legal mapping. Ensure findings have been collected first.'));
    } finally {
      setLoading(false);
    }
  }, [caseId, t]);

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
    const blob = new Blob([`Orion Legal Section Mapping — Case ${caseId}\n${'═'.repeat(60)}\n\n${result.summary}\n\n${'═'.repeat(60)}\n\n${text}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legal_mapping_${caseId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSummaryText = () => {
    if (!result) return '';
    if (result.critical_count > 0) {
      return t('legal.summary_critical', { 
        critical: result.critical_count, 
        high: result.high_count 
      });
    } else if (result.high_count > 0) {
      return t('legal.summary_high', { 
        high: result.high_count 
      });
    } else if (result.total_flags > 0) {
      return t('legal.summary_total', { 
        count: result.total_flags 
      });
    }
    return t('legal.summary_empty');
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
              fontSize: "calc(11px * var(--font-scale))",
              fontWeight: 700,
              color: 'var(--accent-primary)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}>
              {t('legal.title', 'INDIAN LEGAL SECTION MAPPING')}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: "calc(9px * var(--font-scale))",
              color: 'var(--text-muted)',
              marginTop: 2,
              letterSpacing: '0.05em',
            }}>
              {t('legal.subtitle', 'IT Act 2000 · Bharatiya Nyaya Sanhita 2023 · PMLA 2002')}
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
              fontSize: "calc(9px * var(--font-scale))",
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              opacity: result && result.total_flags > 0 ? 1 : 0.4,
            }}
          >
            <Download size={10} /> {t('legal.export', 'EXPORT')}
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
              fontSize: "calc(9px * var(--font-scale))",
              letterSpacing: '0.1em',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              opacity: loading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={10} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? t('legal.scanning', 'SCANNING...') : t('legal.rescan', 'RE-SCAN')}
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
          <div style={{ fontSize: "calc(11px * var(--font-scale))", letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            {t('legal.analyzing', 'ANALYSING FINDINGS AGAINST LEGAL DATABASE...')}
          </div>
          <div style={{ fontSize: "calc(9px * var(--font-scale))", color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(11px * var(--font-scale))", color: '#ff2d55' }}>
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
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(10px * var(--font-scale))", color: 'var(--text-muted)', flex: 1 }}>
              {getSummaryText()}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {result.critical_count > 0 && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: "calc(9px * var(--font-scale))",
                  color: '#ff2d55',
                  border: '1px solid rgba(255,45,85,0.4)',
                  padding: '3px 10px',
                  fontWeight: 700,
                  background: 'rgba(255,45,85,0.1)',
                }}>
                  {result.critical_count} {t('legal.critical', 'CRITICAL')}
                </div>
              )}
              {result.high_count > 0 && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: "calc(9px * var(--font-scale))",
                  color: '#ff9500',
                  border: '1px solid rgba(255,149,0,0.35)',
                  padding: '3px 10px',
                  fontWeight: 700,
                  background: 'rgba(255,149,0,0.08)',
                }}>
                  {result.high_count} {t('legal.high', 'HIGH')}
                </div>
              )}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: "calc(9px * var(--font-scale))",
                color: 'var(--text-muted)',
                border: '1px solid var(--struct-line)',
                padding: '3px 10px',
              }}>
                {result.total_flags} {t('legal.total', 'TOTAL')}
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
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'IT Act 2000', 'BNS 2023', 'PMLA 2002'].map(f => {
              let label = f;
              if (f === 'ALL') label = t('legal.filter_all', 'ALL');
              else if (f === 'CRITICAL') label = t('legal.critical', 'CRITICAL');
              else if (f === 'HIGH') label = t('legal.high', 'HIGH');
              else if (f === 'MEDIUM') label = t('legal.filter_medium', 'MEDIUM');
              else if (f === 'LOW') label = t('legal.filter_low', 'LOW');
              else if (f === 'IT Act 2000') label = t('legal.it_act', 'IT Act 2000');
              else if (f === 'BNS 2023') label = t('legal.bns_act', 'BNS 2023');
              else if (f === 'PMLA 2002') label = t('legal.pmla_act', 'PMLA 2002');
              
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: filter === f ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: filter === f ? 'var(--accent-primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: "calc(9px * var(--font-scale))",
                    fontWeight: filter === f ? 700 : 400,
                    letterSpacing: '0.1em',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    transition: 'color 0.15s, border-color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </button>
              );
            })}
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
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(11px * var(--font-scale))", letterSpacing: '0.15em' }}>
                  {t('legal.no_flags', 'NO FLAGS FOR SELECTED FILTER')}
                </span>
              </div>
            ) : (
              filteredFlags.map((flag, i) => (
                <LegalCard key={`${flag.act}-${flag.section}-${i}`} flag={flag} index={i} />
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
              fontSize: "calc(8px * var(--font-scale))",
              color: 'var(--text-muted)',
              margin: 0,
              letterSpacing: '0.06em',
              lineHeight: 1.5,
              opacity: 0.7,
            }}>
              {t('legal.disclaimer', '⚠ DISCLAIMER: This legal mapping is AI-assisted and indicative only. It does not constitute legal advice. All flagged provisions should be reviewed by a qualified legal professional before use in FIR filing or prosecution. Confidence scores reflect OSINT evidence strength, not judicial determination of guilt.')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
