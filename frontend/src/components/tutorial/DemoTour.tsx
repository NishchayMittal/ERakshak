import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Volume2, VolumeX,
  Bot, Zap, Shield, Network, FileText, Search,
  SkipForward, Play
} from 'lucide-react';
import { useTutorialStore } from '../../state/tutorialStore';

// ── TOUR STEPS ──────────────────────────────────────────────────────────────
interface DemoStep {
  id: string;
  targetSelector: string | null; // null = full-center card (no spotlight)
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  title: string;
  subtitle: string;
  message: string;
  voiceText: string;
  icon: React.ReactNode;
  accentColor: string;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'welcome',
    targetSelector: null,
    placement: 'center',
    title: 'WELCOME TO e-RAKSHAK',
    subtitle: 'ORION TERMINAL v3.1',
    message:
      'You have been granted Level-5 clearance to the ORION intelligence terminal. This guided tour will walk you through the core features of the platform in under 2 minutes.',
    voiceText:
      'Welcome to e-RAKSHAK, the ORION intelligence terminal. I\'m LEO, your guide. Let me walk you through the core features.',
    icon: <Shield size={22} />,
    accentColor: '#39FF14',
  },
  {
    id: 'init-case',
    targetSelector: '[data-tutorial="init-case"]',
    placement: 'bottom',
    title: 'INITIALIZE A CASE DOSSIER',
    subtitle: 'STEP 1 OF 6',
    message:
      'Click the green "+" icon to create a new case. Every investigation begins here — the system will assign a unique dossier ID and set up an encrypted workspace for your evidence.',
    voiceText:
      'This is the case initializer. Click the plus icon to create a new investigation dossier. Each case gets its own encrypted workspace.',
    icon: <Zap size={22} />,
    accentColor: '#39FF14',
  },
  {
    id: 'hud-terminal',
    targetSelector: '[data-tutorial="hud-terminal"]',
    placement: 'left',
    title: 'SYSTEM HUD TERMINAL',
    subtitle: 'STEP 2 OF 6',
    message:
      'The HUD streams real-time audit logs, active OSINT crawl jobs, model retraining events, and connection statuses. Think of it as the nervous system of the platform.',
    voiceText:
      'The HUD terminal streams real-time audit logs and system events. You can monitor all active investigation jobs from here.',
    icon: <Network size={22} />,
    accentColor: '#A855F7',
  },
  {
    id: 'profile-menu',
    targetSelector: '[data-tutorial="profile-menu"]',
    placement: 'bottom',
    title: 'BADGE IDENTITY',
    subtitle: 'STEP 3 OF 6',
    message:
      'Your badge ID is your cryptographic identity on the platform. All actions are signed and logged against this credential. Keep your credentials secure.',
    voiceText:
      'Your badge identity is displayed here. All investigative actions on the platform are cryptographically signed against this credential.',
    icon: <Shield size={22} />,
    accentColor: '#FFB800',
  },
  {
    id: 'graph-network',
    targetSelector: null,
    placement: 'center',
    title: 'LINK GRAPH ENGINE',
    subtitle: 'STEP 4 OF 6',
    message:
      'Open any case to access the Network Link Graph — an interactive visualization of entities, relationships, and pivots. Nodes represent people, phones, accounts, and domains. Edges show relationships.',
    voiceText:
      'Inside each case, the Network Link Graph visualizes all entities and relationships discovered during your investigation.',
    icon: <Network size={22} />,
    accentColor: '#00FFC2',
  },
  {
    id: 'dossier',
    targetSelector: null,
    placement: 'center',
    title: 'AUTOMATED DOSSIER',
    subtitle: 'STEP 5 OF 6',
    message:
      'The dossier tab auto-compiles all OSINT evidence into a structured report — social profiles, breach records, communication metadata, and risk scores. Export to PDF, JSON, or CSV in one click.',
    voiceText:
      'The dossier automatically compiles all discovered intelligence into a structured report. You can export it as a PDF, JSON, or CSV file.',
    icon: <FileText size={22} />,
    accentColor: '#A855F7',
  },
  {
    id: 'cross-correlate',
    targetSelector: null,
    placement: 'center',
    title: 'CROSS-CORRELATION ENGINE',
    subtitle: 'STEP 6 OF 6',
    message:
      'Use the Cross-Correlate window to find shared identifiers across multiple cases — the same phone number, device fingerprint, or email appearing in separate investigations signals a coordinated network.',
    voiceText:
      'The cross-correlation engine lets you find shared identifiers across multiple cases — revealing coordinated networks and linked suspects.',
    icon: <Search size={22} />,
    accentColor: '#FF0044',
  },
  {
    id: 'finish',
    targetSelector: null,
    placement: 'center',
    title: 'CLEARANCE GRANTED',
    subtitle: 'ORION TERMINAL READY',
    message:
      'You are now cleared for active operations. Initialize your first case, seed an identifier, and watch the intelligence graph build itself. Good hunting, Agent.',
    voiceText:
      'You are now cleared for operations. Initialize your first case, seed an identifier, and let the intelligence engine do the work. Good hunting, Agent.',
    icon: <Zap size={22} />,
    accentColor: '#39FF14',
  },
];

