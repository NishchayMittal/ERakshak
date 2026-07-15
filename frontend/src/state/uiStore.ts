import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  disambiguationOpen: boolean;
  setDisambiguationOpen: (open: boolean) => void;
  activeTab: 'graph' | 'timeline' | 'notes' | 'report';
  setActiveTab: (tab: 'graph' | 'timeline' | 'notes' | 'report') => void;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  disambiguationOpen: false,
  setDisambiguationOpen: (open) => set({ disambiguationOpen: open }),
  activeTab: 'graph',
  setActiveTab: (tab) => set({ activeTab: tab }),
  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
    // auto dismiss toast after 4s
    setTimeout(() => {
      set((state) => {
        if (state.toast?.message === message) {
          return { toast: null };
        }
        return {};
      });
    }, 4000);
  },
  clearToast: () => set({ toast: null }),
}));
