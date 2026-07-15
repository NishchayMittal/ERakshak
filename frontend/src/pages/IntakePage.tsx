import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Cpu, Server, Terminal, Search, Database, CheckCircle2, RefreshCw } from 'lucide-react';
import IdentifierForm from '../components/intake/IdentifierForm';
import IdentifierChip from '../components/intake/IdentifierChip';
import DisambiguationModal from '../components/intake/DisambiguationModal';
import { useCaseStore } from '../state/caseStore';
import { useUIStore } from '../state/uiStore';
import { submitIdentifiers } from '../api/endpoints';
import type { IdentifierType } from '../types/identifier';

interface SeedItem {
  id: string;
  type: IdentifierType;
  value: string;
}

const PIPELINE_PHASES = [
  { label: 'Normalizing Raw Seed Strings', detail: 'Transliterating Indic scripts & regex sanitizing' },
  { label: 'WHOIS Registrar Ingestion', detail: 'Extracting contact names, emails, and historic dates' },
  { label: 'Subdomain Log Transcribing', detail: 'Scraping crt.sh certificate transparency logs' },
  { label: 'Sherlock Profiler Enumeration', detail: 'Scanning active user footprints across 280+ portals' },
  { label: 'Facial Headshot Variance Analysis', detail: 'Running Pure-Python grayscale pixel MSE comparison' },
  { label: 'NetworkX Correlation Mapping', detail: 'Structuring pivot nodes and link weights' }
];

const MOCK_PIPELINE_LOGS = [
  'INGEST: Stripping URL wrappers & normalizing input phone patterns...',
  'INGEST: Indic Transliterator romanized native string tokens.',
  'WHOIS: Pinging rdap.org root registry servers...',
  'WHOIS: registrant contact organization parsed: "SecureHosting Ltd".',
  'CRT.SH: Querying PostgreSQL public logs registry for wildcard subdomains...',
  'CRT.SH: Found 12 certified assets linked to target root domain.',
  'SHERLOCK: Fetching user handles on GitHub, Twitter, Instagram, Reddit...',
  'SHERLOCK: Entity handle collision flagged on 4 active endpoints.',
  'FACE: Loading target dossier image directories...',
  'FACE: Running downscaled grayscale variance matcher on pixel matrices.',
  'NETWORK: Graph nodes mapped. 4 edges with confidence metrics injected.',
  'SYSTEM: Audit event logged to SQLite. Link weight compile finished.'
];

