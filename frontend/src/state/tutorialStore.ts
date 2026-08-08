import { create } from 'zustand';

export interface TutorialStep {
  targetSelector: string; // CSS selector of the element to highlight
  title: string;
  message: string;
  infoText: string;
  requireInput?: string; // If set, user must type this exact string into the targeted element to proceed
  placement?: 'top' | 'bottom' | 'left' | 'right'; // Preferred placement of the Leo dialog
}

interface TutorialState {
  isActive: boolean;
  currentStepIndex: number;
  steps: TutorialStep[];
  isInfoOpen: boolean;
  userInput: string; // The current input typed by the user for steps that require input

  // Demo tour state
  isDemoActive: boolean;
  voiceEnabled: boolean;
  voiceType: 'Female' | 'Male';
  isSpeaking: boolean;

  startTutorial: (steps: TutorialStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  toggleInfo: () => void;
  setUserInput: (input: string) => void;

  // Demo tour actions
  startDemo: () => void;
  stopDemo: () => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setVoiceType: (voiceType: 'Female' | 'Male') => void;
  setIsSpeaking: (speaking: boolean) => void;
  setDemoStep: (index: number) => void;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  steps: [],
  isInfoOpen: false,
  userInput: '',

  isDemoActive: false,
  voiceEnabled: true,
  voiceType: 'Female',
  isSpeaking: false,

  startTutorial: (steps) => {
    set({
      isActive: true,
      currentStepIndex: 0,
      steps,
      isInfoOpen: false,
      userInput: '',
    });
  },

  nextStep: () => {
    const { currentStepIndex, steps } = get();
    if (currentStepIndex < steps.length - 1) {
      set({
        currentStepIndex: currentStepIndex + 1,
        isInfoOpen: false,
        userInput: '', // Reset input for the next step
      });
    } else {
      get().skipTutorial(); // End of tutorial
    }
  },

  prevStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1, isInfoOpen: false, userInput: '' });
    }
  },

  skipTutorial: () => {
    set({
      isActive: false,
      currentStepIndex: 0,
      steps: [],
      isInfoOpen: false,
      userInput: '',
    });
  },

  toggleInfo: () => {
    set((state) => ({ isInfoOpen: !state.isInfoOpen }));
  },

  setUserInput: (input: string) => {
    set({ userInput: input });
  },

  // Demo tour
  startDemo: () => {
    set({ isDemoActive: true, currentStepIndex: 0 });
  },

  stopDemo: () => {
    // Cancel any ongoing speech
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    set({ isDemoActive: false, isSpeaking: false, currentStepIndex: 0 });
    // Mark as seen
    try { localStorage.setItem('er_demo_seen', '1'); } catch { /* noop */ }
  },

  setVoiceEnabled: (enabled: boolean) => {
    if (!enabled && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    set({ voiceEnabled: enabled, isSpeaking: enabled ? get().isSpeaking : false });
  },

  setVoiceType: (voiceType: 'Female' | 'Male') => {
    set({ voiceType });
  },

  setIsSpeaking: (speaking: boolean) => {
    set({ isSpeaking: speaking });
  },

  setDemoStep: (index: number) => {
    set({ currentStepIndex: index });
  },
}));