// ── SPOTLIGHT OVERLAY ─────────────────────────────────────────────────────
interface SpotlightProps {
  rect: DOMRect | null;
}

function SpotlightOverlay({ rect }: SpotlightProps) {
  if (!rect) {
    // No spotlight target — solid dim overlay
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0"
        style={{
          background: 'rgba(0,0,0,0.82)',
          zIndex: 99990,
          pointerEvents: 'none',
        }}
      />
    );
  }

  const pad = 12;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const W = window.innerWidth;
  const H = window.innerHeight;

  return (
    <motion.svg
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0"
      style={{ zIndex: 99990, pointerEvents: 'none' }}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
    >
      <defs>
        <mask id="demo-spotlight-mask">
          <rect width={W} height={H} fill="white" />
          <motion.rect
            animate={{ x, y, width: w, height: h }}
            transition={{ type: 'spring', stiffness: 250, damping: 28 }}
            rx={8}
            fill="black"
          />
        </mask>
      </defs>
      {/* Dark overlay with cutout */}
      <rect
        width={W}
        height={H}
        fill="rgba(0,0,0,0.82)"
        mask="url(#demo-spotlight-mask)"
      />
      {/* Highlight border ring */}
      <motion.rect
        animate={{ x, y, width: w, height: h }}
        transition={{ type: 'spring', stiffness: 250, damping: 28 }}
        rx={8}
        fill="none"
        stroke="rgba(57,255,20,0.9)"
        strokeWidth={2}
        style={{ filter: 'drop-shadow(0 0 8px rgba(57,255,20,0.7))' }}
      />
      {/* Pulse ring */}
      <motion.rect
        animate={{
          x: x - 6,
          y: y - 6,
          width: w + 12,
          height: h + 12,
          opacity: [0.6, 0, 0.6],
        }}
        transition={{
          default: { type: 'spring', stiffness: 250, damping: 28 },
          opacity: { repeat: Infinity, duration: 1.8, ease: 'easeInOut' },
        }}
        rx={12}
        fill="none"
        stroke="rgba(57,255,20,0.35)"
        strokeWidth={1.5}
      />
    </motion.svg>
  );
}

// ── LEO AVATAR ─────────────────────────────────────────────────────────────
function LeoAvatar({ isSpeaking, accentColor }: { isSpeaking: boolean; accentColor: string }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
      {/* Outer glow ring */}
      <motion.div
        animate={{ scale: isSpeaking ? [1, 1.15, 1] : 1, opacity: isSpeaking ? [0.4, 0.7, 0.4] : 0.3 }}
        transition={{ duration: 0.6, repeat: isSpeaking ? Infinity : 0 }}
        className="absolute inset-0 rounded-full"
        style={{ background: accentColor, filter: 'blur(6px)' }}
      />
      <div
        className="relative w-full h-full rounded-full border-2 flex items-center justify-center bg-black"
        style={{ borderColor: accentColor, boxShadow: `0 0 16px ${accentColor}55` }}
      >
        <Bot size={24} style={{ color: accentColor }} />
      </div>
      {/* Speaking mouth dots */}
      {isSpeaking && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ width: 4, height: 4, background: accentColor }}
              animate={{ scaleY: [0.3, 1, 0.3] }}
              transition={{ duration: 0.5, delay: i * 0.12, repeat: Infinity }}
            />
          ))}
        </div>
      )}
      <span
        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black animate-pulse"
        style={{ background: accentColor }}
      />
    </div>
  );
}

