import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Terminal, Cpu, Globe, Activity, ChevronRight, AlertTriangle, Lock, User, Key, Server, Database } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUIStore } from '../state/uiStore';

// Web Audio API Synthesizer for high-tech sound effects
const playSynthSound = (type: 'click' | 'hover' | 'access_granted' | 'access_denied') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    if (type === 'hover') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.15);
      
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.05);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'access_granted') {
      const notes = [440, 554, 659, 880];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08);
        
        gain.gain.setValueAtTime(0.03, ctx.currentTime + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.08 + 0.2);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + index * 0.08);
        osc.stop(ctx.currentTime + index * 0.08 + 0.2);
      });
    } else if (type === 'access_denied') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    // Audio context initialization blocked/unavailable
  }
};

const MOCK_TELEMETRY = [
  'SYSTEM: Initializing e-Rakshak OSINT Gateway version 1.0.0...',
  'CONNECTOR: WHOIS/RDAP resolver initialized successfully.',
  'CONNECTOR: crt.sh certificate transparent crawler listening.',
  'CONNECTOR: Sherlock usernames matcher registry linked [284 domains].',
  'CORE: NetworkX MultiDiGraph link-analysis engine online.',
  'SYSTEM: Secure audit logging active on SQLite core database.',
  'THREAT: Monitoring active cybercrime nodes from regional feeds.',
  'DB: Cached records indexed. 42 target directories matching threat database.',
  'NET: Handshake established with central security registry.',
  'INGEST: Ready to scan target usernames, domains, and crypto wallets.',
];