export default function IntakePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { activeCase, selectCase } = useCaseStore();
  const { showToast } = useUIStore();

  const [seeds, setSeeds] = useState<SeedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDisambiguateOpen, setIsDisambiguateOpen] = useState(false);
  const [ambiguousName, setAmbiguousName] = useState('');

  // Interactive Loader States
  const [pipelineProgress, setPipelineProgress] = useState<number | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [savedApiResponse, setSavedApiResponse] = useState<any>(null);

  useEffect(() => {
    if (caseId) {
      selectCase(caseId);
    }
  }, [caseId, selectCase]);

  const handleAddSeed = (type: IdentifierType, value: string) => {
    if (seeds.some(s => s.type === type && s.value.toLowerCase() === value.toLowerCase())) {
      showToast('Identifier is already in pending queue', 'info');
      return;
    }

    const newSeed: SeedItem = {
      id: `seed-${Date.now()}`,
      type,
      value
    };
    
    setSeeds([...seeds, newSeed]);
    showToast(`Added ${type} seed to scan queue`, 'success');
  };

  const handleDeleteSeed = (id: string) => {
    setSeeds(seeds.filter(s => s.id !== id));
  };

  // Simulated visual intake pipeline sequence
  const handleRunAnalysis = async () => {
    if (seeds.length === 0) {
      showToast('Please register at least one seed identifier first', 'error');
      return;
    }

    if (!caseId) return;

    setSubmitting(true);
    setPipelineProgress(0);
    setActivePhase(0);
    setLiveLogs([MOCK_PIPELINE_LOGS[0]]);

    let currentProgress = 0;
    let currentPhase = 0;
    let logIndex = 1;

    // Trigger API request immediately in the background
    const apiCallPromise = (async () => {
      const payload = seeds.map(s => ({
        type: s.type,
        rawValue: s.value,
      }));
      return submitIdentifiers(caseId, payload);
    })();

    // Animation interval (4.8 seconds total duration)
    const interval = setInterval(async () => {
      currentProgress += 5;
      
      if (currentProgress % 15 === 0 && currentPhase < PIPELINE_PHASES.length - 1) {
        currentPhase += 1;
        setActivePhase(currentPhase);
      }

      setPipelineProgress(currentProgress);

      // Append live logs matching the current speed
      if (currentProgress % 10 === 0 && logIndex < MOCK_PIPELINE_LOGS.length) {
        setLiveLogs(prev => [...prev, MOCK_PIPELINE_LOGS[logIndex]]);
        logIndex += 1;
      }

      // Finish sequence
      if (currentProgress >= 100) {
        clearInterval(interval);
        
        try {
          const res = await apiCallPromise;
          setPipelineProgress(null);
          setSubmitting(false);

          if (res.ambiguous) {
            const nameSeed = seeds.find(s => s.type === 'name');
            setAmbiguousName(nameSeed ? nameSeed.value : 'submitted name');
            setIsDisambiguateOpen(true);
          } else {
            showToast('OSINT source connectors compiled. Correlation map compiled.', 'success');
            navigate(`/cases/${caseId}/entities/n1`);
          }
        } catch (err) {
          console.error(err);
          setPipelineProgress(null);
          setSubmitting(false);
          showToast('Failed to trigger ingestion pipeline backend', 'error');
        }
      }
    }, 240);
  };

  const handleDisambiguationSubmit = (anchors: { city: string; age: string; employer: string }) => {
    setIsDisambiguateOpen(false);
    showToast(`Anchors registered: [${anchors.city}, ${anchors.employer}]. Correlation pipeline active.`, 'success');
    if (caseId) {
      navigate(`/cases/${caseId}/entities/n1`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto select-none">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/cases" className="text-xs text-slate-500 hover:text-slate-350 flex items-center gap-1.5 mb-1.5 transition-colors uppercase font-mono">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to dossiers</span>
          </Link>
          <h1 className="text-lg font-bold tracking-widest text-slate-100 font-mono uppercase glow-text-indigo">Seed Ingestion Inlets</h1>
          <p className="text-xs text-slate-400 mt-1">
            Feed investigator intelligence keys into the parser to concurrently sweep certificates, DNS profiles, usernames, and breach footprints.
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {pipelineProgress !== null ? (
          // Ingestion pipeline active screen
          <motion.div 
            key="loader"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6"
          >
            {/* Left Column: Progress checklist */}
            <div className="md:col-span-7 bg-slate-900/40 border border-indigo-500/10 rounded-lg p-5 cyber-panel corner-decor flex flex-col justify-between min-h-[360px]">
              <div>
                <div className="flex items-center gap-2 border-b border-indigo-500/10 pb-3 mb-4">
                  <Cpu className="w-4 h-4 text-indigo-400 animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-350 font-mono">Active Correlators</span>
                </div>

                <div className="space-y-4">
                  {PIPELINE_PHASES.map((p, idx) => {
                    const isDone = activePhase > idx;
                    const isActive = activePhase === idx;
                    return (
                      <div key={idx} className={`flex items-start gap-3 transition-colors duration-200 ${
                        isDone ? 'text-indigo-400' : isActive ? 'text-cyan-400' : 'text-slate-600'
                      }`}>
                        <div className="mt-0.5">
                          {isDone ? (
                            <CheckCircle2 className="w-4.5 h-4.5 text-indigo-400" />
                          ) : isActive ? (
                            <div className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                          ) : (
                            <div className="w-4.5 h-4.5 rounded-full border border-slate-700 bg-slate-950 flex items-center justify-center text-[9px] font-mono font-bold">
                              {idx + 1}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-bold tracking-wider font-mono uppercase">{p.label}</div>
                          <div className="text-[10px] text-slate-500 font-sans mt-0.5">{p.detail}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress bar container */}
              <div className="space-y-2 pt-4 border-t border-indigo-500/10 mt-4">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span>PIPELINE DISPATCHED</span>
                  <span className="text-cyan-400 font-bold">{pipelineProgress}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded border border-indigo-500/15 overflow-hidden p-0.5">
                  <motion.div 
                    style={{ width: `${pipelineProgress}%` }}
                    className="h-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-400 rounded-sm"
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Scrolling logs */}
            <div className="md:col-span-5 flex flex-col gap-6">
              {/* Telemetry log window */}
              <div className="cyber-panel border-indigo-500/10 bg-slate-950/60 p-5 flex-1 min-h-[220px] flex flex-col justify-between corner-decor">
                <div className="flex items-center gap-2 border-b border-indigo-500/10 pb-3 mb-3">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Crawler Logs</span>
                </div>

                <div className="flex-1 font-mono text-[9px] space-y-2 text-slate-450 overflow-y-auto max-h-[200px]">
                  {liveLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-1.5 items-start">
                      <span className="text-indigo-500 select-none">&gt;</span>
                      <span className="text-slate-350">{log}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-indigo-500/10 pt-3 mt-3 text-[9px] text-slate-500 font-mono text-center flex justify-between">
                  <span>SYNC_GATE: PORT 8000</span>
                  <span className="animate-pulse">PARSING SEEDS...</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          // Ingestion forms screen
          <motion.div 
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Input form */}
            <IdentifierForm onAdd={handleAddSeed} />

            {/* Ingestion Board */}
            <div className="bg-slate-900/40 border border-indigo-500/10 rounded-lg p-5 cyber-panel corner-decor">
              <div className="flex justify-between items-center border-b border-indigo-500/10 pb-3 mb-4">
                <h3 className="font-bold text-slate-200 text-xs tracking-wider uppercase font-mono flex items-center gap-1.5">
                  <Database className="w-4.5 h-4.5 text-indigo-400" />
                  Ingest Queue ({seeds.length})
                </h3>
              </div>
              
              {seeds.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-550 border border-dashed border-indigo-500/10 rounded-lg bg-slate-950/20 font-mono">
                  SEED POOL EMPTY. ADD IDENTIFIER KEYS TO DISPATCH CRAWLERS.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* List of Chips */}
                  <div className="flex flex-wrap gap-2.5">
                    <AnimatePresence>
                      {seeds.map((s) => (
                        <IdentifierChip 
                          key={s.id} 
                          id={s.id} 
                          type={s.type} 
                          rawValue={s.value} 
                          onDelete={handleDeleteSeed} 
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Run Button */}
                  <div className="pt-4 border-t border-indigo-500/10 flex justify-end">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleRunAnalysis}
                      disabled={submitting}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow hover:shadow-indigo-500/15 transition-all flex items-center gap-2 border border-indigo-400/45 disabled:opacity-55 tracking-wider uppercase font-mono"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Dispatch Crawl Pipeline</span>
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disambiguation Modal Popup */}
      <DisambiguationModal
        isOpen={isDisambiguateOpen}
        onClose={() => setIsDisambiguateOpen(false)}
        onSubmit={handleDisambiguationSubmit}
        ambiguousName={ambiguousName}
      />
    </div>
  );
}