// ── PROGRESS DOTS ───────────────────────────────────────────────────────────
function ProgressDots({
  total,
  current,
  accentColor,
}: {
  total: number;
  current: number;
  accentColor: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 20 : 6,
            opacity: i <= current ? 1 : 0.3,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="h-1.5 rounded-full"
          style={{ background: i === current ? accentColor : 'rgba(255,255,255,0.3)' }}
        />
      ))}
    </div>
  );
}

// ── TYPEWRITER TEXT ─────────────────────────────────────────────────────────
function TypewriterText({ text, speed = 18 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setDisplayed('');
    setIdx(0);
  }, [text]);

  useEffect(() => {
    if (idx >= text.length) return;
    const t = setTimeout(() => {
      setDisplayed((prev) => prev + text[idx]);
      setIdx((i) => i + 1);
    }, speed);
    return () => clearTimeout(t);
  }, [idx, text, speed]);

  return (
    <span>
      {displayed}
      {idx < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          style={{ display: 'inline-block', width: '2px', height: '1em', background: 'currentColor', marginLeft: 2, verticalAlign: 'text-bottom' }}
        />
      )}
    </span>
  );
}

// ── MAIN DEMO TOUR ──────────────────────────────────────────────────────────
export function DemoTour() {
  const {
    isDemoActive,
    currentStepIndex,
    voiceEnabled,
    isSpeaking,
    stopDemo,
    setVoiceEnabled,
    setIsSpeaking,
    setDemoStep,
  } = useTutorialStore();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const currentStep = DEMO_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === DEMO_STEPS.length - 1;

  // ── Voice synthesis ──────────────────────────────────────────────────────
  const speak = useCallback(
    (text: string) => {
      if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.92;
      utter.pitch = 1.05;
      utter.volume = 0.9;

      // Prefer a natural-sounding voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes('Google UK English Female') ||
          v.name.includes('Samantha') ||
          v.name.includes('Karen') ||
          v.name.includes('Female')
      ) || voices.find((v) => v.lang.startsWith('en')) || voices[0];
      if (preferred) utter.voice = preferred;

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      synthRef.current = utter;
      window.speechSynthesis.speak(utter);
    },
    [voiceEnabled, setIsSpeaking]
  );

  // Speak on step change
  useEffect(() => {
    if (!isDemoActive || !currentStep) return;
    if (voiceEnabled) {
      // Small delay to let DOM settle
      const t = setTimeout(() => speak(currentStep.voiceText), 400);
      return () => clearTimeout(t);
    }
  }, [isDemoActive, currentStepIndex, voiceEnabled, speak, currentStep]);

  // Stop speech when voice toggled off
  useEffect(() => {
    if (!voiceEnabled) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
  }, [voiceEnabled, setIsSpeaking]);

  // ── Target element positioning ────────────────────────────────────────────
  useEffect(() => {
    if (!isDemoActive || !currentStep) return;

    const compute = () => {
      const sel = currentStep.targetSelector;
      if (!sel || currentStep.placement === 'center') {
        setTargetRect(null);
        setCardPos({ top: window.innerHeight / 2, left: window.innerWidth / 2 });
        return;
      }

      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        // Calculate card position
        const cardW = 380;
        const cardH = 280;
        const gap = 20;
        let top = 0;
        let left = 0;

        if (currentStep.placement === 'bottom') {
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - cardW / 2;
        } else if (currentStep.placement === 'top') {
          top = rect.top - gap - cardH;
          left = rect.left + rect.width / 2 - cardW / 2;
        } else if (currentStep.placement === 'right') {
          top = rect.top + rect.height / 2 - cardH / 2;
          left = rect.right + gap;
        } else if (currentStep.placement === 'left') {
          top = rect.top + rect.height / 2 - cardH / 2;
          left = rect.left - gap - cardW;
        }

        // Boundary clamp
        top = Math.max(16, Math.min(top, window.innerHeight - cardH - 16));
        left = Math.max(16, Math.min(left, window.innerWidth - cardW - 16));
        setCardPos({ top, left });
      } else {
        // Element not found — retry
        setTimeout(compute, 400);
      }
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [isDemoActive, currentStepIndex, currentStep]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDemoActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { stopDemo(); }
      if (e.key === 'ArrowRight' && !isLast) { setDemoStep(currentStepIndex + 1); }
      if (e.key === 'ArrowLeft' && !isFirst) { setDemoStep(currentStepIndex - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDemoActive, currentStepIndex, isFirst, isLast, stopDemo, setDemoStep]);

  if (!isDemoActive || !currentStep) return null;

  const isCentered = currentStep.placement === 'center' || !currentStep.targetSelector;
  const accent = currentStep.accentColor;

  return (
    <>
      {/* ── Backdrop + Spotlight ─────────────────────────────────────────── */}
      <AnimatePresence mode="sync">
        <SpotlightOverlay key={`spotlight-${currentStepIndex}`} rect={isCentered ? null : targetRect} />
      </AnimatePresence>

      {/* ── Skip button (always top-right, above overlay) ─────────────────── */}
      <motion.button
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={stopDemo}
        style={{ zIndex: 99999 }}
        className="fixed top-5 right-5 flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest border border-white/20 text-white/60 hover:text-white hover:border-white/40 bg-black/60 backdrop-blur-sm transition-all"
      >
        <SkipForward size={12} />
        Skip Tour
        <span className="text-white/30 ml-1">ESC</span>
      </motion.button>

      {/* ── Floating Tour Card ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`card-${currentStepIndex}`}
          ref={cardRef}
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={
            isCentered
              ? { opacity: 1, scale: 1, y: 0, top: '50%', left: '50%', x: '-50%', translateY: '-50%' }
              : { opacity: 1, scale: 1, y: 0, top: cardPos.top, left: cardPos.left }
          }
          exit={{ opacity: 0, scale: 0.9, y: -8 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          style={{
            position: 'fixed',
            zIndex: 99999,
            width: isCentered ? 'min(500px, 90vw)' : 380,
            pointerEvents: 'auto',
          }}
        >
          {/* Glass card */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(6,10,18,0.97)',
              border: `1px solid ${accent}40`,
              boxShadow: `0 0 40px ${accent}22, 0 24px 60px rgba(0,0,0,0.6)`,
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Top accent line */}
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-3">
                <LeoAvatar isSpeaking={isSpeaking} accentColor={accent} />
                <div>
                  <div className="text-[9px] font-bold tracking-[0.2em] uppercase mb-0.5" style={{ color: `${accent}99` }}>
                    LEO GUIDE  ·  {currentStep.subtitle}
                  </div>
                  <div
                    className="text-sm font-bold tracking-wider"
                    style={{ color: accent, fontFamily: 'var(--font-heading)' }}
                  >
                    {currentStep.title}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Voice toggle */}
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className="p-2 rounded-lg border transition-all"
                  style={voiceEnabled
                    ? { background: `${accent}20`, border: `1px solid ${accent}50`, color: accent }
                    : { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
                  }
                  title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
                >
                  {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>

                {/* Close */}
                <button
                  onClick={stopDemo}
                  className="p-2 rounded-lg border border-red-500/30 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Icon + message body */}
            <div className="px-5 py-4">
              <div className="flex gap-3">
                {/* Step icon */}
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                  style={{ background: `${accent}18`, border: `1px solid ${accent}30`, color: accent }}
                >
                  {currentStep.icon}
                </div>

                {/* Typewriter text */}
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(230,237,243,0.88)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  <TypewriterText key={currentStep.id} text={currentStep.message} />
                </p>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-5 pb-4 pt-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <ProgressDots
                total={DEMO_STEPS.length}
                current={currentStepIndex}
                accentColor={accent}
              />

              <div className="flex items-center gap-2">
                {/* Prev */}
                {!isFirst && (
                  <button
                    onClick={() => setDemoStep(currentStepIndex - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-white/10 text-white/50 hover:text-white hover:border-white/25 transition-all"
                  >
                    <ChevronLeft size={13} />
                    Prev
                  </button>
                )}

                {/* Next / Finish */}
                {isLast ? (
                  <button
                    onClick={stopDemo}
                    className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: accent,
                      color: '#000',
                      boxShadow: `0 0 16px ${accent}60`,
                    }}
                  >
                    <Play size={12} fill="currentColor" />
                    Launch Mission
                  </button>
                ) : (
                  <button
                    onClick={() => setDemoStep(currentStepIndex + 1)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: accent,
                      color: '#000',
                      boxShadow: `0 0 12px ${accent}50`,
                    }}
                  >
                    Next
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Keyboard hint */}
            <div
              className="text-center pb-3 text-[9px] tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              ← → Arrow keys to navigate  ·  ESC to skip
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
