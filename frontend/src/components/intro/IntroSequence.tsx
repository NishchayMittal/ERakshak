import React, { useEffect, useRef, useState } from 'react';

// Fake system log lines that flash during boot
const LOG_LINES = [
  'INIT_CORE :: SECURE_ENCLAVE_BOOT [OK]',
  'DECRYPTING NODES ... [7 of 7]',
  'LOADING IDENTITY GRAPH ENGINE ...',
  'CROSS-REFERENCING DATABASES [INTERPOL/NSD]',
  'BUILDING LINK GRAPH :: 4,471 NODES',
  'THREAT INTELLIGENCE FEED :: CONNECTED',
  'OSINT CONNECTOR POOL :: 12/12 ACTIVE',
  'FACE RECOGNITION MODULE :: STANDBY',
  'AES-256 SESSION KEY ESTABLISHED',
  'VERIFYING INVESTIGATOR CREDENTIALS ...',
  'BADGE AUTH: LEVEL-5 CLEARANCE [GRANTED]',
  'NETWORK MAP OVERLAY :: INITIALIZING',
  'BREACH RECORD INDEX :: 1.2M ENTRIES LOADED',
  'PIVOT LOOP ENGINE :: ARMED',
  'CANONICAL HASH CHECK :: PASS',
  'RISK SCORING ENGINE :: v3.1.4 LOADED',
  'CORRELATION ENGINE :: FELLEGI-SUNTER READY',
  'XGBOOST MODEL :: WEIGHTS LOADED',
  'SHAP EXPLAINABILITY MODULE :: ACTIVE',
  'PERIMETER SECURED :: NO ANOMALIES DETECTED',
];

// Pulse points on the "globe" (SVG coords within 480×240 viewBox)
const PULSE_POINTS = [
  { x: 80,  y: 90  },
  { x: 200, y: 60  },
  { x: 310, y: 80  },
  { x: 390, y: 110 },
  { x: 130, y: 160 },
  { x: 260, y: 145 },
  { x: 440, y: 75  },
  { x: 55,  y: 140 },
];

// Connections between pulse points (pairs of indices)
const CONNECTIONS = [
  [0, 2], [1, 3], [2, 6], [3, 5], [4, 1], [5, 7], [6, 3], [7, 4], [0, 5],
];

interface IntroSequenceProps {
  onComplete: () => void;
}

type Phase =
  | 'cursor'       // phase 0 – blinking cursor + boot text
  | 'logs'         // phase 1 – scrolling log lines
  | 'reticle'      // phase 2 – targeting reticle + map
  | 'aperture'     // phase 3 – aperture snap + flash
  | 'wordmark'     // phase 4 – e-RAKSHAK glitch-in
  | 'stamp'        // phase 5 – clearance stamp
  | 'done';        // phase 6 – transition out

