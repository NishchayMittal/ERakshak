import React from 'react';
import { Link } from 'react-router-dom';
import type { CaseSummary } from '../../types/case';

interface CaseCardProps {
  caseItem: CaseSummary;
  onSelect: (caseId: string) => void;
}

export default function CaseCard({ caseItem, onSelect }: CaseCardProps) {
  const isClosed = caseItem.status === 'closed';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between hover:border-indigo-500/50 hover:glow-shadow transition-all group relative">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-800 group-hover:bg-indigo-500 transition-colors rounded-t-lg"></div>
      
      <div>
        <div className="flex justify-between items-start gap-2 mb-3">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{caseItem.caseId}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
            isClosed 
              ? 'bg-slate-950 border-slate-700 text-slate-400' 
              : 'bg-indigo-950/40 border-indigo-500/20 text-indigo-400'
          }`}>
            {caseItem.status}
          </span>
        </div>

        <h3 className="font-bold text-slate-200 text-base leading-snug group-hover:text-white transition-colors mb-2">
          {caseItem.title}
        </h3>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {(caseItem.tags ?? []).map((tag) => (
            <span 
              key={tag} 
              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between mt-auto">
        <div className="text-xs text-slate-500">
          <div className="font-semibold text-slate-400">{caseItem.entityCount} Entities</div>
          <div className="text-[10px]">Active {new Date(caseItem.lastActivity).toLocaleDateString()}</div>
        </div>

        <div className="flex gap-2">
          <Link
            to={`/cases/${caseItem.caseId}/intake`}
            onClick={() => onSelect(caseItem.caseId)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 rounded text-xs transition-colors border border-slate-700"
          >
            Intake
          </Link>
          <Link
            to={`/cases/${caseItem.caseId}/entities/n1`}
            onClick={() => onSelect(caseItem.caseId)}
            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs transition-colors font-medium"
          >
            Investigate
          </Link>
        </div>
      </div>
    </div>
  );
}
