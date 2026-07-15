import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, LayoutDashboard, FileText, Share2, Menu, ChevronLeft, ChevronRight, Briefcase, Sliders } from 'lucide-react';
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
    navigate(`/cases/${caseId}/intake`);
  };

  return (
    <motion.aside 
      animate={{ width: sidebarCollapsed ? 64 : 260 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className="bg-slate-900 border-r border-indigo-500/10 flex flex-col h-full relative z-30"
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-indigo-500/10">
        {!sidebarCollapsed ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 font-bold text-sm tracking-widest bg-gradient-to-r from-indigo-400 to-indigo-200 bg-clip-text text-transparent font-mono"
          >
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>E-RAKSHAK</span>
            <span className="text-[8px] px-1 py-0.5 bg-indigo-950/60 text-indigo-400 rounded border border-indigo-500/30">v1.0</span>
          </motion.div>
        ) : (
          <div className="w-8 h-8 rounded border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-450 text-xs bg-indigo-950/45 glow-shadow shadow-indigo-500/5 mx-auto">
            eR
          </div>
        )}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded transition-colors"
          title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Routes */}
      <nav className="p-3 space-y-1.5 flex-1 select-none">
        <NavLink
          to="/cases"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
              isActive 
                ? 'bg-indigo-600/90 text-white border-indigo-450 shadow-md shadow-indigo-500/10' 
                : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border-transparent'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Cases Dashboard</span>}
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
              isActive 
                ? 'bg-indigo-600/90 text-white border-indigo-450 shadow-md shadow-indigo-500/10' 
                : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border-transparent'
            }`
          }
        >
          <Sliders className="w-4 h-4 flex-shrink-0" />
          {!sidebarCollapsed && <span>Model Settings</span>}
        </NavLink>

        {activeCaseId && (
          <div className="pt-4 mt-4 border-t border-indigo-500/10 space-y-1">
            {!sidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-[9px] uppercase font-bold tracking-widest text-slate-500 px-3 mb-2 font-mono"
              >
                Active Case File
              </motion.div>
            )}
            
            <NavLink
              to={`/cases/${activeCaseId}/intake`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
                  isActive 
                    ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30 glow-shadow' 
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border-transparent'
                }`
              }
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>Seed Ingestion</span>}
            </NavLink>

            <NavLink
              to={`/cases/${activeCaseId}/entities/n1`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all border ${
                  isActive 
                    ? 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30 glow-shadow' 
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border-transparent'
                }`
              }
            >
              <Share2 className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>Link Analysis</span>}
            </NavLink>
          </div>
        )}
      </nav>

      {/* Case List Navigation / Quick Switcher */}
      {!sidebarCollapsed && cases.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 border-t border-indigo-500/10 bg-slate-900/50"
        >
          <label className="block text-[9px] uppercase font-bold tracking-widest text-slate-500 mb-2 font-mono">
            Switch Dossier
          </label>
          <div className="relative">
            <select 
              value={activeCaseId || ''} 
              onChange={(e) => handleCaseChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-350 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono outline-none cursor-pointer"
            >
              <option value="" disabled>Select case...</option>
              {cases.map((c) => (
                <option key={c.caseId} value={c.caseId}>
                  {c.title.length > 20 ? `${c.title.substring(0, 20)}...` : c.title}
                </option>
              ))}
            </select>
          </div>
        </motion.div>
      )}

      {/* Investigator Badge Block */}
      <div className="p-3 border-t border-indigo-500/10 bg-slate-950/40 text-[10px] text-slate-500 flex flex-col gap-1 select-none">
        {!sidebarCollapsed && user && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1"
          >
            <div className="font-semibold text-slate-350 flex items-center gap-1.5 uppercase font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {user.name}
            </div>
            <div className="text-[8px] text-slate-500 font-mono flex items-center justify-between">
              <span>SIGNATURE: {user.badgeNumber}</span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
}
