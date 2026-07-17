import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { IdentifierType } from '../../types/identifier';

interface IdentifierChipProps {
  id: string;
  type: IdentifierType;
  rawValue: string;
  onDelete: (id: string) => void;
}

export default function IdentifierChip({ id, type, rawValue, onDelete }: IdentifierChipProps) {
  const typeColors: Record<IdentifierType, string> = {
    name: 'bg-rose-950/40 border-rose-800/40 text-rose-300',
    email: 'bg-indigo-950/40 border-indigo-800/40 text-indigo-300',
    phone: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300',
    username: 'bg-cyan-950/40 border-cyan-800/40 text-cyan-300',
    domain: 'bg-purple-950/40 border-purple-800/40 text-purple-300',
    wallet: 'bg-amber-950/40 border-amber-800/40 text-amber-300',
    photo: 'bg-teal-950/40 border-teal-800/40 text-teal-300',
    ip: 'bg-orange-950/40 border-orange-800/40 text-orange-300',
    other: 'bg-slate-950/40 border-slate-800/40 text-slate-350',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -1 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium font-sans shadow-md transition-colors duration-200 ${
        typeColors[type] || 'bg-slate-900 border-slate-750 text-slate-350'
      }`}
    >
      <span className="opacity-70 uppercase text-[8px] tracking-wider px-1 py-0.5 bg-slate-950/70 rounded border border-white/5 font-mono">
        {type}
      </span>
      <span className="font-mono text-[11px]">{rawValue}</span>
      <button 
        type="button" 
        onClick={() => onDelete(id)}
        className="hover:bg-white/10 rounded-full p-0.5 ml-1 transition-all text-slate-400 hover:text-white"
        title="Remove seed"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
