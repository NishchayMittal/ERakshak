import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, User, Cpu, Activity, Briefcase } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCaseStore } from '../../state/caseStore';

export default function TopBar() {
  const { user, logout } = useAuth();
  const { activeCase } = useCaseStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Determine current page context title
  let pageTitle = 'Case Dashboard';
  if (location.pathname.includes('/intake')) {
    pageTitle = 'Identifier Ingestion & Normalization';
  } else if (location.pathname.includes('/entities/')) {
    pageTitle = 'Link Analysis Workspace';
  }

  return (
    <header className="h-16 bg-slate-950/65 backdrop-blur-md border-b border-indigo-500/10 flex items-center justify-between px-6 z-20 relative select-none">
      <div className="absolute inset-0 opacity-15 pointer-events-none cyber-grid-dense"></div>
      
      {/* Title / Current Context */}
      <div className="flex items-center gap-4">
        <h2 className="font-bold text-slate-100 text-xs tracking-widest uppercase font-mono flex items-center gap-3">
          <div className="w-8 h-8 rounded border border-indigo-500/30 flex items-center justify-center bg-indigo-950/40 text-indigo-400 font-bold text-sm float-anim">
            eR
          </div>
          <span className="glow-text-indigo">{pageTitle}</span>
        </h2>
        {activeCase && (location.pathname.includes('/intake') || location.pathname.includes('/entities/')) && (
          <>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 bg-indigo-950/40 text-indigo-400 rounded-full font-mono border border-indigo-500/20">
                {activeCase.caseId}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-350 tracking-wider">
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
            <span className="text-xs font-semibold text-slate-300 font-sans flex items-center justify-end gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              {user.name}
            </span>
            <span className="text-[9px] text-slate-500 font-mono">{user.role}</span>
          </div>
        )}

        <div className="w-px h-8 bg-indigo-500/10"></div>

        <motion.button 
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-rose-500/25 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 text-xs font-semibold uppercase tracking-wider transition-all"
          title="Disconnect Gateway Session"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Disconnect</span>
        </motion.button>
      </div>
    </header>
  );
}
