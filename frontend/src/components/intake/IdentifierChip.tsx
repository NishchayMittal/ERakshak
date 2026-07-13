import React from 'react';
import type { IdentifierType } from '../../types/identifier';

interface IdentifierChipProps {
  id: string;
  type: IdentifierType;
  rawValue: string;
  onDelete: (id: string) => void;
}

export default function IdentifierChip({ id, type, rawValue, onDelete }: IdentifierChipProps) {
  // Styling maps by identifier type
  const typeColors: Record<IdentifierType, string> = {
    name: 'bg-rose-950/40 border-rose-800 text-rose-300',
    email: 'bg-indigo-950/40 border-indigo-800 text-indigo-300',
    phone: 'bg-emerald-950/40 border-emerald-800 text-emerald-300',
    username: 'bg-cyan-950/40 border-cyan-800 text-cyan-300',
    domain: 'bg-purple-950/40 border-purple-800 text-purple-300',
    wallet: 'bg-amber-950/40 border-amber-800 text-amber-300',
    photo: 'bg-teal-950/40 border-teal-800 text-teal-300',
  };

  return (
    <div 
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium font-sans shadow-md transition-all ${
        typeColors[type] || 'bg-slate-900 border-slate-750 text-slate-300'
      }`}
    >
      <span className="opacity-60 uppercase text-[9px] tracking-wider px-1 py-0.5 bg-slate-950/80 rounded border border-white/5 font-mono">
        {type}
      </span>
      <span className="font-mono">{rawValue}</span>
      <button 
        type="button" 
        onClick={() => onDelete(id)}
        className="hover:bg-white/10 rounded-full p-0.5 ml-1 transition-colors text-slate-400 hover:text-white"
        title="Remove seed"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
