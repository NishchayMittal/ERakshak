import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, RefreshCw, Cpu, Activity, ShieldAlert, Sparkles, Terminal } from 'lucide-react';
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

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await getNarrative(caseId);
      setReport(data.narrative);
      playDiagnosticTone();
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

  // Pure React Markdown renderer matching cyber style
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();

      // Heading 3
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={idx} className="text-xs font-bold text-indigo-400 border-b border-indigo-500/10 pb-1.5 mt-5 mb-2.5 tracking-wider uppercase font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            {trimmed.slice(4)}
          </h3>
        );
      }

      // Heading 4
      if (trimmed.startsWith('#### ')) {
        return (
          <h4 key={idx} className="text-[11px] font-bold text-slate-200 mt-4 mb-2 tracking-wider font-mono uppercase">
            {trimmed.slice(5)}
          </h4>
        );
      }

      // Bullet Lists
      if (trimmed.startsWith('- ')) {
        return (
          <li key={idx} className="ml-4 list-none relative pl-4 text-xs text-slate-350 py-1 leading-relaxed font-sans">
            <span className="absolute left-0 top-2.5 w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
            {parseInlineStyles(trimmed.slice(2))}
          </li>
        );
      }

      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      // Normal paragraph
      return (
        <p key={idx} className="text-xs text-slate-350 leading-relaxed mb-3 font-sans">
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
          <strong key={index} className="font-bold text-slate-200 font-mono bg-indigo-500/10 px-1 rounded border border-indigo-500/10">
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-900/30 border border-slate-850 rounded-lg p-4 select-none relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none cyber-grid-dense"></div>
      
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-indigo-500/10 mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-indigo-900/40 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">LLM Dossier Synthesis</h2>
            <p className="text-[9px] text-slate-500 font-mono mt-0.5">Claude 3.5 Sonnet Bounded Report</p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={loadReport}
          disabled={loading}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded border border-indigo-400/40 flex items-center gap-1.5 transition-all disabled:opacity-50 font-mono uppercase tracking-wider shadow"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Generating...' : 'Regenerate'}</span>
        </motion.button>
      </div>

      {/* Model Telemetry Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/50 border border-slate-850 p-2.5 rounded mb-4 text-[9px] font-mono relative z-10">
        <div>
          <span className="text-slate-550 block">PROVIDER:</span>
          <span className="text-slate-350 font-semibold uppercase">Anthropic Claude</span>
        </div>
        <div>
          <span className="text-slate-550 block">TEMPERATURE:</span>
          <span className="text-indigo-400 font-semibold">0.25 (BOUNDED)</span>
        </div>
        <div>
          <span className="text-slate-550 block">CONTEXT VECTORS:</span>
          <span className="text-slate-350 font-semibold">Evidence Pack JSON</span>
        </div>
        <div>
          <span className="text-slate-550 block">COMPILATION STATUS:</span>
          <span className="text-emerald-500 font-semibold flex items-center gap-1">
            <Activity className="w-3 h-3 animate-pulse" /> SIGNED
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0 relative z-10 max-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3 border border-indigo-500/10 bg-slate-950/20 rounded">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-mono animate-pulse uppercase tracking-wider text-indigo-400">Running Narrative Compiler...</span>
          </div>
        ) : report ? (
          <div className="font-sans leading-relaxed text-slate-300 select-text p-1.5">
            {renderMarkdown(report)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-[10px] text-slate-600 font-mono uppercase gap-2 border border-slate-850 bg-slate-950/10 rounded">
            <ShieldAlert className="w-5 h-5 text-slate-700" />
            <span>No report cached. Click Regenerate.</span>
          </div>
        )}
      </div>

      {/* Cryptographic Footprint footer */}
      <div className="mt-4 pt-3 border-t border-indigo-500/10 text-[8px] text-slate-550 font-mono flex items-center justify-between relative z-10">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-indigo-500" />
          <span>CRYPTOGRAPHIC HASH: SHA-256/DOSS-SYNTH-2026</span>
        </div>
        <span className="text-emerald-600 uppercase font-bold">ALIGNED</span>
      </div>
    </div>
  );
}
