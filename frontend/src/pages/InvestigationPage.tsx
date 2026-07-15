import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Clock, FileText, FileSpreadsheet, Share2, Sliders } from 'lucide-react';
import GraphView from '../components/graph/GraphView';
import GraphFilterBar from '../components/graph/GraphFilterBar';
import GraphLegend from '../components/graph/GraphLegend';
import ProfileCard from '../components/profile/ProfileCard';
import TimelineView from '../components/timeline/TimelineView';
import NotesPanel from '../components/cases/NotesPanel';
import ReportPanel from '../components/cases/ReportPanel';
import ExportMenu from '../components/export/ExportMenu';
import { useGraphStore } from '../state/graphStore';
import { useUIStore } from '../state/uiStore';
import { useCaseStore } from '../state/caseStore';

export default function InvestigationPage() {
  const { caseId, entityId } = useParams<{ caseId: string; entityId: string }>();
  const navigate = useNavigate();
  const { loadEntityGraph, clearGraph } = useGraphStore();
  const { activeTab, setActiveTab } = useUIStore();
  const { selectCase } = useCaseStore();

  useEffect(() => {
    if (caseId && entityId) {
      selectCase(caseId);
      loadEntityGraph(caseId, entityId);
    }
    return () => {
      clearGraph();
    };
  }, [caseId, entityId, loadEntityGraph, clearGraph, selectCase]);

  const handleSelectNode = (selectedNodeId: string) => {
    if (caseId) {
      navigate(`/cases/${caseId}/entities/${selectedNodeId}`);
    }
  };

  const tabLabels: { id: 'graph' | 'timeline' | 'notes' | 'report'; label: string; icon: any }[] = [
    { id: 'graph', label: 'Profile', icon: User },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'notes', label: 'Notes', icon: FileSpreadsheet },
    { id: 'report', label: 'Report', icon: FileText }
  ];

  return (
    <div className="h-full flex flex-col gap-5 overflow-hidden select-none">
      
      {/* Action header bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-sm font-bold tracking-widest text-slate-100 font-mono uppercase flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-400" />
            Workspace Correlation Graph
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Trace entity connections dynamically. Hover or click nodes to isolate attributes, breach timestamps, and metadata pivots.
          </p>
        </div>
        
        {/* Export Dossier dropdown */}
        {caseId && <ExportMenu caseId={caseId} />}
      </div>

      {/* Filter panel */}
      <GraphFilterBar />

      {/* Main Workspace grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 overflow-hidden">
        
        {/* Graph Canvas area */}
        <div className="lg:col-span-8 flex flex-col gap-4 min-h-0">
          <GraphView caseId={caseId} onSelectNode={handleSelectNode} />
          <GraphLegend />
        </div>

        {/* Dynamic Sidebar card panels */}
        <div className="lg:col-span-4 flex flex-col bg-slate-900/40 border border-indigo-500/10 rounded-lg min-h-0 overflow-hidden shadow-2xl cyber-panel corner-decor">
          {/* Tab Navigation */}
          <div className="flex border-b border-indigo-500/10 bg-slate-950/20 text-[10px] uppercase font-bold tracking-wider font-mono">
            {tabLabels.map((t) => {
              const TabIcon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-3.5 flex items-center justify-center gap-1.5 border-b-2 transition-all relative ${
                    isActive
                      ? 'border-indigo-500 text-indigo-400 bg-slate-900/50'
                      : 'border-transparent text-slate-500 hover:text-slate-350 hover:bg-slate-900/20'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeTabUnderline" 
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Panel View with spring slide-in */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0 bg-slate-950/20">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="h-full"
              >
                {activeTab === 'graph' && <ProfileCard />}
                {activeTab === 'timeline' && <TimelineView />}
                {activeTab === 'notes' && caseId && <NotesPanel caseId={caseId} />}
                {activeTab === 'report' && caseId && <ReportPanel caseId={caseId} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
