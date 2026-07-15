import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Briefcase, Activity, FileCheck, ShieldAlert } from 'lucide-react';
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
    
    useCaseStore.setState({
      cases: [newCase, ...cases]
    });
    
    showToast(`Case dossier ${newId} initialized`, 'success');
  };

  const activeCasesCount = cases.filter(c => c.status === 'active').length;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 20 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Dashboard Stats / Header */}
      <motion.div 
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/50 border border-indigo-500/10 rounded-lg p-6 cyber-panel corner-decor"
      >
        <div>
          <h1 className="text-lg font-bold tracking-widest text-slate-100 uppercase font-mono flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-400" />
            Investigative Dossiers
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access secure investigative case files correlated with investigator badge <span className="font-mono text-indigo-400 font-bold">{user?.badgeNumber}</span>.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleCreateCase}
          className="self-start sm:self-center px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded text-xs font-semibold shadow hover:shadow-indigo-500/10 transition-all flex items-center gap-1.5 border border-indigo-500/30 font-sans tracking-wide uppercase"
        >
          <Plus className="w-4 h-4" />
          <span>Initialize Case File</span>
        </motion.button>
      </motion.div>

      {/* Metrics widgets */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-3 gap-6"
      >
        {/* Dossiers Count */}
        <div className="cyber-panel border-indigo-500/10 p-4 bg-slate-900/30 flex items-center justify-between corner-decor">
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider font-mono">Total Dossiers</div>
            <div className="text-2xl font-bold text-slate-200 mt-1 font-mono glow-text-indigo">{cases.length}</div>
          </div>
          <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/20 rounded text-indigo-400 shadow-inner">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        {/* Active Dossiers */}
        <div className="cyber-panel border-indigo-500/10 p-4 bg-slate-900/30 flex items-center justify-between corner-decor">
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider font-mono">Active Investigation</div>
            <div className="text-2xl font-bold text-emerald-450 mt-1 font-mono glow-text-emerald">{activeCasesCount}</div>
          </div>
          <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/20 rounded text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Audit Logs events */}
        <div className="cyber-panel border-indigo-500/10 p-4 bg-slate-900/30 flex items-center justify-between corner-decor">
          <div>
            <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider font-mono">Audit Footprints</div>
            <div className="text-2xl font-bold text-cyan-455 mt-1 font-mono glow-text-cyan">114</div>
          </div>
          <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/20 rounded text-cyan-450">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>
      </motion.div>

      {/* Case cards list */}
      <motion.div variants={itemVariants}>
        <CaseList cases={cases} loading={loading} onSelectCase={selectCase} />
      </motion.div>
    </motion.div>
  );
}
