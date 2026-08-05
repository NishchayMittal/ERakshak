import React from 'react';
import type { ProfileAttribute } from '../../types/profile';

interface AttributeRowProps {
  attribute: ProfileAttribute;
}

export default function AttributeRow({ attribute }: AttributeRowProps) {
  const { key, value, source, confidence } = attribute;

  // Pretty print keys
  const formatKey = (rawKey: string) => {
    return rawKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Determine confidence bar color
  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.5) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="py-2.5 border-b border-slate-800/60 flex flex-col gap-1.5 text-xs">
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
          {formatKey(key)}
        </span>

        {/* Source badge */}
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 text-indigo-400 border border-slate-800">
          {source}
        </span>
      </div>

      <div className="font-mono text-slate-200 break-all bg-slate-950/20 px-2 py-1 rounded border border-slate-850">
        {value}
      </div>

      {/* Confidence rating indicator */}
      <div className="flex items-center gap-2 mt-0.5">
        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${getConfidenceColor(confidence)}`}
            style={{ width: `${confidence * 100}%` }}
          ></div>
        </div>
        <span className="text-[10px] font-mono font-semibold text-slate-400">
          {Math.round(confidence * 100)}%
        </span>
      </div>
    </div>
  );
}
