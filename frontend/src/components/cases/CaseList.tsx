import React from 'react';
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
          <div key={n} className="bg-slate-900 border border-slate-800 rounded-lg p-5 h-48 animate-pulse flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div className="w-16 h-3 bg-slate-800 rounded"></div>
                <div className="w-12 h-4 bg-slate-800 rounded-full"></div>
              </div>
              <div className="w-3/4 h-5 bg-slate-800 rounded mb-2"></div>
              <div className="w-1/2 h-3 bg-slate-800 rounded mb-4"></div>
            </div>
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
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
      <div className="text-center py-16 bg-slate-900 border border-slate-850 rounded-lg">
        <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        <h4 className="text-slate-300 font-bold mb-1">No Cases Found</h4>
        <p className="text-xs text-slate-500">Create a new intelligence dossier to start ingestion.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cases.map((c) => (
        <CaseCard key={c.caseId} caseItem={c} onSelect={onSelectCase} />
      ))}
    </div>
  );
}
