import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Volume2, VolumeX,
  Bot, Zap, Shield, Network, FileText, Search,
  SkipForward, Play, Compass, Folder, CheckCircle, Terminal
} from 'lucide-react';
import { useTutorialStore } from '../../state/tutorialStore';
import { useTransliterate } from '../ui/Transliterate';
import { useTranslation } from 'react-i18next';

// ── TOUR STEPS ──────────────────────────────────────────────────────────────
interface DemoStep {
  id: string;
  targetSelector: string | null; // null = full-center card (no spotlight)
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  title: string;
  subtitle: string;
  message: string;
  mobileMessage?: string;
  voiceText: string;
  mobileVoiceText?: string;
  icon: React.ReactNode;
  accentColor: string;
  actionRequired?: 'click' | 'input' | 'none';
  actionTargetSelector?: string;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 'welcome',
    targetSelector: null,
    placement: 'center',
    title: 'WELCOME TO ORION',
    subtitle: 'ORION TERMINAL v3.1',
    message: 'I am LEO, your onboard AI intelligence coordinator. This quick tour will show you how to initialize a case, run the OSINT pipeline, and explore the cyber-correlation engine.',
    voiceText: 'Welcome to Orion. I am Leo, your AI intelligence coordinator. Let\'s walk through the platform\'s core capabilities.',
    icon: <Play size={22} />,
    accentColor: '#39ff14',
  },
  {
    id: 'hud-terminal',
    targetSelector: '[data-tutorial="hud-terminal"]',
    placement: 'left',
    title: 'SYSTEM HUD TERMINAL',
    subtitle: 'STEP 2 OF 14',
    message: 'The HUD streams real-time audit logs, active OSINT crawl jobs, model retraining events, and connection statuses. Think of it as the nervous system of the platform.',
    voiceText: 'This is the HUD Terminal. It streams live system audits, pipeline crawl jobs, and background model updates in real time.',
    icon: <Terminal size={22} />,
    accentColor: '#00f0ff',
  },
  {
    id: 'profile-menu',
    targetSelector: '[data-tutorial="profile-menu"]',
    placement: 'bottom',
    title: 'BADGE IDENTITY',
    subtitle: 'STEP 3 OF 14',
    message: 'Your badge ID is your cryptographic identity on the platform. All actions are signed and logged against this credential. Keep your credentials secure.',
    voiceText: 'Your badge is your cryptographic identity. All your actions on the platform are securely signed and logged against it.',
    icon: <Shield size={22} />,
    accentColor: '#39ff14',
  },
  {
    id: 'init-case',
    targetSelector: '[data-tutorial="init-case"]',
    placement: 'bottom',
    title: 'INITIALIZE A CASE DOSSIER',
    subtitle: 'STEP 4 OF 14',
    actionRequired: 'click',
    message: 'To begin an investigation, click the "+" button in the Case Management panel. This provisions a secure enclave for the new dossier.',
    voiceText: 'Let\'s begin. Click the plus button in the case management panel to initialize a new secure dossier.',
    icon: <Folder size={22} />,
    accentColor: '#39ff14',
  },
  {
    id: 'seed-input',
    targetSelector: '[data-tutorial="seed-input"]',
    placement: 'bottom',
    title: 'SEED THE INTELLIGENCE',
    subtitle: 'STEP 5 OF 14',
    actionRequired: 'input',
    message: 'Let\'s start an investigation. Enter a known identifier (like an email or phone number) into the intake field. Type something, then hit Enter or click ADD SEED.',
    mobileMessage: 'Let\'s start an investigation. Enter a known identifier (like an email or phone number) into the intake field. Type something, then tap ADD SEED.',
    voiceText: 'Now, enter a known identifier like a phone number or email into the intake panel, and press Enter or click Add Seed to proceed.',
    mobileVoiceText: 'Now, enter a known identifier like a phone number or email into the intake panel, and tap Add Seed to proceed.',
    icon: <Terminal size={22} />,
    accentColor: '#39ff14',
  },
  {
    id: 'run-pipeline',
    targetSelector: '[data-tutorial="run-pipeline"]',
    placement: 'top',
    title: 'EXECUTE OSINT PIPELINE',
    subtitle: 'STEP 6 OF 14',
    actionRequired: 'click',
    message: 'Click the RUN CORRELATION SCAN button to unleash the automated OSINT connectors on your seed data.',
    voiceText: 'Click the run correlation scan button. This dispatches our OSINT connectors to scour the dark web, public records, and social platforms.',
    icon: <Terminal size={22} />,
    accentColor: '#a855f7',
  },
  {
    id: 'graph-network',
    targetSelector: '[data-tutorial="tab-graph"]',
    placement: 'bottom',
    title: 'LINK GRAPH ENGINE',
    subtitle: 'STEP 7 OF 14',
    message: 'Open the Graph tab to access the Network Link Graph - an interactive visualization of entities, relationships, and pivots. Nodes represent people, phones, accounts, and domains.',
    voiceText: 'The Graph engine visually maps all discovered entities. It\'s fully interactive, letting you expand nodes and discover hidden connections.',
    icon: <Network size={22} />,
    accentColor: '#39ff14',
  },
  {
    id: 'dossier',
    targetSelector: '[data-tutorial="tab-dossier"]',
    placement: 'bottom',
    title: 'AUTOMATED DOSSIER',
    subtitle: 'STEP 8 OF 14',
    message: 'The dossier tab auto-compiles all OSINT evidence into a structured report - social profiles, breach records, communication metadata, and risk scores. Export to PDF, JSON, or CSV in one click.',
    voiceText: 'The dossier automatically compiles all evidence into a comprehensive report. You can easily export it to PDF for offline briefing.',
    icon: <Search size={22} />,
    accentColor: '#39ff14',
  },
  {
    id: 'geo-map',
    targetSelector: '[data-tutorial="tab-geo"]',
    placement: 'bottom',
    title: 'GEO INTEL MAP',
    subtitle: 'STEP 9 OF 14',
    message: 'The GEO MAP tab projects IPs, registered addresses, and location metadata onto a geospatial visualization, exposing physical movement and origin.',
    voiceText: 'The Geo Intel map plots all discovered physical coordinates, helping you trace origins and physical movements of targets.',
    icon: <Compass size={22} />, 
    accentColor: '#00f0ff',
  },
  {
    id: 'legal',
    targetSelector: '[data-tutorial="tab-legal"]',
    placement: 'bottom',
    title: 'LEGAL TRACEABILITY',
    subtitle: 'STEP 10 OF 14',
    message: 'The Legal tab tracks the cryptographic chain of custody for all evidence discovered, ready for court submission.',
    voiceText: 'The Legal tab maintains a strict cryptographic chain of custody for all digital evidence, ensuring it is court-admissible.',
    icon: <Shield size={22} />,
    accentColor: '#39ff14',
  },
  {
    id: 'ai-report',
    targetSelector: '[data-tutorial="tab-report"]',
    placement: 'bottom',
    title: 'AI REPORT GENERATION',
    subtitle: 'STEP 11 OF 14',
    message: 'Generate natural language executive summaries of your entire case graph in seconds using the onboard LLM.',
    voiceText: 'Need an executive summary? The AI report feature uses our onboard language model to synthesize the entire case graph into a readable brief.',
    icon: <FileText size={22} />,
    accentColor: '#a855f7',
  },
  {
    id: 'ai-chat',
    targetSelector: '[data-tutorial="tab-chat"]',
    placement: 'left',
    title: 'AI COPILOT',
    subtitle: 'STEP 12 OF 14',
    message: 'Your AI Copilot is always available. Ask it to analyze graphs, suggest pivot strategies, or explain complex relationships.',
    voiceText: 'Your AI Copilot is available on the right. Ask it to analyze findings, suggest next steps, or explain complex relationships.',
    icon: <Bot size={22} />,
    accentColor: '#A855F7',
  },
  {
    id: 'cross-correlate',
    targetSelector: '[data-tutorial="cross-correlate"]',
    placement: 'right',
    title: 'CROSS-CORRELATION ENGINE',
    subtitle: 'STEP 13 OF 14',
    message: 'Use the Cross-Correlate window to find shared identifiers across multiple cases - the same phone number, device fingerprint, or email appearing in separate investigations signals a coordinated network.',
    voiceText: 'The cross-correlation engine lets you find shared identifiers across multiple cases - revealing coordinated networks and linked suspects.',
    icon: <Network size={22} />,
    accentColor: '#00f0ff',
  },
  {
    id: 'notifications',
    targetSelector: '[data-tutorial="notifications-bell"]',
    placement: 'right',
    title: 'REAL-TIME ALERTS',
    subtitle: 'STEP 14 OF 14',
    message: 'The Notifications bell alerts you to important system events, critical intelligence discoveries, and completed background jobs.',
    voiceText: 'Finally, the notifications bell keeps you updated on system alerts and background job completions.',
    icon: <Shield size={22} />,
    accentColor: '#39ff14',
  },
  {
    id: 'finish',
    targetSelector: null,
    placement: 'center',
    title: 'CLEARANCE GRANTED',
    subtitle: 'ORION TERMINAL READY',
    message: 'You are now cleared for active operations. Good hunting, Agent.',
    voiceText: 'Tour complete. You are now cleared for active operations. Good hunting, Agent.',
    icon: <CheckCircle size={22} />,
    accentColor: '#39ff14',
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
    <div className="flex items-center gap-1 flex-shrink-0">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            width: i === current ? 14 : 4,
            opacity: i <= current ? 1 : 0.25,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="h-1 rounded-full flex-shrink-0"
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

export function DemoTour() {
  const {
    isDemoActive,
    currentStepIndex,
    voiceEnabled,
    voiceType,
    isSpeaking,
    stopDemo,
    setVoiceEnabled,
    setVoiceType,
    setIsSpeaking,
    setDemoStep,
  } = useTutorialStore();

  const transliterate = useTransliterate();
  const { t, i18n } = useTranslation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPos, setCardPos] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Detect mobile screens (< 640px) vs iPad/tablets (>= 768px) and desktop
  const [isMobileScreen, setIsMobileScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter out HUD terminal and Badge Identity (profile-menu) ONLY on mobile phones (< 640px)
  const activeSteps = React.useMemo(
    () => (isMobileScreen ? DEMO_STEPS.filter((step) => step.id !== 'hud-terminal' && step.id !== 'profile-menu') : DEMO_STEPS),
    [isMobileScreen]
  );

  const currentStep = activeSteps[currentStepIndex] || activeSteps[0];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex >= activeSteps.length - 1;
  const lastPlayedKeyRef = useRef<string>('');
  const activeSpeechIdRef = useRef<number>(0);
  const synthTimerRef = useRef<any>(null);

  // ── Native Browser SpeechSynthesis Fallback ──────────────────────────────
  const fallbackSpeechSynthesis = useCallback(
    (stepId: string, speechId: number) => {
      if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
      if (activeSpeechIdRef.current !== speechId) return;

      window.speechSynthesis.cancel();

      const doSpeak = () => {
        if (activeSpeechIdRef.current !== speechId) return;

        const voices = window.speechSynthesis.getVoices();
        const rawLang = i18n.language || 'en';
        const selectedLang = rawLang.startsWith('hi') ? 'hi' : rawLang.startsWith('gu') ? 'gu' : 'en';
        let preferred;

        if (selectedLang === 'hi') {
          const hiVoices = voices.filter((v) => v.lang.startsWith('hi'));
          if (hiVoices.length > 0) {
            if (voiceType === 'Female') {
              preferred = hiVoices.find((v) => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('lekha') || !v.name.toLowerCase().includes('male'));
            } else {
              preferred = hiVoices.find((v) => v.name.toLowerCase().includes('male') || !v.name.toLowerCase().includes('female'));
            }
            if (!preferred) preferred = hiVoices[0];
          }
        } else if (selectedLang === 'gu') {
          const guVoices = voices.filter((v) => v.lang.startsWith('gu'));
          if (guVoices.length > 0) {
            if (voiceType === 'Female') {
              preferred = guVoices.find((v) => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('male'));
            } else {
              preferred = guVoices.find((v) => v.name.toLowerCase().includes('male') || !v.name.toLowerCase().includes('female'));
            }
            if (!preferred) preferred = guVoices[0];
          }
        } else {
          const enVoices = voices.filter((v) => v.lang.startsWith('en'));
          if (enVoices.length > 0) {
            if (voiceType === 'Female') {
              preferred = enVoices.find((v) => v.name.includes('Google UK English Female') || v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Female'));
            } else {
              preferred = enVoices.find((v) => v.name.includes('Google UK English Male') || v.name.includes('Alex') || v.name.includes('Daniel') || v.name.includes('Male'));
            }
            if (!preferred) preferred = enVoices[0];
          }
        }

        const voiceTextToSpeak = getStepVoiceText(stepId, selectedLang, isMobileScreen, t, i18n);

        const utter = new SpeechSynthesisUtterance(voiceTextToSpeak);
        utter.rate = 0.92;
        utter.pitch = 1.05;
        utter.volume = 0.9;
        utter.lang = selectedLang === 'hi' ? 'hi-IN' : selectedLang === 'gu' ? 'gu-IN' : 'en-US';

        if (preferred) utter.voice = preferred;

        utter.onstart = () => {
          if (activeSpeechIdRef.current === speechId) setIsSpeaking(true);
        };
        utter.onend = () => {
          if (activeSpeechIdRef.current === speechId) setIsSpeaking(false);
        };
        utter.onerror = () => {
          if (activeSpeechIdRef.current === speechId) setIsSpeaking(false);
        };
        synthRef.current = utter;

        if (activeSpeechIdRef.current === speechId) {
          window.speechSynthesis.speak(utter);
        }
      };

      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          doSpeak();
        };
      } else {
        if (synthTimerRef.current) {
          clearTimeout(synthTimerRef.current);
          synthTimerRef.current = null;
        }
        doSpeak();
      }
    },
    [voiceEnabled, voiceType, setIsSpeaking, i18n, t, isMobileScreen]
  );

// Helper to safely resolve message text without exposing raw i18n missing keys
function getStepMessage(step: DemoStep, isMobile: boolean, tInstance: any, i18nInstance: any): string {
  if (isMobile) {
    const mobileKey = `demo_tour.steps.${step.id}.mobileMessage`;
    if (i18nInstance?.exists && i18nInstance.exists(mobileKey)) {
      return tInstance(mobileKey);
    }
    if (step.mobileMessage) {
      return step.mobileMessage;
    }
  }
  const defaultKey = `demo_tour.steps.${step.id}.message`;
  return tInstance(defaultKey, step.message);
}

// Helper to safely resolve voice text without exposing raw i18n missing keys
function getStepVoiceText(stepId: string, lang: string, isMobile: boolean, tInstance: any, i18nInstance: any): string {
  const stepConfig = DEMO_STEPS.find((s) => s.id === stepId);
  const defaultVoiceText = isMobile && stepConfig?.mobileVoiceText ? stepConfig.mobileVoiceText : (stepConfig ? stepConfig.voiceText : '');
  
  if (isMobile) {
    const mobileVoiceKey = `demo_tour.steps.${stepId}.mobileVoiceText`;
    if (i18nInstance?.exists && i18nInstance.exists(mobileVoiceKey, { lng: lang })) {
      return tInstance(mobileVoiceKey, { lng: lang });
    }
    const mobileMsgKey = `demo_tour.steps.${stepId}.mobileMessage`;
    if (i18nInstance?.exists && i18nInstance.exists(mobileMsgKey, { lng: lang })) {
      return tInstance(mobileMsgKey, { lng: lang });
    }
    if (stepConfig?.mobileVoiceText) {
      return stepConfig.mobileVoiceText;
    }
    if (stepConfig?.mobileMessage) {
      return stepConfig.mobileMessage;
    }
  }

  const voiceKey = `demo_tour.steps.${stepId}.voiceText`;
  if (i18nInstance?.exists && i18nInstance.exists(voiceKey, { lng: lang })) {
    return tInstance(voiceKey, { lng: lang });
  }
  const msgKey = `demo_tour.steps.${stepId}.message`;
  if (i18nInstance?.exists && i18nInstance.exists(msgKey, { lng: lang })) {
    return tInstance(msgKey, { lng: lang });
  }
  return defaultVoiceText || stepConfig?.message || '';
}

// Module-level audio blob cache: `${stepId}_${lang}_${gender}_${mode}` -> Blob
const audioBlobCache = new Map<string, Blob>();
const inFlightAudioRequests = new Map<string, Promise<Blob | null>>();

// Helper to fetch and cache Edge TTS audio with in-memory caching and in-flight deduplication
async function fetchAndCacheAudio(stepId: string, lang: string, gender: string, i18nInstance: any, isMobile: boolean = false): Promise<Blob | null> {
  const normLang = lang.startsWith('hi') ? 'hi' : lang.startsWith('gu') ? 'gu' : 'en';
  const normGender = gender === 'Male' ? 'Male' : 'Female';
  const cacheKey = `${stepId}_${normLang}_${normGender}_${isMobile ? 'm' : 'd'}`;

  if (audioBlobCache.has(cacheKey)) {
    return audioBlobCache.get(cacheKey)!;
  }

  if (inFlightAudioRequests.has(cacheKey)) {
    return inFlightAudioRequests.get(cacheKey)!;
  }

  const stepConfig = DEMO_STEPS.find((s) => s.id === stepId);
  const defaultVoiceText = isMobile && stepConfig?.mobileVoiceText ? stepConfig.mobileVoiceText : (stepConfig ? stepConfig.voiceText : '');
  
  let text = '';
  if (isMobile) {
    text =
      (i18nInstance?.getResource(normLang, 'translation', `demo_tour.steps.${stepId}.mobileVoiceText`) as string) ||
      (i18nInstance?.getResource(normLang, 'translation', `demo_tour.steps.${stepId}.mobileMessage`) as string) ||
      (stepConfig?.mobileVoiceText) ||
      (stepConfig?.mobileMessage) ||
      '';
  }
  if (!text) {
    text =
      (i18nInstance?.getResource(normLang, 'translation', `demo_tour.steps.${stepId}.voiceText`) as string) ||
      (i18nInstance?.getResource(normLang, 'translation', `demo_tour.steps.${stepId}.message`) as string) ||
      defaultVoiceText;
  }

  if (!text) return null;

  const fetchPromise = (async () => {
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBase}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          lang: normLang,
          gender: normGender,
        }),
      });

      if (!response.ok) return null;
      const blob = await response.blob();
      if (blob && blob.size > 0) {
        audioBlobCache.set(cacheKey, blob);
        return blob;
      }
    } catch {
      // Ignore background prefetch errors
    } finally {
      inFlightAudioRequests.delete(cacheKey);
    }
    return null;
  })();

  inFlightAudioRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

  // Stop speech helper
  const stopAllAudio = useCallback(() => {
    // Invalidate any in-flight async TTS requests or scheduled speech timers
    activeSpeechIdRef.current += 1;

    if (synthTimerRef.current) {
      clearTimeout(synthTimerRef.current);
      synthTimerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (synthRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      synthRef.current = null;
    }
    setIsSpeaking(false);
  }, [setIsSpeaking]);

  // Unified exit/skip handler
  const handleStopDemo = useCallback(() => {
    lastPlayedKeyRef.current = '';
    stopAllAudio();
    stopDemo();
  }, [stopAllAudio, stopDemo]);

  // Edge TTS playback with speech synthesis fallback
  const speak = useCallback(
    async (stepId: string) => {
      if (!voiceEnabled || typeof window === 'undefined') return;

      // Invalidate existing speech and claim this new speech ID
      const currentSpeechId = ++activeSpeechIdRef.current;

      if (synthTimerRef.current) {
        clearTimeout(synthTimerRef.current);
        synthTimerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onplay = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (synthRef.current && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        synthRef.current = null;
      }
      setIsSpeaking(false);

      const currentLang = i18n.language || 'en';

      try {
        const blob = await fetchAndCacheAudio(stepId, currentLang, voiceType, i18n, isMobileScreen);

        // Check if a newer speak request superceded this one while fetching
        if (activeSpeechIdRef.current !== currentSpeechId) {
          return;
        }

        const currentState = useTutorialStore.getState();
        if (!currentState.isDemoActive || !voiceEnabled || activeSteps[currentState.currentStepIndex]?.id !== stepId) {
          return;
        }

        if (!blob || blob.size === 0) {
          throw new Error('Edge TTS returned empty audio payload');
        }

        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          if (activeSpeechIdRef.current === currentSpeechId) {
            setIsSpeaking(true);
          }
        };

        const cleanup = () => {
          URL.revokeObjectURL(audioUrl);
          if (audioRef.current === audio) {
            audioRef.current = null;
            setIsSpeaking(false);
          }
        };

        audio.onended = cleanup;
        audio.onerror = () => {
          cleanup();
          if (activeSpeechIdRef.current === currentSpeechId) {
            const st = useTutorialStore.getState();
            if (st.isDemoActive && voiceEnabled) {
              fallbackSpeechSynthesis(stepId, currentSpeechId);
            }
          }
        };

        if (activeSpeechIdRef.current !== currentSpeechId || !useTutorialStore.getState().isDemoActive) {
          cleanup();
          return;
        }

        await audio.play();
      } catch (err) {
        if (activeSpeechIdRef.current === currentSpeechId) {
          const st = useTutorialStore.getState();
          if (st.isDemoActive && voiceEnabled) {
            console.warn('Edge TTS unavailable, using native SpeechSynthesis fallback:', err);
            fallbackSpeechSynthesis(stepId, currentSpeechId);
          }
        }
      }
    },
    [voiceEnabled, voiceType, setIsSpeaking, i18n, fallbackSpeechSynthesis, activeSteps]
  );

  // Proactively prefetch the next step in the background for the current language and gender
  useEffect(() => {
    if (!isDemoActive || !currentStep) return;
    const normLang = (i18n.language || 'en').startsWith('hi') ? 'hi' : (i18n.language || 'en').startsWith('gu') ? 'gu' : 'en';

    // Prefetch the next step for current lang & current gender to save TTS rate limits
    const nextStep = activeSteps[currentStepIndex + 1];
    if (nextStep) {
      fetchAndCacheAudio(nextStep.id, normLang, voiceType, i18n, isMobileScreen);
    }
  }, [isDemoActive, currentStepIndex, voiceType, i18n.language, isMobileScreen, activeSteps, currentStep]);

  // Speak immediately when a step, language, or voice type becomes active
  useEffect(() => {
    if (!isDemoActive || !currentStep) {
      lastPlayedKeyRef.current = '';
      stopAllAudio();
      return;
    }
    if (!voiceEnabled) {
      lastPlayedKeyRef.current = '';
      stopAllAudio();
      return;
    }

    const normLang = (i18n.language || 'en').startsWith('hi') ? 'hi' : (i18n.language || 'en').startsWith('gu') ? 'gu' : 'en';
    const key = `${currentStep.id}_${normLang}_${voiceType}`;
    if (lastPlayedKeyRef.current === key) {
      return;
    }

    // Immediately stop old audio when settings/step change
    stopAllAudio();

    lastPlayedKeyRef.current = key;
    speak(currentStep.id);
  }, [isDemoActive, currentStepIndex, voiceEnabled, voiceType, i18n.language, currentStep?.id, speak, stopAllAudio]);

  // Stop speech when voice toggled off, demo disabled, or unmounted
  useEffect(() => {
    if (!voiceEnabled || !isDemoActive) {
      lastPlayedKeyRef.current = '';
      stopAllAudio();
    }
  }, [voiceEnabled, isDemoActive, stopAllAudio]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      lastPlayedKeyRef.current = '';
      stopAllAudio();
    };
  }, [stopAllAudio]);

