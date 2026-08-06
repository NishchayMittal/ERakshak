import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { getNarrative } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';

interface ReportPanelProps {
  caseId: string;
}

// Audio click synth
const playDiagnosticTone = () => {};

const renderCustomMarkdown = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(<ul key={`ul-${listKey++}`} style={{ paddingLeft: 14, margin: '8px 0', listStyleType: 'none' }}>{listItems}</ul>);
      listItems = [];
      inList = false;
    }
  };

  const parseInline = (line: string, i: number) => {
    // Basic bold parsing: **text**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} style={{
          fontWeight: 750, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)',
          background: 'rgba(0,255,194,0.05)', padding: '1px 3px', border: '1px solid rgba(0,255,194,0.15)',
        }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    
    // Handle headings
    if (trimmed.startsWith('#')) {
      flushList();
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const content = parseInline(trimmed.replace(/^#+\s*/, ''), i);
      
      if (level === 1) {
        elements.push(<h1 key={i} style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--struct-line)', paddingBottom: 8, marginTop: 18, marginBottom: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{content}</h1>);
      } else if (level === 2) {
        elements.push(<h2 key={i} style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, color: 'var(--accent-primary)', borderBottom: '1px solid rgba(0, 255, 194, 0.2)', paddingBottom: 6, marginTop: 18, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{content}</h2>);
      } else if (level === 3) {
        elements.push(<h3 key={i} style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 700, color: 'var(--accent-primary)', borderBottom: '1px solid var(--struct-line)', paddingBottom: 6, marginTop: 16, marginBottom: 10, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}><Sparkles className="w-3 h-3" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />{content}</h3>);
      } else {
        elements.push(<h4 key={i} style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 700, color: 'var(--text-primary)', marginTop: 14, marginBottom: 8, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{content}</h4>);
      }
    } 
    // Handle blockquotes
    else if (trimmed.startsWith('>')) {
      flushList();
      const content = parseInline(trimmed.replace(/^>\s*/, ''), i);
      elements.push(<blockquote key={i} style={{ borderLeft: '2px solid var(--accent-primary)', background: 'rgba(0,255,194,0.05)', padding: '8px 12px', margin: '12px 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>{content}</blockquote>);
    }
    // Handle Unordered Lists
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
      inList = true;
      const content = parseInline(trimmed.substring(2), i);
      listItems.push(
        <li key={i} style={{ position: 'relative', paddingLeft: 12, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', padding: '4px 0 4px 12px', lineHeight: 1.5 }}>
          <span style={{ position: 'absolute', left: 0, top: 10, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-primary)' }} />
          {content}
        </li>
      );
    } 
    // Empty line
    else if (trimmed === '') {
      flushList();
      // elements.push(<br key={i} />); // optional, usually paragraphs handle spacing
    }
    // Paragraph
    else {
      flushList();
      const content = parseInline(trimmed, i);
      elements.push(<p key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 12 }}>{content}</p>);
    }
  });
  
  flushList();
  return elements;
};

export default function ReportPanel({ caseId }: ReportPanelProps) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!caseId);
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
    if (!caseId) return;
    let active = true;
    getNarrative(caseId)
      .then(data => {
        if (active) {
          setReport(data.narrative);
          playDiagnosticTone();
          setLoading(false);
        }
      })
      .catch(err => {
        if (active) {
          console.error(err);
          showToast(t('report.load_failed'), 'error');
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [caseId, showToast, t]);



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
            {renderCustomMarkdown(report)}
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
