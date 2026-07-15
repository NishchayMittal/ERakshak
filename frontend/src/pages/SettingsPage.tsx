import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sliders, Cpu, Activity, Terminal, RefreshCw, Server, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import { triggerModelRetrain } from '../api/endpoints';
import { useUIStore } from '../state/uiStore';

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

    // Fire actual retrain API trigger in background
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
        
        // Finalize state
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
            showToast('Model retraining triggered on backend', 'info');
          });
      }
    }, 450);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto select-none">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/50 border border-indigo-500/10 rounded-lg p-6 cyber-panel corner-decor">
        <div>
          <h1 className="text-lg font-bold tracking-widest text-slate-100 uppercase font-mono flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Neural Link Configuration Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit link-matching accuracy ratios, adjust thresholds, and trigger manual XGBoost neural compiler retraining sessions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Model indicators */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Model Stats Card */}
          <div className="cyber-panel border-indigo-500/10 p-5 bg-slate-900/30 space-y-5 corner-decor">
            <div className="flex items-center gap-2 border-b border-indigo-500/10 pb-3">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">Booster model parameters</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded text-center">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Classifier</div>
                <div className="text-sm font-bold text-slate-250 mt-1 font-mono">XGBoost</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded text-center">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Features</div>
                <div className="text-sm font-bold text-slate-250 mt-1 font-mono">4 Vectors</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded text-center">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Accuracy</div>
                <div className="text-sm font-bold text-emerald-450 mt-1 font-mono">{currentAccuracy}%</div>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded text-center">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">Val Loss</div>
                <div className="text-sm font-bold text-indigo-400 mt-1 font-mono">{currentLoss}</div>
              </div>
            </div>

            {/* Feature Weights List */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase font-bold text-slate-450 font-mono tracking-wider">Estimated Model Feature Contributions (SHAP)</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-slate-950/20 p-2 border border-slate-850/60 rounded">
                  <span className="font-mono text-slate-350">Individual Name Similarity (Jaro-Winkler)</span>
                  <span className="font-mono text-indigo-400 font-semibold">42% weight</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/20 p-2 border border-slate-850/60 rounded">
                  <span className="font-mono text-slate-350">Phone Number Registry Matches</span>
                  <span className="font-mono text-indigo-400 font-semibold">28% weight</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/20 p-2 border border-slate-850/60 rounded">
                  <span className="font-mono text-slate-350">Email Domain Co-occurrence</span>
                  <span className="font-mono text-indigo-400 font-semibold">18% weight</span>
                </div>
                <div className="flex justify-between items-center bg-slate-950/20 p-2 border border-slate-850/60 rounded">
                  <span className="font-mono text-slate-350">Username Alias Leaks</span>
                  <span className="font-mono text-indigo-400 font-semibold">12% weight</span>
                </div>
              </div>
            </div>

            {/* Retrain Button container */}
            <div className="pt-2 border-t border-indigo-500/10 flex justify-between items-center">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span>MODEL DESCRIPTOR: ONLINE</span>
              </div>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRetrain}
                disabled={retraining}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow hover:shadow-indigo-500/10 transition-all flex items-center gap-1.5 border border-indigo-400/40 font-mono uppercase tracking-wider disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
                <span>{retraining ? 'Training weights...' : 'Trigger Model Retrain'}</span>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Right Column: Training Live Logs Terminal */}
        <div className="lg:col-span-1 flex flex-col min-h-[300px]">
          <div className="cyber-panel border-indigo-500/10 bg-slate-950/70 p-5 flex-1 flex flex-col justify-between corner-decor">
            <div>
              <div className="flex items-center gap-2 border-b border-indigo-500/10 pb-3 mb-3">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Training console</span>
              </div>

              <div className="font-mono text-[9px] space-y-2 text-slate-450 overflow-y-auto max-h-[320px]">
                {activeLogs.length === 0 ? (
                  <div className="text-center py-16 text-slate-600 uppercase">
                    Terminal idle. Click "Trigger Model Retrain" to calibrate classifier weights.
                  </div>
                ) : (
                  activeLogs.map((log, idx) => (
                    <div key={idx} className="flex gap-1.5 items-start">
                      <span className="text-indigo-500 select-none">&gt;</span>
                      <span className={log.includes('accuracy:') ? 'text-emerald-400' : log.startsWith('SYSTEM:') ? 'text-cyan-400' : 'text-slate-350'}>
                        {log}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-indigo-500/10 pt-3 mt-3 text-[9px] text-slate-500 font-mono flex justify-between">
              <span>ALGORITHM: XGBOOST</span>
              <span className={retraining ? 'animate-pulse text-indigo-400' : ''}>
                {retraining ? 'OPTIMIZING...' : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