// Helper to resolve the exact target element in the active/focused case window when multiple cases are open
function resolveTargetElement(selector: string): HTMLElement | null {
  if (!selector) return null;
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  if (elements.length === 0) return null;
  if (elements.length === 1) return elements[0];

  // 1. Highest priority: element inside the actively focused window
  const focusedEl = elements.find((el) => el.closest('[data-window-focused="true"]'));
  if (focusedEl) return focusedEl;

  // 2. Second priority: element inside a case_workspace with the highest z-index
  const scored = elements.map((el) => {
    const winEl = el.closest<HTMLElement>('[data-window-zindex]');
    const zIndex = winEl ? parseInt(winEl.getAttribute('data-window-zindex') || '0', 10) : 0;
    const isWorkspace = winEl?.getAttribute('data-window-type') === 'case_workspace';
    const rect = el.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= window.innerHeight;
    return {
      el,
      score: (isVisible ? 100000 : 0) + (isWorkspace ? 10000 : 0) + zIndex,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.el || elements[elements.length - 1];
}

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

      const el = resolveTargetElement(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect((prev) => {
          if (
            prev &&
            Math.abs(prev.top - rect.top) < 1 &&
            Math.abs(prev.left - rect.left) < 1 &&
            Math.abs(prev.width - rect.width) < 1 &&
            Math.abs(prev.height - rect.height) < 1
          ) {
            return prev;
          }
          return rect;
        });

        // Calculate card position dynamically measuring actual dimensions
        const cardEl = cardRef.current;
        const cardW = cardEl ? cardEl.offsetWidth : Math.min(460, window.innerWidth * 0.94);
        const cardH = cardEl ? cardEl.offsetHeight : 380;
        const gap = 16;
        let top = 0;
        let left = 0;

        // Mobile-aware placement calculation
        const isMobileScreen = window.innerWidth < 640;
        let effectivePlacement = currentStep.placement;
        if (isMobileScreen && (effectivePlacement === 'left' || effectivePlacement === 'right')) {
          effectivePlacement = rect.bottom + cardH + gap < window.innerHeight ? 'bottom' : 'top';
        }

        if (effectivePlacement === 'bottom') {
          top = rect.bottom + gap;
          left = rect.left + rect.width / 2 - cardW / 2;
          if (top + cardH > window.innerHeight - 12) {
            top = rect.top - gap - cardH;
          }
        } else if (effectivePlacement === 'top') {
          top = rect.top - gap - cardH;
          left = rect.left + rect.width / 2 - cardW / 2;
          if (top < 12) {
            top = rect.bottom + gap;
          }
        } else if (effectivePlacement === 'right') {
          top = rect.top + rect.height / 2 - cardH / 2;
          left = rect.right + gap;
          if (left + cardW > window.innerWidth - 12) {
            left = rect.left - gap - cardW;
          }
        } else if (effectivePlacement === 'left') {
          top = rect.top + rect.height / 2 - cardH / 2;
          left = rect.left - gap - cardW;
          if (left < 12) {
            left = rect.right + gap;
          }
        }

        // Strict boundary clamp to guarantee card is always 100% visible inside the window
        top = Math.max(12, Math.min(top, window.innerHeight - cardH - 12));
        left = Math.max(12, Math.min(left, window.innerWidth - cardW - 12));
        setCardPos((prev) => {
          if (Math.abs(prev.top - top) < 1 && Math.abs(prev.left - left) < 1) {
            return prev;
          }
          return { top, left };
        });
      } else {
        // Element not found — retry
        setTimeout(compute, 300);
      }
    };

    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    
    // Periodically re-check position in case windows are moved or focused
    const pollInterval = setInterval(compute, 500);

    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
      clearInterval(pollInterval);
    };
  }, [isDemoActive, currentStepIndex, currentStep]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDemoActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { handleStopDemo(); }
      if (e.key === 'ArrowRight' && !isLast && currentStep?.actionRequired !== 'click' && currentStep?.actionRequired !== 'input') { setDemoStep(currentStepIndex + 1); }
      if (e.key === 'ArrowLeft' && !isFirst) { setDemoStep(currentStepIndex - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDemoActive, currentStepIndex, isFirst, isLast, handleStopDemo, setDemoStep, currentStep]);

  // ── Action auto-advance listener ──────────────────────────────────────────
  useEffect(() => {
    const targetSel = currentStep?.actionTargetSelector || currentStep?.targetSelector;
    if (!isDemoActive || !currentStep || !currentStep.actionRequired || !targetSel) return;

    const action = currentStep.actionRequired;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.closest('[data-tutorial="seed-input"]')) {
        if (e.key === 'Enter') {
          const inputEl = target.closest('[data-tutorial="seed-input"]') as HTMLInputElement;
          if (inputEl && inputEl.value.trim().length > 0) {
            setDemoStep(currentStepIndex + 1);
          }
        }
      }
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Handle clicking the 'ADD SEED' button on seed-input step
      if (currentStep.id === 'seed-input' && target.closest('[data-tutorial="add-seed-btn"]')) {
        setTimeout(() => setDemoStep(currentStepIndex + 1), 100);
        return;
      }

      if (target.closest(targetSel)) {
        if (action === 'click') {
          setTimeout(() => setDemoStep(currentStepIndex + 1), 100);
        }
      }
    };

    const controller = new AbortController();

    document.addEventListener('click', onClick, { capture: true, signal: controller.signal });
    if (action === 'input') {
      document.addEventListener('keydown', onKeyDown, { capture: true, signal: controller.signal });
    }
    
    return () => controller.abort();
  }, [isDemoActive, currentStepIndex, currentStep, setDemoStep]);

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
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        onClick={handleStopDemo}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100000] flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase text-white hover:text-[#39ff14] border border-white/10 hover:border-[#39ff14]/50 hover:bg-[#39ff14]/10 transition-all backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)]"
      >
        <SkipForward size={12} />
        {transliterate('Skip Tour')}
        {!isMobileScreen && <span className="text-white/30 ml-1">ESC</span>}
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
            width: isCentered ? 'min(520px, 94vw)' : 'min(450px, 94vw)',
            maxHeight: 'min(90vh, 580px)',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Glass card */}
          <div
            className="relative rounded-2xl flex flex-col overflow-hidden max-h-full flex-1"
            style={{
              background: 'rgba(6,10,18,0.97)',
              border: `1px solid ${accent}40`,
              boxShadow: `0 0 40px ${accent}22, 0 24px 60px rgba(0,0,0,0.6)`,
              backdropFilter: 'blur(20px)',
              maxHeight: 'min(90vh, 580px)',
            }}
          >
            {/* Top accent line */}
            <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 pt-3.5 pb-2.5 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <LeoAvatar isSpeaking={isSpeaking} accentColor={accent} />
                <div className="min-w-0">
                  <div className="text-[8.5px] font-bold tracking-[0.15em] uppercase mb-0.5 truncate" style={{ color: `${accent}99` }}>
                    {`${t('demo_tour.leo_guide', 'LEO GUIDE')}  ::  ${t('demo_tour.step_indicator', { current: currentStepIndex + 1, total: activeSteps.length, defaultValue: `STEP ${currentStepIndex + 1} OF ${activeSteps.length}` })}`}
                  </div>
                  <div
                    className="text-xs sm:text-sm font-bold tracking-wider truncate"
                    style={{ color: accent, fontFamily: 'var(--font-heading)' }}
                  >
                    {t(`demo_tour.steps.${currentStep.id}.title`, currentStep.title)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {/* Voice toggle */}
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className="p-1.5 rounded-lg border transition-all"
                  style={voiceEnabled
                    ? { background: `${accent}20`, border: `1px solid ${accent}50`, color: accent }
                    : { background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }
                  }
                  title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
                >
                  {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>

                {/* Voice Type Toggle */}
                {voiceEnabled && (
                  <button
                    onClick={() => setVoiceType(voiceType === 'Female' ? 'Male' : 'Female')}
                    className="px-2 py-1 rounded-lg border transition-all text-[9px] font-bold"
                    style={{ background: `${accent}10`, border: `1px solid ${accent}40`, color: accent }}
                    title={`Switch to ${voiceType === 'Female' ? 'Male' : 'Female'} voice`}
                  >
                    {voiceType === 'Female' ? 'F' : 'M'}
                  </button>
                )}

                {/* Close */}
                <button
                  onClick={handleStopDemo}
                  className="p-1.5 rounded-lg border border-red-500/30 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Icon + message body (scrollable, flex-1) */}
            <div className="px-4 sm:px-5 py-3 overflow-y-auto flex-1 min-h-0" style={{ scrollbarWidth: 'thin' }}>
              <div className="flex gap-2.5">
                {/* Step icon */}
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
                  style={{ background: `${accent}18`, border: `1px solid ${accent}30`, color: accent }}
                >
                  {currentStep.icon}
                </div>

                {/* Typewriter text */}
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'rgba(230,237,243,0.88)', fontFamily: 'var(--font-mono)', fontSize: "calc(11.5px * var(--font-scale))" }}>
                  <TypewriterText
                    key={`${currentStep.id}-${isMobileScreen}`}
                    text={getStepMessage(currentStep, isMobileScreen, t, i18n)}
                  />
                </p>
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-4 sm:px-5 pb-3 pt-2 flex-shrink-0 flex-wrap gap-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <ProgressDots
                total={activeSteps.length}
                current={currentStepIndex}
                accentColor={accent}
              />

              <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap ml-auto">
                {/* Prev */}
                {!isFirst && (
                  <button
                    onClick={() => setDemoStep(currentStepIndex - 1)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider border border-white/10 text-white/50 hover:text-white hover:border-white/25 transition-all flex-shrink-0"
                    style={{ fontSize: "calc(10.5px * var(--font-scale))" }}
                  >
                    <ChevronLeft size={12} />
                    {transliterate('Prev')}
                  </button>
                )}

                {/* Next / Finish */}
                {currentStep.actionRequired ? (
                   <div className="px-2 py-1 rounded-lg font-bold uppercase tracking-wider border border-[#39ff14]/30 text-[#39ff14] animate-pulse whitespace-nowrap flex-shrink-0"
                     style={{ fontSize: "calc(9px * var(--font-scale))" }}>
                     {transliterate(currentStep.actionRequired === 'click' ? 'Awaiting Click' : (isMobileScreen ? 'Awaiting Tap' : 'Awaiting Input'))}
                   </div>
                ) : isLast ? (
                  <button
                    onClick={handleStopDemo}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all flex-shrink-0"
                    style={{
                      background: accent,
                      color: '#000',
                      boxShadow: `0 0 16px ${accent}60`,
                      fontSize: "calc(10.5px * var(--font-scale))"
                    }}
                  >
                    <Play size={11} fill="currentColor" />
                    {transliterate('Launch Mission')}
                  </button>
                ) : (
                  <button
                    onClick={() => setDemoStep(currentStepIndex + 1)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-bold uppercase tracking-wider transition-all flex-shrink-0"
                    style={{
                      background: accent,
                      color: '#000',
                      boxShadow: `0 0 12px ${accent}50`,
                      fontSize: "calc(10.5px * var(--font-scale))"
                    }}
                  >
                    {transliterate('Next')}
                    <ChevronRight size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Keyboard / Navigation hint */}
            <div
              className="text-center pb-2.5 text-[8.5px] tracking-widest uppercase flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              {transliterate(isMobileScreen ? 'Tap buttons to navigate' : 'Arrow keys to navigate  ::  ESC to skip')}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