export default function PortalPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('Leon Lobo');
  const [password, setPassword] = useState('••••••••');
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useUIStore();
  const navigate = useNavigate();
  
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([MOCK_TELEMETRY[0], MOCK_TELEMETRY[1]]);
  const [threatLevel, setThreatLevel] = useState('NORMAL');
  const [stats, setStats] = useState({ nodes: 1204, links: 4892, alerts: 14 });

  // Update telemetry logs dynamically
  useEffect(() => {
    let index = 2;
    const interval = setInterval(() => {
      setTelemetryLogs((prev) => {
        const next = [...prev, MOCK_TELEMETRY[index]];
        if (next.length > 8) next.shift();
        return next;
      });
      index = (index + 1) % MOCK_TELEMETRY.length;
      
      setStats((prev) => ({
        nodes: prev.nodes + (Math.random() > 0.6 ? 1 : 0),
        links: prev.links + (Math.random() > 0.5 ? 2 : -1),
        alerts: prev.alerts + (Math.random() > 0.95 ? 1 : 0),
      }));
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  // Cycle threat level for visual dynamic
  useEffect(() => {
    const levels = ['STABLE', 'MONITORING', 'ELEVATED', 'STABLE'];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % levels.length;
      setThreatLevel(levels[idx]);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  // Canvas particle nodes linkage animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
    }> = [];

    const particleCount = Math.min(65, Math.floor((width * height) / 25000));

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2.5 + 1.5,
        color: Math.random() > 0.8 ? '#06b6d4' : '#6366f1',
      });
    }

    let mouseX = -9999;
    let mouseY = -9999;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };

    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw cyber radar-like circles in center background
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.03)';
      ctx.lineWidth = 1;
      const centerX = width / 2;
      const centerY = height / 2;
      [150, 300, 450, 600].forEach((r) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Update & Draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce borders
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Connect to mouse
        if (mouseX !== -9999 && mouseY !== -9999) {
          const distMouse = Math.hypot(p.x - mouseX, p.y - mouseY);
          if (distMouse < 160) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseX, mouseY);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.15 * (1 - distMouse / 160)})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
        }
      });

      // Connect particles to each other
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.12 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (canvas) canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      playSynthSound('access_denied');
      showToast('Investigator ID signature required', 'error');
      return;
    }

    login(username);
    playSynthSound('access_granted');
    showToast(`Session authorized. Welcome back, Agent ${username}`, 'success');
    navigate('/cases');
  };

  const handleToggleLogin = () => {
    playSynthSound('click');
    if (isAuthenticated) {
      navigate('/cases');
    } else {
      setShowLogin(!showLogin);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden font-mono flex flex-col justify-between">
      {/* Background canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Cyber Grid pattern */}
      <div className="absolute inset-0 cyber-grid opacity-30 z-0 pointer-events-none" />
      <div className="absolute inset-0 scanline opacity-[0.03] z-10 pointer-events-none" />

      {/* Futuristic Header bar */}
      <header className="relative z-20 border-b border-indigo-500/10 bg-slate-950/70 backdrop-blur-md px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded border border-indigo-500/30 flex items-center justify-center bg-indigo-950/40 text-indigo-400 font-bold text-lg glow-shadow shadow-indigo-500/10">
              eR
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950 status-dot"></div>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-slate-200 uppercase">e-Rakshak Gateway</h1>
            <p className="text-[10px] text-indigo-400 font-mono tracking-tight">OSINT CORRELATION & COGNITIVE HUD</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-slate-400">
          <div className="hidden md:flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-500">FEDERATION:</span>
            <span className="text-emerald-400 font-semibold">ACTIVE</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-500">CORE SYNC:</span>
            <span className="text-slate-200">100% SECURE</span>
          </div>
        </div>
      </header>

      {/* Main visual HUD container */}
      <main className="flex-1 relative z-10 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left Side: Brand presentation & Stats */}
        <div className="flex-1 space-y-8 text-left max-w-xl">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 rounded text-[10px] font-semibold tracking-wider uppercase">
              <Shield className="w-3 h-3 text-indigo-400" />
              National Intelligence Protocol
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight font-sans">
              Trace Suspects. <br />
              <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent glitch-text">
                Map Cybercrime.
              </span>
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed font-sans">
              e-Rakshak is a secure federated Open-Source Intelligence (OSINT) utility built to ingest seed identities, query multiple intelligence connectors, transliterate scripts, and perform dynamic link-analysis maps under standard forensic audit logs.
            </p>
          </div>

          {/* Stats HUD layout */}
          <div className="grid grid-cols-3 gap-4">
            <div className="cyber-panel border-indigo-500/10 p-3 bg-slate-900/40 corner-decor">
              <div className="text-[9px] uppercase tracking-wider text-slate-500">Tracked Nodes</div>
              <div className="text-lg font-bold text-slate-200 font-mono mt-1 glow-text-indigo">{stats.nodes}</div>
            </div>
            <div className="cyber-panel border-indigo-500/10 p-3 bg-slate-900/40 corner-decor">
              <div className="text-[9px] uppercase tracking-wider text-slate-500">Correlated Links</div>
              <div className="text-lg font-bold text-slate-200 font-mono mt-1 glow-text-cyan">{stats.links}</div>
            </div>
            <div className="cyber-panel border-indigo-500/10 p-3 bg-slate-900/40 corner-decor">
              <div className="text-[9px] uppercase tracking-wider text-slate-500">System Threats</div>
              <div className="text-lg font-bold text-rose-400 font-mono mt-1">{stats.alerts}</div>
            </div>
          </div>

          {/* Action trigger button */}
          <div className="pt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onHoverStart={() => playSynthSound('hover')}
              onClick={handleToggleLogin}
              className="group relative px-8 py-3.5 overflow-hidden rounded bg-indigo-600 font-bold font-sans text-xs tracking-widest text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/35 transition-all flex items-center gap-2 border border-indigo-400/40"
            >
              <span>{isAuthenticated ? 'LAUNCH WORKSPACE' : 'INITIALIZE SYSTEM SESSION'}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000" />
            </motion.button>
          </div>
        </div>

        {/* Right Side: Embedded cyber system console details */}
        <div className="w-full lg:w-96 space-y-6">
          <div className="cyber-panel border-indigo-500/20 bg-slate-950/70 p-5 min-h-[220px] flex flex-col justify-between corner-decor">
            {/* HUD Status Header */}
            <div className="flex items-center justify-between border-b border-indigo-500/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Terminal Telemetry</span>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                threatLevel === 'ELEVATED' 
                  ? 'bg-rose-950/50 border border-rose-800 text-rose-400' 
                  : 'bg-indigo-950/50 border border-indigo-800 text-indigo-400'
              }`}>
                THREAT LEVEL: {threatLevel}
              </span>
            </div>

            {/* scrolling log lines */}
            <div className="flex-1 font-mono text-[10px] space-y-2 text-slate-400">
              {telemetryLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2 items-start overflow-hidden whitespace-nowrap text-ellipsis">
                  <span className="text-indigo-500 flex-shrink-0">&gt;</span>
                  <span className={log.startsWith('THREAT:') ? 'text-rose-400' : log.startsWith('SYSTEM:') ? 'text-cyan-400' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-indigo-500/10 pt-3 mt-3 flex items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>LATENCY: 12ms</span>
              <span>SECURE CONTEXT: LOCAL_STAGING</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Legal bar */}
      <footer className="relative z-20 border-t border-indigo-500/10 bg-slate-950/60 backdrop-blur px-6 py-3 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 font-mono gap-2">
        <span>STRICTLY AUTHORIZED FORENSIC USE ONLY</span>
        <span>COPYRIGHT © {new Date().getFullYear()} E-RAKSHAK PROJECT. ALL DIRECT ACTIONS LOGGED.</span>
      </footer>

      {/* Slide-In Authentication Drawer overlay */}
      <AnimatePresence>
        {showLogin && (
          <>
            {/* Backdrop cover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={handleToggleLogin}
              className="fixed inset-0 bg-slate-950 z-40"
            />

            {/* Right Drawer form */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-slate-950/95 border-l border-indigo-500/20 z-50 p-8 shadow-2xl flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex justify-between items-center border-b border-indigo-500/10 pb-4 mb-8">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    <span className="font-sans font-bold text-sm tracking-wider uppercase text-slate-100">SECURE SHELL GATEWAY</span>
                  </div>
                  <button 
                    onClick={handleToggleLogin}
                    className="text-slate-400 hover:text-white font-mono text-sm px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-indigo-500/40"
                  >
                    ESC
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-200 font-sans">Authorize Investigator</h3>
                    <p className="text-[11px] text-slate-400 font-sans mt-1">
                      Enter your accredited investigator signature name to authenticate your cryptographically audited logs session.
                    </p>
                  </div>

                  <form onSubmit={handleLoginSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">Investigator ID / Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded px-10 py-2.5 text-xs text-slate-200 font-mono outline-none transition-all"
                          placeholder="e.g. Inv. Leon Lobo"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">Investigative Passphrase</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded px-10 py-2.5 text-xs text-slate-200 font-mono outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-950/20 border border-emerald-800/20 p-2.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                      <span>GATEWAY: CONNECTED TO SECURE DB LOGS</span>
                    </div>

                    <motion.button
                      type="submit"
                      onHoverStart={() => playSynthSound('hover')}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold font-sans text-xs tracking-wider rounded border border-indigo-400/40 shadow-lg hover:shadow-indigo-500/20 transition-all uppercase"
                    >
                      Authorize Session
                    </motion.button>
                  </form>
                </div>
              </div>

              {/* Warning note */}
              <div className="border-t border-indigo-500/10 pt-4 text-[10px] text-slate-500 leading-relaxed font-sans">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>
                    Warning: Unauthorized access attempts are strictly prohibited. Audit logs trace IP routing and digital timestamps back to host nodes under Standard Cyber Audit Law.
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
