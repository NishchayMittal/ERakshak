import { create } from 'zustand';
import type { GraphData } from '../types/graph';

interface SeedInput {
  type: string;
  value: string;
}

interface CaseViewState {
  // Case-specific UI state mapped by caseId
  activeEntityPerCase: Record<string, string>;
  nodePositionsPerCase: Record<string, Record<string, { x: number; y: number }>>;
  caseSeedsInput: Record<string, SeedInput>;
  casePendingSeeds: Record<string, SeedInput[]>;
  caseIngestProgress: Record<string, number | null>;
  caseIngestLogs: Record<string, string[]>;
  caseReportNarrative: Record<string, string>;
  caseZoom: Record<string, number>;
  casePan: Record<string, { x: number; y: number }>;
  graphDataPerCase: Record<string, GraphData>;
  dossierSearchQuery: Record<string, string>;
  explorerSearchQuery: string;
  lastAccessedCaseId: string | null;

  // Actions
  setActiveEntity: (caseId: string, entityId: string) => void;
  setNodePositions: (caseId: string, positions: Record<string, { x: number; y: number }>) => void;
  setSeedInput: (caseId: string, input: SeedInput) => void;
  setPendingSeeds: (caseId: string, seeds: SeedInput[]) => void;
  setIngestProgress: (caseId: string, progress: number | null) => void;
  addIngestLog: (caseId: string, log: string) => void;
  setReportNarrative: (caseId: string, narrative: string) => void;
  setZoom: (caseId: string, zoom: number) => void;
  setPan: (caseId: string, pan: { x: number; y: number }) => void;
  setGraphData: (caseId: string, data: GraphData) => void;
  setDossierSearchQuery: (caseId: string, query: string) => void;
  setExplorerSearchQuery: (query: string) => void;
  setLastAccessedCaseId: (caseId: string | null) => void;
}

export const useCaseViewStore = create<CaseViewState>((set) => ({
  activeEntityPerCase: {},
  nodePositionsPerCase: {},
  caseSeedsInput: {},
  casePendingSeeds: {},
  caseIngestProgress: {},
  caseIngestLogs: {},
  caseReportNarrative: {},
  caseZoom: {},
  casePan: {},
  graphDataPerCase: {},
  dossierSearchQuery: {},
  explorerSearchQuery: '',
  lastAccessedCaseId: null,

  setActiveEntity: (caseId, entityId) => set(state => ({
    activeEntityPerCase: { ...state.activeEntityPerCase, [caseId]: entityId }
  })),

  setNodePositions: (caseId, positions) => set(state => ({
    nodePositionsPerCase: { ...state.nodePositionsPerCase, [caseId]: positions }
  })),

  setSeedInput: (caseId, input) => set(state => ({
    caseSeedsInput: { ...state.caseSeedsInput, [caseId]: input }
  })),

  setPendingSeeds: (caseId, seeds) => set(state => ({
    casePendingSeeds: { ...state.casePendingSeeds, [caseId]: seeds }
  })),

  setIngestProgress: (caseId, progress) => set(state => ({
    caseIngestProgress: { ...state.caseIngestProgress, [caseId]: progress }
  })),

  addIngestLog: (caseId, log) => set(state => ({
    caseIngestLogs: { 
      ...state.caseIngestLogs, 
      [caseId]: [...(state.caseIngestLogs[caseId] || []), log] 
    }
  })),

  setReportNarrative: (caseId, narrative) => set(state => ({
    caseReportNarrative: { ...state.caseReportNarrative, [caseId]: narrative }
  })),

  setZoom: (caseId, zoom) => set(state => ({
    caseZoom: { ...state.caseZoom, [caseId]: zoom }
  })),

  setPan: (caseId, pan) => set(state => ({
    casePan: { ...state.casePan, [caseId]: pan }
  })),

  setGraphData: (caseId, data) => set(state => ({
    graphDataPerCase: { ...state.graphDataPerCase, [caseId]: data }
  })),

  setDossierSearchQuery: (caseId, query) => set(state => ({
    dossierSearchQuery: { ...state.dossierSearchQuery, [caseId]: query }
  })),

  setExplorerSearchQuery: (query) => set({ explorerSearchQuery: query }),
  
  setLastAccessedCaseId: (caseId) => set({ lastAccessedCaseId: caseId }),
}));
