import { create } from 'zustand';
import type { CaseSummary, CaseNote } from '../types/case';
import { getCaseList, getNotes, addNote, createCase, renameCase, deleteCase } from '../api/endpoints';

interface CaseState {
  cases: CaseSummary[];
  activeCase: CaseSummary | null;
  notes: CaseNote[];
  loading: boolean;
  loadCases: () => Promise<void>;
  selectCase: (caseId: string) => void;
  loadNotes: (caseId: string) => Promise<void>;
  addCaseNote: (caseId: string, authorId: string, text: string) => Promise<void>;
  initializeNewCase: (title: string, description?: string) => Promise<CaseSummary>;
  renameCase: (caseId: string, title: string) => Promise<void>;
  deleteCase: (caseId: string) => Promise<void>;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  cases: [],
  activeCase: null,
  notes: [],
  loading: false,
  loadCases: async () => {
    set({ loading: true });
    try {
      const caseList = await getCaseList();
      set({ cases: caseList });
      if (!get().activeCase && caseList.length > 0) {
        set({ activeCase: caseList[0] });
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      set({ loading: false });
    }
  },
  selectCase: (caseId) => {
    const found = get().cases.find((c) => c.caseId === caseId);
    if (found) {
      set({ activeCase: found, notes: [] });
    }
  },
  loadNotes: async (caseId) => {
    try {
      const notes = await getNotes(caseId);
      set({ notes });
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  },
  addCaseNote: async (caseId, authorId, text) => {
    try {
      const newNote = await addNote(caseId, authorId, text);
      set((state) => ({
        notes: [...state.notes, newNote],
      }));
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  },
  initializeNewCase: async (title, description) => {
    set({ loading: true });
    try {
      const sanitizedTitle = (title || '').trim().slice(0, 30);
      const newCase = await createCase(sanitizedTitle, description);
      set((state) => ({
        cases: [newCase, ...state.cases],
        activeCase: newCase,
      }));
      return newCase;
    } catch (err) {
      console.error('Failed to initialize new case:', err);
      throw err;
    } finally {
      set({ loading: false });
    }
  },
  renameCase: async (caseId, title) => {
    try {
      const sanitizedTitle = (title || '').trim().slice(0, 30);
      const updatedCase = await renameCase(caseId, sanitizedTitle);
      set((state) => ({
        cases: state.cases.map((c) => (c.caseId === caseId ? updatedCase : c)),
        activeCase: state.activeCase?.caseId === caseId ? updatedCase : state.activeCase,
      }));
    } catch (err) {
      console.error('Failed to rename case:', err);
      throw err;
    }
  },
  deleteCase: async (caseId) => {
    try {
      await deleteCase(caseId);
      set((state) => {
        const nextCases = state.cases.filter((c) => c.caseId !== caseId);
        let nextActive = state.activeCase;
        if (state.activeCase?.caseId === caseId) {
          nextActive = nextCases.length > 0 ? nextCases[0] : null;
        }
        return {
          cases: nextCases,
          activeCase: nextActive,
        };
      });
    } catch (err) {
      console.error('Failed to delete case:', err);
      throw err;
    }
  },
}));
