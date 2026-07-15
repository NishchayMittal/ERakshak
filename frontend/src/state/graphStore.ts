import { create } from 'zustand';
import type { GraphData } from '../types/graph';
import type { EvidencePack } from '../types/evidence';
import { getGraph, getEvidencePack } from '../api/endpoints';

interface GraphState {
  graphData: GraphData | null;
  evidencePack: EvidencePack | null;
  selectedEntityId: string | null;
  confidenceThreshold: number; // 0 to 1
  selectedSources: string[]; // e.g., ['whois', 'crt.sh', 'wayback', 'sherlock', 'breach_demo']
  loading: boolean;
  
  setConfidenceThreshold: (val: number) => void;
  toggleSourceFilter: (source: string) => void;
  setSelectedEntityId: (entityId: string | null) => void;
  loadEntityGraph: (caseId: string, entityId: string) => Promise<void>;
  clearGraph: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graphData: null,
  evidencePack: null,
  selectedEntityId: null,
  confidenceThreshold: 0.0,
  selectedSources: ['whois', 'crt.sh', 'wayback', 'sherlock', 'breach_demo'],
  loading: false,

  setConfidenceThreshold: (val) => set({ confidenceThreshold: val }),
  toggleSourceFilter: (source) => {
    const active = get().selectedSources;
    if (active.includes(source)) {
      set({ selectedSources: active.filter((s) => s !== source) });
    } else {
      set({ selectedSources: [...active, source] });
    }
  },
  setSelectedEntityId: (entityId) => set({ selectedEntityId: entityId }),
  loadEntityGraph: async (caseId, entityId) => {
    set({ loading: true, selectedEntityId: entityId });
    try {
      const [graph, evidence] = await Promise.all([
        getGraph(caseId, entityId),
        getEvidencePack(caseId),
      ]);
      set({
        graphData: graph,
        evidencePack: evidence,
      });
    } catch (err) {
      console.error('Failed to load entity graph data:', err);
    } finally {
      set({ loading: false });
    }
  },
  clearGraph: () => set({ graphData: null, evidencePack: null, selectedEntityId: null }),
}));
