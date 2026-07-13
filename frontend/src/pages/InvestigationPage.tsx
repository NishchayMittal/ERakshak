import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GraphView from '../components/graph/GraphView';
import GraphFilterBar from '../components/graph/GraphFilterBar';
import GraphLegend from '../components/graph/GraphLegend';
import ProfileCard from '../components/profile/ProfileCard';
import TimelineView from '../components/timeline/TimelineView';
import NotesPanel from '../components/cases/NotesPanel';
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

  return (
    <div className="h-full flex flex-col gap-5 overflow-hidden">
      
      {/* Action header bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-wide text-slate-100">Dossier Visual Analysis</h1>
          <p className="text-xs text-slate-400">
            Interactive correlation graph. Select any node to trace historical timelines and attributes.
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
          <GraphView onSelectNode={handleSelectNode} />
          <GraphLegend />
        </div>

        {/* Dynamic Sidebar card panels */}
        <div className="lg:col-span-4 flex flex-col bg-slate-900 border border-slate-800 rounded-lg min-h-0 overflow-hidden shadow-2xl">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 bg-slate-950/20 text-xs">
            <button
              onClick={() => setActiveTab('graph')}
              className={`flex-1 py-3 text-center font-bold tracking-wider uppercase border-b-2 transition-all ${
                activeTab === 'graph'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/50'
                  : 'border-transparent text-slate-500 hover:text-slate-350'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex-1 py-3 text-center font-bold tracking-wider uppercase border-b-2 transition-all ${
                activeTab === 'timeline'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/50'
                  : 'border-transparent text-slate-500 hover:text-slate-350'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-3 text-center font-bold tracking-wider uppercase border-b-2 transition-all ${
                activeTab === 'notes'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900/50'
                  : 'border-transparent text-slate-500 hover:text-slate-350'
              }`}
            >
              Notes
            </button>
          </div>

          {/* Active Panel View */}
          <div className="flex-1 overflow-y-auto p-1 min-h-0">
            {activeTab === 'graph' && <ProfileCard />}
            {activeTab === 'timeline' && <TimelineView />}
            {activeTab === 'notes' && caseId && <NotesPanel caseId={caseId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
