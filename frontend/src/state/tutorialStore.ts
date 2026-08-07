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
  
  startTutorial: (steps: TutorialStep[]) => void;
  nextStep: () => void;
  skipTutorial: () => void;
  toggleInfo: () => void;
  setUserInput: (input: string) => void;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  isActive: false,
  currentStepIndex: 0,
  steps: [],
  isInfoOpen: false,
  userInput: '',

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
}));
