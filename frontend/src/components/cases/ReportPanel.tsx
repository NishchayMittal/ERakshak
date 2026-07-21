import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { getNarrative } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';

interface ReportPanelProps {
  caseId: string;
}

// Audio click synth
const playDiagnosticTone = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.08);
    osc.frequency.setValueAtTime(1600, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
};

export default function ReportPanel({ caseId }: ReportPanelProps) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useUIStore();
  const { t } = useTranslation();

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await getNarrative(caseId);
      setReport(data.narrative);
      playDiagnosticTone();
    } catch (err) {
      console.error(err);
      showToast(t('report.load_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadReport();
    }
  }, [caseId]);

  // Pure React Markdown renderer matching cyber style
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();

      // Heading 3
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} style={{
            fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 700,
            color: 'var(--accent-primary)', borderBottom: '1px solid var(--struct-line)',
            paddingBottom: 6, marginTop: 16, marginBottom: 10,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Sparkles className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
            {trimmed.slice(4)}
          </h3>
        );
      }

      // Heading 4
      if (trimmed.startsWith('#### ')) {
        return (
          <h4 key={idx} style={{
            fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 700,
            color: 'var(--text-primary)', marginTop: 14, marginBottom: 8,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {trimmed.slice(5)}
          </h4>
        );
      }

      // Bullet Lists
      if (trimmed.startsWith('- ')) {
        return (
          <li key={idx} style={{
            marginLeft: 14, listStyleType: 'none', position: 'relative',
            paddingLeft: 12, fontSize: 9, fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)', padding: '2px 0',
            lineHeight: 1.4,
          }}>
            <span style={{
              position: 'absolute', left: 0, top: 6,
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--accent-primary)',
            }} />
            {parseInlineStyles(trimmed.slice(2))}
          </li>
        );
      }

      if (!trimmed) {
        return <div key={idx} style={{ height: 6 }} />;
      }

      // Normal paragraph
      return (
        <p key={idx} style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--text-primary)', lineHeight: 1.4,
          marginBottom: 10,
        }}>
          {parseInlineStyles(trimmed)}
        </p>
      );
    });
  };

  // Helper to parse simple bold markdown: **text**
  const parseInlineStyles = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return (
          <strong key={index} style={{
            fontWeight: 750, color: 'var(--accent-primary)',
            fontFamily: 'var(--font-mono)', background: 'rgba(0,255,194,0.05)',
            padding: '1px 3px', border: '1px solid rgba(0,255,194,0.15)',
          }}>
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div style={{ padding: '0 0 12px 0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* Panel Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--struct-line)',
        background: '#030609',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: 10,
          color: 'var(--accent-primary)', letterSpacing: '0.2em',
          textTransform: 'uppercase', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14, color: 'var(--accent-primary)', lineHeight: 1 }}>⌐</span>
          {t('report.title')}
          <span style={{ fontSize: 14, color: 'var(--accent-primary)', lineHeight: 1, transform: 'scaleX(-1)', display: 'inline-block' }}>⌐</span>
        </div>
        <button
          onClick={loadReport}
          disabled={loading}
          style={{
            background: 'none',
            border: '1px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
            fontFamily: 'var(--font-heading)', fontSize: 8,
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 8px', cursor: 'pointer',
            opacity: loading ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? t('report.running') : t('report.regenerate')}</span>
        </button>
      </div>

      {/* Model Telemetry Banner */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px',
        padding: '8px 14px',
        background: 'rgba(0,0,0,0.15)',
        borderBottom: '1px solid var(--struct-line)',
        fontFamily: 'var(--font-mono)', fontSize: 8,
        flexShrink: 0,
      }}>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>{t('report.provider')}</span>{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('report.provider_val')}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>{t('report.temperature')}</span>{' '}
          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{t('report.temp_val')}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>{t('report.context')}</span>{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('report.context_val')}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>{t('report.status_label')}</span>{' '}
          <span style={{ color: '#00C853', fontWeight: 600 }}>{t('report.status_val')}</span>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
            <div style={{ width: 24, height: 24, border: '2px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)', animation: 'blink 1.5s step-start infinite' }}>{t('report.compiling')}</span>
          </div>
        ) : report ? (
          <div style={{ userSelect: 'text' }}>
            {renderMarkdown(report)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <ShieldAlert className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{t('report.no_report')}</span>
          </div>
        )}
      </div>

      {/* Cryptographic Footprint footer */}
      <div style={{
        padding: '8px 14px 0 14px',
        borderTop: '1px solid var(--struct-line)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        <span>{t('report.hash')}</span>
        <span style={{ color: '#00C853', fontWeight: 700 }}>{t('report.aligned')}</span>
      </div>
    </div>
  );
}
