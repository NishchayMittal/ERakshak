import React, { useEffect, useState } from 'react';
import { getNarrative } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';

interface ReportPanelProps {
  caseId: string;
}

export default function ReportPanel({ caseId }: ReportPanelProps) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useUIStore();

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await getNarrative(caseId);
      setReport(data.narrative);
    } catch (err) {
      console.error(err);
      showToast('Failed to load LLM Narrative Report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadReport();
    }
  }, [caseId]);

  // A very basic but reliable pure-React markdown renderer for the dossier layout
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();

      // Heading 3
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-sm font-bold text-indigo-400 border-b border-slate-800/80 pb-1.5 mt-5 mb-2.5 tracking-wide uppercase">
            {trimmed.slice(4)}
          </h3>
        );
      }

      // Heading 4
      if (trimmed.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-xs font-semibold text-slate-200 mt-4 mb-1.5 tracking-wider">
            {trimmed.slice(5)}
          </h4>
        );
      }

      // Bullet Lists
      if (trimmed.startsWith('- ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-xs text-slate-400 py-1 leading-relaxed">
            {parseInlineStyles(trimmed.slice(2))}
          </li>
        );
      }

      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      // Normal paragraph
      return (
        <p key={idx} className="text-xs text-slate-350 leading-relaxed mb-3">
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
        return <strong key={index} className="font-bold text-slate-100">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900/50 p-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">LLM Dossier Synthesis</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">Claude 3.5 Sonnet Bounded Report</p>
        </div>
        <button
          onClick={loadReport}
          disabled={loading}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300 rounded border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.213 6H16" />
          </svg>
          <span>{loading ? 'Generating...' : 'Regenerate'}</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-mono animate-pulse">Running Narrative Compiler...</span>
          </div>
        ) : report ? (
          <div className="font-sans leading-relaxed text-slate-300 selection:bg-indigo-500/30">
            {renderMarkdown(report)}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-xs text-slate-500 font-mono">
            No report available. Click Regenerate to compile.
          </div>
        )}
      </div>

      {/* Audit note foot */}
      <div className="mt-4 pt-3 border-t border-slate-800 text-[9px] text-slate-500 flex items-center gap-1">
        <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Synthesized report is cryptographically signed and stored in local audit index.</span>
      </div>
    </div>
  );
}
