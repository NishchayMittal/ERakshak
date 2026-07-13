import React, { useEffect } from 'react';
import CaseList from '../components/cases/CaseList';
import { useCaseStore } from '../state/caseStore';
import { useUIStore } from '../state/uiStore';
import { useAuth } from '../hooks/useAuth';

export default function CaseDashboardPage() {
  const { cases, loading, loadCases, selectCase } = useCaseStore();
  const { showToast } = useUIStore();
  const { user } = useAuth();

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleCreateCase = () => {
    // Local session simulation for adding a case
    const newId = `case-00${cases.length + 1}`;
    const newCase = {
      caseId: newId,
      title: `Dossier #${cases.length + 1} — Custom Investigation`,
      investigatorId: user?.id || 'inv-042',
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      tags: ['investigation', 'ad-hoc'],
      entityCount: 0
    };
    
    // Mutate state directly for session
    useCaseStore.setState({
      cases: [newCase, ...cases]
    });
    
    showToast(`Case ${newId} initialized successfully`, 'success');
  };

  const activeCasesCount = cases.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Dashboard Stats / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-lg p-6 cyber-grid">
        <div>
          <h1 className="text-xl font-bold tracking-wide text-slate-100">Investigative Case Files</h1>
          <p className="text-xs text-slate-400 mt-1">
            Access and manage cyber investigation files assigned to badge <span className="font-mono text-indigo-400">{user?.badgeNumber}</span>.
          </p>
        </div>

        <button
          onClick={handleCreateCase}
          className="self-start sm:self-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow hover:shadow-indigo-500/10 transition-all flex items-center gap-1.5 border border-indigo-500/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Initialize New Case</span>
        </button>
      </div>

      {/* Metrics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Dossiers</div>
            <div className="text-2xl font-bold text-slate-200 mt-1">{cases.length}</div>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-slate-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Status</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{activeCasesCount}</div>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-emerald-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Logged Audit Events</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1">114</div>
          </div>
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded text-indigo-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>
      </div>

      {/* Case cards grid list */}
      <CaseList cases={cases} loading={loading} onSelectCase={selectCase} />
    </div>
  );
}
