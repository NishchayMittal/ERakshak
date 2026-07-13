import { create } from 'zustand';
import type { GraphData } from '../types/graph';
import type { ProfileData } from '../types/profile';
import type { TimelineEntry } from '../types/timeline';
import { getGraph, getProfile, getTimeline } from '../api/endpoints';

interface GraphState {
  graphData: GraphData | null;
  profileData: ProfileData | null;
  timelineData: TimelineEntry[];
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
  profileData: null,
  timelineData: [],
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
      const [graph, profile, timeline] = await Promise.all([
        getGraph(caseId, entityId),
        getProfile(caseId, entityId),
        getTimeline(caseId, entityId),
      ]);
      set({
        graphData: graph,
        profileData: profile,
        timelineData: timeline,
      });
    } catch (err) {
      console.error('Failed to load entity graph data:', err);
    } finally {
      set({ loading: false });
    }
  },
  clearGraph: () => set({ graphData: null, profileData: null, timelineData: [], selectedEntityId: null }),
}));
