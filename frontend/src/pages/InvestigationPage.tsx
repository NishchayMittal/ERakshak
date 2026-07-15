import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GraphView from '../components/graph/GraphView';
import GraphFilterBar from '../components/graph/GraphFilterBar';
import GraphLegend from '../components/graph/GraphLegend';
import TimelineView from '../components/timeline/TimelineView';
import NotesPanel from '../components/cases/NotesPanel';
import ReportPanel from '../components/cases/ReportPanel';
import ExportMenu from '../components/export/ExportMenu';
import DossierPanel from '../components/dossier/DossierPanel';
import { useGraphStore } from '../state/graphStore';
import { useUIStore } from '../state/uiStore';
import { useCaseStore } from '../state/caseStore';

const TABS = ['DOSSIER', 'TIMELINE', 'NOTES', 'REPORT'] as const;
type Tab = typeof TABS[number];

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
    return () => { clearGraph(); };
  }, [caseId, entityId, loadEntityGraph, clearGraph, selectCase]);

  const handleSelectNode = (selectedNodeId: string) => {
    if (caseId) navigate(`/cases/${caseId}/entities/${selectedNodeId}`);
  };

  // Map uiStore tab keys to display tabs
  const tabMap: Record<string, Tab> = {
    graph: 'DOSSIER',
    timeline: 'TIMELINE',
    notes: 'NOTES',
    report: 'REPORT',
  };
  const activeDisplay = tabMap[activeTab] ?? 'DOSSIER';
  const reverseTabMap: Record<Tab, string> = {
    DOSSIER: 'graph',
    TIMELINE: 'timeline',
    NOTES: 'notes',
    REPORT: 'report',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12, overflow: 'hidden' }}>

      {/* ── Action header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#080c10',
        border: '1px solid var(--struct-line)',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
            color: 'var(--accent-primary)', letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>
            DOSSIER VISUAL ANALYSIS
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.05em' }}>
            Interactive correlation graph — select any node to trace timelines and attributes
          </div>
        </div>
        {caseId && <ExportMenu caseId={caseId} />}
      </div>

      {/* ── Filter bar ── */}
      <GraphFilterBar />

      {/* ── Main Workspace ── */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: 12, minHeight: 0, overflow: 'hidden',
      }}>

        {/* ── Graph canvas ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflow: 'hidden' }}>
          <GraphView onSelectNode={handleSelectNode} />
          <GraphLegend />
        </div>

        {/* ── Right dossier panel ── */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: '#080c10',
          border: '1px solid var(--accent-primary)',
          boxShadow: '0 0 6px rgba(0,255,194,0.15)',
          minHeight: 0, overflow: 'hidden',
          animation: 'slide-in-right 0.12s linear',
        }}>
          {/* Tab header */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--struct-line)',
            background: '#030609',
            flexShrink: 0,
          }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(reverseTabMap[tab] as any)}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeDisplay === tab
                    ? '2px solid var(--accent-primary)'
                    : '2px solid transparent',
                  color: activeDisplay === tab ? 'var(--accent-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'color 0.1s, border-color 0.1s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {activeDisplay === 'DOSSIER' && <DossierPanel />}
            {activeDisplay === 'TIMELINE' && <TimelineView />}
            {activeDisplay === 'NOTES' && caseId && <NotesPanel caseId={caseId} />}
            {activeDisplay === 'REPORT' && caseId && <ReportPanel caseId={caseId} />}
          </div>
        </div>
      </div>
    </div>
  );
}
