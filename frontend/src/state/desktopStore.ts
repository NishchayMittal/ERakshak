import { create } from 'zustand';

export interface WindowState {
  id: string;
  title: string;
  type: 'case_workspace' | 'settings' | 'profile' | 'cases_explorer';
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  caseId?: string;
  activeTab?: 'intake' | 'graph' | 'dossier' | 'report';
}

interface DesktopState {
  windows: WindowState[];
  activeWindowId: string | null;
  maxZIndex: number;
  wallpaperIdx: number;
  cpuUsage: number;
  ramUsage: number;
  hudLogs: string[];
  
  openWindow: (window: Omit<WindowState, 'zIndex'>) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<WindowState>) => void;
  setWallpaperIdx: (idx: number) => void;
  setSystemStats: (cpu: number, ram: number) => void;
  addHudLog: (log: string) => void;
}

const MOCK_HUD_LOGS = [
  '> Connection established...',
  '> Initializing OSINT protocols...',
  '> Scanning global databanks...',
  '> Awaiting operator input _',
];

export const useDesktopStore = create<DesktopState>((set, get) => ({
  windows: [],
  activeWindowId: null,
  maxZIndex: 10,
  wallpaperIdx: 0,
  cpuUsage: 28,
  ramUsage: 45,
  hudLogs: MOCK_HUD_LOGS,

  openWindow: (windowData) => {
    const state = get();
    // Check if window already exists (e.g. by caseId)
    if (windowData.caseId) {
      const existing = state.windows.find(w => w.caseId === windowData.caseId);
      if (existing) {
        state.focusWindow(existing.id);
        return;
      }
    } else {
      const existing = state.windows.find(w => w.type === windowData.type);
      if (existing) {
        state.focusWindow(existing.id);
        return;
      }
    }
    
    const newZ = state.maxZIndex + 1;
    set({
      windows: [...state.windows, { ...windowData, zIndex: newZ }],
      activeWindowId: windowData.id,
      maxZIndex: newZ,
    });
  },

  closeWindow: (id) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
      activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
    }));
  },

  focusWindow: (id) => {
    const state = get();
    if (state.activeWindowId === id) return;
    
    const newZ = state.maxZIndex + 1;
    set({
      windows: state.windows.map(w => w.id === id ? { ...w, zIndex: newZ } : w),
      activeWindowId: id,
      maxZIndex: newZ,
    });
  },

  updateWindow: (id, updates) => {
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    }));
  },

  setWallpaperIdx: (idx) => set({ wallpaperIdx: idx }),
  
  setSystemStats: (cpu, ram) => set({ cpuUsage: cpu, ramUsage: ram }),
  
  addHudLog: (log) => set((state) => {
    const newLogs = [...state.hudLogs, log];
    if (newLogs.length > 50) newLogs.shift();
    return { hudLogs: newLogs };
  })
}));