export default function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [phase, setPhase] = useState<Phase>('cursor');
  const [logIndex, setLogIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = (fn: () => void, ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(fn, ms);
  };

  useEffect(() => {
    // Phase timings
    schedule(() => setPhase('logs'), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (phase === 'logs') {
      // Rapid log ticker
      let i = 0;
      const ticker = setInterval(() => {
        i++;
        setLogIndex(i);
        if (i >= LOG_LINES.length) {
          clearInterval(ticker);
          schedule(() => setPhase('reticle'), 300);
        }
      }, 80);
      return () => clearInterval(ticker);
    }
    if (phase === 'reticle') {
      schedule(() => setPhase('aperture'), 2000);
    }
    if (phase === 'aperture') {
      schedule(() => setPhase('wordmark'), 900);
    }
    if (phase === 'wordmark') {
      schedule(() => setPhase('stamp'), 900);
    }
    if (phase === 'stamp') {
      schedule(() => setPhase('done'), 1400);
    }
    if (phase === 'done') {
      schedule(() => onComplete(), 400);
    }
  }, [phase, onComplete]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(160deg, #000 0%, #0D1117 60%, #131A22 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        opacity: phase === 'done' ? 0 : 1,
        transition: phase === 'done' ? 'opacity 0.35s linear' : 'none',
      }}
      className="scanlines"
    >
      {/* ── Cyber grid bg ── */}
      <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* ════════════════════════════════════════
          PHASE 0 – Cursor blink + boot text
          ════════════════════════════════════════ */}
      {(phase === 'cursor' || phase === 'logs') && (
        <div style={{ position: 'absolute', top: '30%', left: '10%', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontSize: 13, letterSpacing: '0.08em' }}>
          {phase === 'cursor' && (
            <span className="cursor-blink">INITIATING SECURE ACCESS...</span>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          PHASE 1 – Log scroll
          ════════════════════════════════════════ */}
      {phase === 'logs' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          padding: '24px 32px', overflow: 'hidden',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--accent-primary)', letterSpacing: '0.04em',
        }}>
          {LOG_LINES.slice(Math.max(0, logIndex - 14), logIndex).map((line, i) => (
            <div key={i} style={{ opacity: 0.7 + (i / 14) * 0.3, marginBottom: 3 }}>
              <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>
                {String(1784800000000 + logIndex * 1000).slice(-6)}
              </span>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════
          PHASE 2 – Targeting reticle + map
          ════════════════════════════════════════ */}
      {(phase === 'reticle' || phase === 'aperture') && (
        <div style={{ position: 'relative', width: 520, height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Outer rotating ring */}
          <div style={{
            position: 'absolute', width: 500, height: 500, borderRadius: '50%',
            border: '1px solid rgba(0,255,194,0.3)',
            animation: 'intro-reticle-spin 8s linear infinite',
          }} />
          {/* Middle counter-rotating ring */}
          <div style={{
            position: 'absolute', width: 420, height: 420, borderRadius: '50%',
            border: '1px dashed rgba(0,255,194,0.2)',
            animation: 'intro-reticle-spin-rev 5s linear infinite',
          }} />
          {/* Inner solid ring */}
          <div style={{
            position: 'absolute', width: 340, height: 340, borderRadius: '50%',
            border: '1.5px solid rgba(0,255,194,0.6)',
          }} />
          {/* Cross-hairs */}
          {[0, 90, 180, 270].map((deg) => (
            <div key={deg} style={{
              position: 'absolute', width: 500, height: 1,
              background: 'rgba(0,255,194,0.15)',
              transform: `rotate(${deg}deg)`,
            }} />
          ))}
          {/* Tick marks */}
          {Array.from({ length: 36 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', width: i % 9 === 0 ? 16 : 8, height: 1,
              background: 'rgba(0,255,194,0.5)',
              transformOrigin: '250px 0',
              transform: `translateX(-250px) rotate(${i * 10}deg)`,
              left: '50%', top: '50%',
            }} />
          ))}
          {/* Aperture close overlay */}
          {phase === 'aperture' && (
            <div style={{
              position: 'absolute', inset: -200,
              background: '#000',
              animation: 'intro-aperture-close 0.85s cubic-bezier(0.7,0,1,1) forwards',
            }} />
          )}
          {/* Inner map area */}
          <div style={{
            position: 'absolute', width: 320, height: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {/* Simplified world-map wireframe SVG */}
            <svg width="480" height="240" viewBox="0 0 480 240" style={{ opacity: 0.55 }}>
              {/* Rough continent outlines */}
              <path d="M40,80 Q60,60 90,70 Q110,55 130,75 Q120,100 100,110 Q70,120 50,100 Z" fill="none" stroke="rgba(0,255,194,0.4)" strokeWidth="0.8" />
              <path d="M160,50 Q200,35 240,55 Q260,70 255,95 Q235,115 200,110 Q170,100 160,80 Z" fill="none" stroke="rgba(0,255,194,0.4)" strokeWidth="0.8" />
              <path d="M280,60 Q330,40 370,65 Q400,80 395,110 Q370,130 330,120 Q290,105 280,80 Z" fill="none" stroke="rgba(0,255,194,0.4)" strokeWidth="0.8" />
              <path d="M390,60 Q440,45 470,70 Q475,95 455,110 Q430,115 405,95 Z" fill="none" stroke="rgba(0,255,194,0.4)" strokeWidth="0.8" />
              <path d="M85,130 Q115,120 130,140 Q125,170 105,175 Q80,170 80,150 Z" fill="none" stroke="rgba(0,255,194,0.3)" strokeWidth="0.8" />
              <path d="M190,130 Q230,120 255,145 Q250,180 215,185 Q185,175 185,155 Z" fill="none" stroke="rgba(0,255,194,0.3)" strokeWidth="0.8" />
              {/* Graticule lines */}
              {[40,80,120,160,200].map(y => (
                <line key={y} x1="0" y1={y} x2="480" y2={y} stroke="rgba(0,255,194,0.07)" strokeWidth="0.5" />
              ))}
              {[60,120,180,240,300,360,420].map(x => (
                <line key={x} x1={x} y1="0" x2={x} y2="240" stroke="rgba(0,255,194,0.07)" strokeWidth="0.5" />
              ))}
              {/* Connections between pulse points */}
              {CONNECTIONS.map(([a, b], i) => (
                <line key={i}
                  x1={PULSE_POINTS[a].x} y1={PULSE_POINTS[a].y}
                  x2={PULSE_POINTS[b].x} y2={PULSE_POINTS[b].y}
                  stroke="rgba(0,255,194,0.25)" strokeWidth="0.7"
                  strokeDasharray="3 3"
                />
              ))}
              {/* Pulse points */}
              {PULSE_POINTS.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="3" fill="var(--accent-threat)" />
                  <circle cx={pt.x} cy={pt.y} r="3" fill="transparent"
                    stroke="var(--accent-threat)" strokeWidth="1.5"
                    style={{ animation: `map-pulse ${1.4 + i * 0.2}s ease-out infinite` }}
                  />
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          PHASE 3/4 – Wordmark glitch-in
          ════════════════════════════════════════ */}
      {(phase === 'wordmark' || phase === 'stamp') && (
        <div style={{ textAlign: 'center', position: 'relative' }}>
          {/* Flash overlay */}
          {phase === 'wordmark' && (
            <div style={{
              position: 'absolute', inset: '-100px -200px',
              animation: 'intro-flash-white 0.25s linear forwards',
              pointerEvents: 'none', zIndex: 10,
            }} />
          )}
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 64, fontWeight: 700,
            color: 'var(--accent-primary)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin: 0,
            animation: 'intro-wordmark-glitch 0.85s ease-out forwards',
            textShadow: '0 0 30px rgba(0,255,194,0.5)',
          }}>
            e-RAKSHAK
          </h1>

          {/* Stamp line – appears in stamp phase */}
          {phase === 'stamp' && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12,
              animation: 'intro-stamp-in 0.35s ease-out forwards',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                letterSpacing: '0.25em', textTransform: 'uppercase',
                color: 'var(--accent-primary)', opacity: 0.85,
              }}>
                CLEARANCE GRANTED // LINK ANALYSIS ACTIVE
              </span>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--accent-threat)', letterSpacing: '0.1em',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-threat)', display: 'inline-block', animation: 'intro-live-pulse 0.8s step-start infinite' }} />
                LIVE
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
