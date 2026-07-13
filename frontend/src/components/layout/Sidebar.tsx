import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useUIStore } from '../../state/uiStore';
import { useCaseStore } from '../../state/caseStore';
import { useAuth } from '../../hooks/useAuth';

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { cases, activeCase, selectCase } = useCaseStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  const activeCaseId = params.caseId || activeCase?.caseId;

  const handleCaseChange = (caseId: string) => {
    selectCase(caseId);
    // When changing case, redirect to that case's intake flow
    navigate(`/cases/${caseId}/intake`);
  };

  return (
    <aside 
      className={`bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 font-bold text-lg tracking-wider bg-gradient-to-r from-indigo-400 to-indigo-200 bg-clip-text text-transparent">
            <span>e-RAKSHAK</span>
            <span className="text-[9px] px-1.5 py-0.5 bg-indigo-900/60 text-indigo-300 rounded border border-indigo-700/50 font-mono">v1.0</span>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="w-8 h-8 rounded bg-indigo-600/20 border border-indigo-500/50 flex items-center justify-center font-bold text-indigo-400 text-sm">
            eR
          </div>
        )}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded transition-colors"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Main Routes */}
      <nav className="p-3 space-y-1.5 flex-1">
        <NavLink
          to="/cases"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`
          }
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {!sidebarCollapsed && <span>Cases Dashboard</span>}
        </NavLink>

        {activeCaseId && (
          <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
            {!sidebarCollapsed && (
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 mb-2">
                Active Investigation
              </div>
            )}
            
            <NavLink
              to={`/cases/${activeCaseId}/intake`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`
              }
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {!sidebarCollapsed && <span>Identifier Intake</span>}
            </NavLink>

            <NavLink
              to={`/cases/${activeCaseId}/entities/n1`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`
              }
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {!sidebarCollapsed && <span>Link Graph Analysis</span>}
            </NavLink>
          </div>
        )}
      </nav>

      {/* Case List Navigation / Quick Switcher */}
      {!sidebarCollapsed && cases.length > 0 && (
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <label className="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">
            Switch Focus Case
          </label>
          <select 
            value={activeCaseId || ''} 
            onChange={(e) => handleCaseChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
          >
            <option value="" disabled>Select case...</option>
            {cases.map((c) => (
              <option key={c.caseId} value={c.caseId}>
                {c.title.length > 25 ? `${c.title.substring(0, 25)}...` : c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Investigator Badge Block */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-500 flex flex-col gap-1">
        {!sidebarCollapsed && user && (
          <>
            <div className="font-semibold text-slate-300">{user.name}</div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>{user.badgeNumber}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
