import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCaseStore } from '../../state/caseStore';

export default function TopBar() {
  const { user, logout } = useAuth();
  const { activeCase } = useCaseStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine current page context title
  let pageTitle = 'Case Dashboard';
  if (location.pathname.includes('/intake')) {
    pageTitle = 'Identifier Ingestion & Normalization';
  } else if (location.pathname.includes('/entities/')) {
    pageTitle = 'Link Analysis Workspace';
  }

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10">
      {/* Title / Current Context */}
      <div className="flex items-center gap-4">
        <h2 className="font-bold text-slate-100 text-sm tracking-wide uppercase font-sans">
          {pageTitle}
        </h2>
        {activeCase && (location.pathname.includes('/intake') || location.pathname.includes('/entities/')) && (
          <>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-slate-800 text-indigo-300 rounded-full font-mono border border-slate-700">
                {activeCase.caseId}
              </span>
              <span className="text-xs font-medium text-slate-300">
                {activeCase.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Investigator Info & Actions */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-slate-300">{user.name}</span>
            <span className="text-[10px] text-slate-500 font-mono">{user.role}</span>
          </div>
        )}

        <div className="w-px h-8 bg-slate-800"></div>

        <button 
          onClick={handleLogout}
          className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-slate-100 rounded transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Disconnect</span>
        </button>
      </div>
    </header>
  );
}
