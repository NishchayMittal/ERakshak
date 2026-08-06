import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Play, Cpu, Database, Terminal } from 'lucide-react';
import IdentifierForm from '../components/intake/IdentifierForm';
import IdentifierChip from '../components/intake/IdentifierChip';
import DisambiguationModal from '../components/intake/DisambiguationModal';
import { useCaseStore } from '../state/caseStore';
import { useUIStore } from '../state/uiStore';
import { submitIdentifiers } from '../api/endpoints';
import type { IdentifierType } from '../types/identifier';
import { CyberButton } from '../components/ui/CyberButton';

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

interface IntakePageProps {
  caseId?: string;
  onPipelineComplete?: (firstSeed: string) => void;
}

export default function IntakePage({ caseId: propCaseId, onPipelineComplete }: IntakePageProps = {}) {
  const params = useParams<{ caseId: string }>();
  const caseId = propCaseId || params.caseId;
  const navigate = useNavigate();
  const { selectCase } = useCaseStore();
  const { showToast } = useUIStore();
  const { t } = useTranslation();

  const [seeds, setSeeds] = useState<SeedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDisambiguateOpen, setIsDisambiguateOpen] = useState(false);
  const [ambiguousName, setAmbiguousName] = useState('');

  // Interactive Loader States
  const [pipelineProgress, setPipelineProgress] = useState<number | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);

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
  const executePipeline = async (metadataAnchors?: { city: string; age: string; employer: string }) => {
    setSubmitting(true);
    setPipelineProgress(0);
    setActivePhase(0);
    setLiveLogs([MOCK_PIPELINE_LOGS[0]]);

    let currentProgress = 0;
    let currentPhase = 0;
    let logIndex = 1;

    // Trigger API request immediately in the background
    const apiCallPromise = (async () => {
      const payload = seeds.map(s => {
        const item: { type: string; rawValue: string; metadata?: Record<string, string> } = {
          type: s.type,
          rawValue: s.value
        };
        if (s.type === 'name' && metadataAnchors) {
          item.metadata = { 
            city: metadataAnchors.city,
            age: metadataAnchors.age,
            employer: metadataAnchors.employer
          };
        }
        return item;
      });
      return submitIdentifiers(caseId!, payload);
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
          await apiCallPromise;
          setPipelineProgress(null);
          setSubmitting(false);

          showToast('OSINT source connectors compiled. Correlation map compiled.', 'success');
          const firstSeed = seeds[0] ? encodeURIComponent(seeds[0].value.trim().toLowerCase()) : 'n1';
          if (onPipelineComplete) {
            onPipelineComplete(firstSeed);
          } else {
            navigate(`/cases/${caseId}/entities/${firstSeed}`);
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

  const handleRunAnalysis = async () => {
    if (seeds.length === 0) {
      showToast('Please register at least one seed identifier first', 'error');
      return;
    }

    if (!caseId) return;

    // Intercept if there's a name identifier to collect anchors FIRST
    const nameSeed = seeds.find(s => s.type === 'name');
    if (nameSeed) {
      setAmbiguousName(nameSeed.value);
      setIsDisambiguateOpen(true);
      return;
    }

    // Otherwise, execute pipeline normally without metadata
    executePipeline();
  };

  const handleDisambiguationSubmit = (anchors: { city: string; age: string; employer: string }) => {
    setIsDisambiguateOpen(false);
    showToast(`Anchors registered: [${anchors.city}, ${anchors.employer}]. Correlation pipeline active.`, 'success');
    
    // Execute pipeline with the collected anchors
    executePipeline(anchors);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none' }}>
      {/* Header Info */}
      <div className="hud-panel" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Link to="/cases" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-muted)', textDecoration: 'none', letterSpacing: '0.05em',
            textTransform: 'uppercase', marginBottom: 4,
          }}>
            <ArrowLeft className="w-3 h-3" />
            BACK TO CASES
          </Link>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            SEED INGESTION INLETS
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-muted)', letterSpacing: '0.08em',
          }}>
            DISPATCH INVESTIGATION KEYS INTO Crawlers AND OSINT PLUGINS
          </p>
        </div>
      </div>

      {pipelineProgress !== null ? (
        // Ingestion pipeline active screen
        <div className="intake-grid">
          {/* Left Column: Progress checklist */}
          <div className="hud-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 360 }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
              color: 'var(--accent-label)', letterSpacing: '0.15em', textTransform: 'uppercase',
              borderBottom: '1px solid var(--struct-line)', paddingBottom: 8,
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 16,
            }}>
              <Cpu className="w-4 h-4 animate-spin" />
              ACTIVE CORRELATORS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {PIPELINE_PHASES.map((p, idx) => {
                const isDone = activePhase > idx;
                const isActive = activePhase === idx;
                const color = isDone ? 'var(--accent-primary)' : isActive ? 'var(--accent-primary)' : 'var(--text-muted)';
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    color, transition: 'color 0.2s',
                  }}>
                    <div style={{ marginTop: 2 }}>
                      {isDone ? (
                        <span style={{ color: 'var(--accent-action)', fontWeight: 'bold', fontSize: 10 }}>✓</span>
                      ) : isActive ? (
                        <div style={{ width: 12, height: 12, border: '2px solid var(--accent-action)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <div style={{
                          width: 12, height: 12, border: '1px solid var(--struct-line)',
                          background: '#030609', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 7, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
                        }}>
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>{p.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div style={{ borderTop: '1px solid var(--struct-line)', paddingTop: 16, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>{t('intake.pipeline_dispatched')}</span>
                <span style={{ color: 'var(--accent-action)', fontWeight: 'bold' }}>{pipelineProgress}%</span>
              </div>
              <div style={{ background: '#030609', height: 10, border: '1px solid var(--struct-line)', padding: 1, position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: `${pipelineProgress}%`, height: '100%', background: 'var(--accent-action)', boxShadow: '0 0 4px var(--accent-action)', transition: 'width 0.1s linear' }} />
              </div>
            </div>
          </div>

          {/* Right Column: Scrolling logs */}
          <div className="hud-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 360 }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
              color: 'var(--accent-label)', letterSpacing: '0.15em', textTransform: 'uppercase',
              borderBottom: '1px solid var(--struct-line)', paddingBottom: 8,
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 16,
            }}>
              <Terminal className="w-4 h-4" />
              CRAWLER LOGS
            </div>

            <div style={{
              flex: 1, overflowY: 'auto',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              lineHeight: '1.4',
              color: 'var(--text-primary)',
            }}>
              {liveLogs.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                  <span className="terminal-prompt">&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>

            <div style={{
              borderTop: '1px solid var(--struct-line)', paddingTop: 12,
              fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>SYNC_GATE: PORT 8000</span>
              <span className="animate-pulse" style={{ color: 'var(--accent-action)' }}>{t('intake.parsing_seeds')}</span>
            </div>
          </div>
        </div>
      ) : (
        // Ingestion forms screen
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* Input form */}
          <IdentifierForm onAdd={handleAddSeed} />

          {/* Ingestion Board */}
          <div className="hud-panel" style={{ padding: 16 }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
              color: 'var(--accent-label)', letterSpacing: '0.15em', textTransform: 'uppercase',
              borderBottom: '1px solid var(--struct-line)', paddingBottom: 8,
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 16,
            }}>
              <Database className="w-4.5 h-4.5 text-indigo-400" />
              Ingest Queue ({seeds.length})
            </div>
            
            {seeds.length === 0 ? (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center',
                letterSpacing: '0.1em', background: '#0D1117', border: '1px dashed var(--struct-line)',
              }}>
                SEED POOL EMPTY. REGISTER IDENTIFIER KEYS ABOVE TO DISPATCH CRAWLERS.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {seeds.map((s) => (
                    <IdentifierChip 
                      key={s.id} 
                      id={s.id} 
                      type={s.type} 
                      rawValue={s.value} 
                      onDelete={handleDeleteSeed} 
                    />
                  ))}
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'flex-end',
                  borderTop: '1px solid var(--struct-line)', paddingTop: 12,
                }}>
                  <CyberButton
                    type="button"
                    onClick={handleRunAnalysis}
                    disabled={submitting}
                    containerStyle={{ opacity: submitting ? 0.5 : 1 }}
                    icon={<Play className="w-4 h-4 fill-current" />}
                  >
                    <span>{t('intake.dispatch_crawl_pipeline')}</span>
                  </CyberButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
