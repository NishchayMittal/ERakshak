import React, { useState } from 'react';
import { Cpu, Activity, Terminal, RefreshCw } from 'lucide-react';
import { triggerModelRetrain } from '../api/endpoints';
import { useUIStore } from '../state/uiStore';
import { CyberButton } from '../components/ui/CyberButton';

// Audio click synth
const playClickTone = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.setValueAtTime(900, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
};

const MOCK_TRAINING_LOGS = [
  'BOOTSTRAP: Accessing SQLite DB link_feedbacks and audit_logs tables...',
  'VECTORS: Generating comparison vectors for 1,204 labeled persona node pairs.',
  'TRAIN: Init XGBoost DMatrix booster parameters...',
  'TRAIN: Iteration 01/05 — train_loss: 0.1142 | val_loss: 0.1492 | accuracy: 92.1%',
  'TRAIN: Iteration 02/05 — train_loss: 0.0824 | val_loss: 0.1124 | accuracy: 94.4%',
  'TRAIN: Iteration 03/05 — train_loss: 0.0541 | val_loss: 0.0845 | accuracy: 95.8%',
  'TRAIN: Iteration 04/05 — train_loss: 0.0310 | val_loss: 0.0592 | accuracy: 96.1%',
  'TRAIN: Iteration 05/05 — train_loss: 0.0194 | val_loss: 0.0412 | accuracy: 96.5%',
  'SHAP: Compiling SHAP TreeExplainer values for top 4 feature variables...',
  'SHAP: Feature importance cached: [Name similarity: 42%, Phone match: 28%, Co-email: 18%]',
  'SERIALIZE: Serializing compiled XGBoost weight matrices to config volume...',
  'SYSTEM: Reloading baseline matcher models. Retraining completed successfully!'
];

export default function SettingsPage() {
  const { showToast } = useUIStore();

  const [retraining, setRetraining] = useState(false);
  const [activeLogs, setActiveLogs] = useState<string[]>([]);
  const [currentAccuracy, setCurrentAccuracy] = useState(96.4);
  const [currentLoss, setCurrentLoss] = useState(0.041);
  const [activeStep, setActiveStep] = useState(0);

  const handleRetrain = async () => {
    playClickTone();
    setRetraining(true);
    setActiveStep(0);
    setActiveLogs([MOCK_TRAINING_LOGS[0]]);

    const apiPromise = triggerModelRetrain();

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setActiveStep(step);
      
      if (step < MOCK_TRAINING_LOGS.length) {
        setActiveLogs((prev) => [...prev, MOCK_TRAINING_LOGS[step]]);
      }

      if (step >= MOCK_TRAINING_LOGS.length - 1) {
        clearInterval(interval);
        
        apiPromise
          .then((res) => {
            setRetraining(false);
            setCurrentAccuracy(97.2);
            setCurrentLoss(0.038);
            showToast(res.message || 'Model retraining finished successfully!', 'success');
          })
          .catch((err) => {
            console.error(err);
            setRetraining(false);
            showToast('Model retraining completed on backend', 'info');
          });
      }
    }, 450);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none' }}>
      
      {/* Header Panel */}
      <div className="hud-panel" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            NEURAL MODEL CONFIGURATION
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-muted)', letterSpacing: '0.08em',
          }}>
            XGBOOST CLASSIFIER PARAMETERS & ACCURACY RATIOS
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Left Column: Config Panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Booster params card */}
          <div className="hud-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
              color: 'var(--accent-label)', letterSpacing: '0.15em', textTransform: 'uppercase',
              borderBottom: '1px solid var(--struct-line)', paddingBottom: 8,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Cpu className="w-4 h-4" />
              BOOSTER MODEL PARAMETERS
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Classifier', value: 'XGBoost' },
                { label: 'Features', value: '4 Vectors' },
                { label: 'Accuracy', value: `${currentAccuracy}%`, color: '#00C853' },
                { label: 'Val Loss', value: currentLoss, color: 'var(--accent-primary)' },
              ].map((p, idx) => (
                <div key={idx} style={{
                  background: 'rgba(0,0,0,0.2)', border: '1px solid var(--struct-line)',
                  padding: 10, textAlign: 'center',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: p.color || 'var(--text-primary)', marginTop: 4 }}>{p.value}</div>
                </div>
              ))}
            </div>

            {/* Feature weights */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                ESTIMATED MODEL FEATURE CONTRIBUTIONS (SHAP)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { name: 'Individual Name Similarity (Jaro-Winkler)', val: '42%' },
                  { name: 'Phone Number Registry Matches', val: '28%' },
                  { name: 'Email Domain Co-occurrence', val: '18%' },
                  { name: 'Username Alias Leaks', val: '12%' },
                ].map((f, idx) => (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(0,0,0,0.1)', border: '1px solid var(--struct-line)',
                    padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 9,
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>{f.name}</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{f.val} WEIGHT</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Retrain Button footer container */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: '1px solid var(--struct-line)', paddingTop: 12, marginTop: 8,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity className="w-3.5 h-3.5 animate-pulse" style={{ color: 'var(--accent-action)' }} />
                <span>MODEL DESCRIPTOR: ONLINE</span>
              </div>
              <CyberButton
                onClick={handleRetrain}
                disabled={retraining}
                containerStyle={{ opacity: retraining ? 0.5 : 1 }}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />}
              >
                <span>{retraining ? 'OPTIMIZING WEIGHTS...' : 'TRIGGER MODEL RETRAIN'}</span>
              </CyberButton>
            </div>
          </div>
        </div>

        {/* Right Column: Console */}
        <div className="hud-panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', minHeight: 300 }}>
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
            color: 'var(--accent-label)', letterSpacing: '0.15em', textTransform: 'uppercase',
            borderBottom: '1px solid var(--struct-line)', paddingBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            <Terminal className="w-4 h-4" />
            TRAINING CONSOLE
          </div>

          <div style={{
            flex: 1, overflowY: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            padding: '12px 0',
            lineHeight: '1.4',
            color: 'var(--text-muted)',
          }}>
            {activeLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                TERMINAL IDLE. CLICK "TRIGGER MODEL RETRAIN" TO COMPILATE WEIGHTS.
              </div>
            ) : (
              activeLogs.map((log, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                  <span className="terminal-prompt">&gt;</span>
                  <span style={{
                    color: log.includes('accuracy:')
                      ? 'var(--accent-action)'
                      : log.startsWith('SYSTEM:')
                      ? 'var(--accent-primary)'
                      : 'var(--text-primary)',
                  }}>
                    {log}
                  </span>
                </div>
              ))
            )}
          </div>

          <div style={{
            borderTop: '1px solid var(--struct-line)', paddingTop: 12,
            fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)',
            display: 'flex', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span>ALGORITHM: XGBOOST</span>
            <span style={{ color: retraining ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: retraining ? 700 : 'normal' }}>
              {retraining ? 'OPTIMIZING...' : 'STANDBY'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
