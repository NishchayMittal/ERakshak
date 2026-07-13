import { create } from 'zustand';
import type { CaseSummary, CaseNote } from '../types/case';
import { getCaseList, getNotes, addNote } from '../api/endpoints';

interface CaseState {
  cases: CaseSummary[];
  activeCase: CaseSummary | null;
  notes: CaseNote[];
  loading: boolean;
  loadCases: () => Promise<void>;
  selectCase: (caseId: string) => void;
  loadNotes: (caseId: string) => Promise<void>;
  addCaseNote: (caseId: string, authorId: string, text: string) => Promise<void>;
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
      // If we don't have an active case yet, default to the first one
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
}));
