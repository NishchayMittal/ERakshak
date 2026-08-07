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
  timelineMaxTime: number | null;
  loading: boolean;
  
  setConfidenceThreshold: (val: number) => void;
  toggleSourceFilter: (source: string) => void;
  setTimelineMaxTime: (val: number | null) => void;
  setSelectedEntityId: (entityId: string | null) => void;
  loadEntityGraph: (caseId: string, entityId: string) => Promise<void>;
  clearGraph: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graphData: null,
  evidencePack: null,
  selectedEntityId: null,
  confidenceThreshold: 0.0,
  selectedSources: [
    'whois', 'crt.sh', 'wayback', 'sherlock', 'breach_demo',
    'dns_resolver', 'github_commit_email', 'phone_lookup',
    'wallet_lookup', 'face_matcher', 'breach_lookup',
    'wikipedia', 'name_search', 'social_profiler', 'fuzzy_username'
  ],
  timelineMaxTime: null,
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
  setTimelineMaxTime: (val) => set({ timelineMaxTime: val }),
  setSelectedEntityId: (entityId) => set({ selectedEntityId: entityId }),
  loadEntityGraph: async (caseId, entityId) => {
    const currentSelected = get().selectedEntityId;
    set({ loading: true });
    try {
      const [graph, evidence] = await Promise.all([
        getGraph(caseId, entityId),
        getEvidencePack(caseId),
      ]);
      
      // Auto-resolve 'n1' or nonexistent entityId to the first available node in the graph,
      // but prioritize the currently selected entity if already set by user click.
      let targetEntityId = currentSelected || entityId;
      if (graph && graph.nodes && graph.nodes.length > 0) {
        const hasTarget = graph.nodes.some((n) => n.id === targetEntityId);
        if (!hasTarget || targetEntityId === 'n1') {
          targetEntityId = graph.nodes[0].id;
        }
      }

      set({
        graphData: graph || { nodes: [], edges: [] },
        evidencePack: evidence || null,
        selectedEntityId: targetEntityId,
      });
    } catch (err) {
      console.error('Failed to load entity graph data:', err);
      set({ graphData: { nodes: [], edges: [] }, evidencePack: null });
    } finally {
      set({ loading: false });
    }
  },
  clearGraph: () => set({ graphData: null, evidencePack: null, selectedEntityId: null, timelineMaxTime: null }),
}));
