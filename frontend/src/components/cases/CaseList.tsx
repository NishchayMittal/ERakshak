import React from 'react';
import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import CaseCard from './CaseCard';
import type { CaseSummary } from '../../types/case';

interface CaseListProps {
  cases: CaseSummary[];
  loading: boolean;
  onSelectCase: (caseId: string) => void;
}

export default function CaseList({ cases, loading, onSelectCase }: CaseListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-slate-900/50 border border-indigo-500/10 rounded-lg p-5 h-48 animate-pulse flex flex-col justify-between cyber-panel">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="w-16 h-3 bg-slate-800 rounded"></div>
                <div className="w-12 h-4 bg-slate-800 rounded-full"></div>
              </div>
              <div className="w-3/4 h-5 bg-slate-800 rounded mb-2"></div>
              <div className="w-1/2 h-3 bg-slate-800 rounded mb-4"></div>
            </div>
            <div className="pt-4 border-t border-indigo-500/10 flex items-center justify-between">
              <div className="w-20 h-4 bg-slate-800 rounded"></div>
              <div className="flex gap-2">
                <div className="w-12 h-7 bg-slate-800 rounded"></div>
                <div className="w-20 h-7 bg-slate-800 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="text-center py-16 bg-slate-905 border border-indigo-500/10 rounded-lg cyber-panel corner-decor flex flex-col items-center justify-center">
        <Inbox className="w-12 h-12 text-slate-600 mb-3" />
        <h4 className="text-slate-350 font-bold text-sm uppercase tracking-wider mb-1">No Cases Registered</h4>
        <p className="text-xs text-slate-500">Initialize a new dossier to start suspect ingestion and link maps.</p>
      </div>
    );
  }

  const listVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  return (
    <motion.div 
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {cases.map((c) => (
        <CaseCard key={c.caseId} caseItem={c} onSelect={onSelectCase} />
      ))}
    </motion.div>
  );
}
