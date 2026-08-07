import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, X, ChevronRight, CheckCircle } from 'lucide-react';
import { useTutorialStore } from '../../state/tutorialStore';
import { LeoAvatar } from './LeoAvatar';

export function TutorialOverlay() {
  const {
    isActive,
    currentStepIndex,
    steps,
    isInfoOpen,
    userInput,
    skipTutorial,
    nextStep,
    toggleInfo,
    setUserInput,
  } = useTutorialStore();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isActive || steps.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetRect(null);
      return;
    }

    const step = steps[currentStepIndex];
    if (!step) return;

    const updateRect = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        // Scroll into view if needed
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      } else {
        // Retry if element is not rendered yet
        setTimeout(() => {
          const retryEl = document.querySelector(step.targetSelector);
          if (retryEl) {
            setTargetRect(retryEl.getBoundingClientRect());
            retryEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
          }
        }, 500);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isActive, currentStepIndex, steps]);

  if (!isActive || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  const isInputRequired = !!currentStep.requireInput;
  const isInputValid = isInputRequired && userInput.toLowerCase().trim() === currentStep.requireInput?.toLowerCase().trim();
  const canProceed = !isInputRequired || isInputValid;

  // Calculate position
  let dialogTop = window.innerHeight / 2;
  let dialogLeft = window.innerWidth / 2;
  let highlightStyles = {};

  if (targetRect) {
    const placement = currentStep.placement || 'bottom';
    const gap = 20;

    highlightStyles = {
      top: targetRect.top - 5,
      left: targetRect.left - 5,
      width: targetRect.width + 10,
      height: targetRect.height + 10,
    };

    if (placement === 'bottom') {
      dialogTop = targetRect.bottom + gap;
      dialogLeft = targetRect.left + (targetRect.width / 2) - 160;
    } else if (placement === 'top') {
      dialogTop = targetRect.top - gap - 200; // Approx height
      dialogLeft = targetRect.left + (targetRect.width / 2) - 160;
    } else if (placement === 'right') {
      dialogTop = targetRect.top + (targetRect.height / 2) - 100;
      dialogLeft = targetRect.right + gap;
    } else if (placement === 'left') {
      dialogTop = targetRect.top + (targetRect.height / 2) - 100;
      dialogLeft = targetRect.left - gap - 320;
    }

    // Boundary checks
    dialogLeft = Math.max(20, Math.min(dialogLeft, window.innerWidth - 340));
    dialogTop = Math.max(20, Math.min(dialogTop, window.innerHeight - 250));
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Dim overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black pointer-events-auto"
      />

      {/* Target Highlight Box */}
      {targetRect && (
        <motion.div
          layout
          className="absolute border-2 border-[#39FF14] rounded shadow-[0_0_20px_rgba(57,255,20,0.4)] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, ...highlightStyles }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          {/* Inner pulse */}
          <motion.div
            className="absolute inset-0 bg-[#39FF14] opacity-20"
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        </motion.div>
      )}

      {/* Leo Bot Dialog */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          layout
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1, top: dialogTop, left: dialogLeft }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute w-[320px] bg-[#0A1015]/95 border border-[#39FF14]/50 rounded-lg shadow-2xl backdrop-blur-md pointer-events-auto overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-[#39FF14]/20 bg-gradient-to-r from-[#39FF14]/10 to-transparent">
            <div className="flex items-center gap-3">
              <LeoAvatar className="w-10 h-10" />
              <div>
                <h3 className="text-[#39FF14] font-mono text-sm font-bold tracking-wider">LEO BOT</h3>
                <p className="text-white/70 text-xs">{currentStep.title}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleInfo}
                className={`p-1.5 rounded-full border transition-colors ${
                  isInfoOpen ? 'bg-[#39FF14] text-black border-[#39FF14]' : 'border-[#39FF14]/50 text-[#39FF14] hover:bg-[#39FF14]/20'
                }`}
                title="More Info"
              >
                <Info size={14} />
              </button>
              <button
                onClick={skipTutorial}
                className="p-1.5 rounded-full border border-red-500/50 text-red-400 hover:bg-red-500/20 transition-colors"
                title="Skip Tutorial"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 flex-1">
            <AnimatePresence mode="wait">
              {isInfoOpen ? (
                <motion.div
                  key="info"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="text-sm text-[#A855F7] font-mono leading-relaxed"
                >
                  <div className="flex items-center gap-2 mb-2 text-white/90">
                    <Info size={16} className="text-[#A855F7]" />
                    <span className="font-semibold tracking-wide">DETAILED INFO</span>
                  </div>
                  {currentStep.infoText}
                </motion.div>
              ) : (
                <motion.div
                  key="message"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="text-sm text-white/90 leading-relaxed font-sans"
                >
                  {currentStep.message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Requirement */}
            {isInputRequired && !isInfoOpen && (
              <div className="mt-4 p-3 bg-black/40 rounded border border-[#39FF14]/20">
                <label className="text-xs text-[#39FF14] font-mono mb-2 block">
                  ACTION REQUIRED: TYPE "{currentStep.requireInput}"
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Enter command here..."
                    className="flex-1 bg-transparent border-b border-white/20 text-white text-sm focus:outline-none focus:border-[#39FF14] transition-colors pb-1"
                  />
                  {isInputValid && <CheckCircle size={16} className="text-[#39FF14]" />}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-black/50 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs font-mono text-white/40">
              STEP {currentStepIndex + 1} OF {steps.length}
            </span>
            <button
              onClick={nextStep}
              disabled={!canProceed}
              className={`flex items-center gap-1 px-4 py-1.5 rounded text-sm font-semibold transition-all ${
                canProceed
                  ? 'bg-[#39FF14] text-black hover:bg-[#32e612] shadow-[0_0_10px_rgba(57,255,20,0.3)]'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              {currentStepIndex === steps.length - 1 ? 'FINISH' : 'NEXT'}
              <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
