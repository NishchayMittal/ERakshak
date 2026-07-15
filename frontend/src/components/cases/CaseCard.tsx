import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Folder, Users, ArrowRight } from 'lucide-react';
import type { CaseSummary } from '../../types/case';

interface CaseCardProps {
  caseItem: CaseSummary;
  onSelect: (caseId: string) => void;
}

const cardItemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 20 } }
};

export default function CaseCard({ caseItem, onSelect }: CaseCardProps) {
  const isClosed = caseItem.status === 'closed';

  return (
    <motion.div
      variants={cardItemVariants}
      whileHover={{ y: -5, borderColor: 'rgba(99, 102, 241, 0.45)' }}
      className="bg-slate-900/40 border border-indigo-500/10 rounded-lg p-5 flex flex-col justify-between hover:glow-shadow transition-all duration-300 relative cyber-panel group corner-decor"
    >
      <div>
        <div className="flex justify-between items-start gap-2 mb-3">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">{caseItem.caseId}</span>
          <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border ${
            isClosed 
              ? 'bg-slate-950 border-slate-800 text-slate-500' 
              : 'bg-indigo-950/50 border-indigo-500/30 text-indigo-400'
          }`}>
            {caseItem.status}
          </span>
        </div>

        <h3 className="font-bold text-slate-200 text-sm leading-snug group-hover:text-indigo-300 transition-colors mb-2 font-mono uppercase tracking-wide">
          {caseItem.title}
        </h3>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4 select-none">
          {caseItem.tags.map((tag) => (
            <span 
              key={tag} 
              className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-950 text-slate-450 border border-slate-900"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-indigo-500/10 flex items-center justify-between mt-auto">
        <div className="text-[10px] text-slate-500">
          <div className="font-semibold text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{caseItem.entityCount} CORRELATIONS</span>
          </div>
          <div className="text-[8px] font-mono mt-0.5">UPDATE: {new Date(caseItem.lastActivity).toLocaleDateString()}</div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/cases/${caseItem.caseId}/intake`}
            onClick={() => onSelect(caseItem.caseId)}
            className="px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-slate-100 rounded text-[10px] uppercase font-bold tracking-wider transition-colors border border-slate-750"
          >
            Intake
          </Link>
          <Link
            to={`/cases/${caseItem.caseId}/entities/n1`}
            onClick={() => onSelect(caseItem.caseId)}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] uppercase font-bold tracking-wider transition-colors flex items-center gap-1 font-sans"
          >
            <span>Scan</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
