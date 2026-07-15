import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useUIStore } from '../state/uiStore';

const BOOT_LINES = [
  'SECURE ENCLAVE READY...',
  'VERIFYING TLS CERTIFICATE...',
  'LOADING IDENTITY MATRIX...',
  'AWAITING INVESTIGATOR AUTH...',
];

export default function LoginPage() {
  const [username, setUsername] = useState('Leon Lobo');
  const [password, setPassword] = useState('');
  const [bootLine, setBootLine] = useState(0);
  const { login } = useAuth();
  const { showToast } = useUIStore();
  const navigate = useNavigate();

  // Cycle boot lines
  useEffect(() => {
    const id = setInterval(() => {
      setBootLine((i) => (i + 1) % BOOT_LINES.length);
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      showToast('INVESTIGATOR ID REQUIRED', 'error');
      return;
    }
    login(username);
    showToast(`ACCESS GRANTED // AGENT ${username.toUpperCase()}`, 'success');
    navigate('/cases');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #000 0%, #0D1117 50%, #131A22 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
    }}
    className="scanlines"
    >
      {/* Cyber grid background */}
      <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Corner HUD brackets */}
      {[['top:16px;left:16px', 'borderTop:1px solid var(--accent-primary);borderLeft:1px solid var(--accent-primary)'],
        ['top:16px;right:16px', 'borderTop:1px solid var(--accent-primary);borderRight:1px solid var(--accent-primary)'],
        ['bottom:16px;left:16px', 'borderBottom:1px solid var(--accent-primary);borderLeft:1px solid var(--accent-primary)'],
        ['bottom:16px;right:16px', 'borderBottom:1px solid var(--accent-primary);borderRight:1px solid var(--accent-primary)'],
      ].map(([pos], i) => {
        const positions = ['top:16px;left:16px','top:16px;right:16px','bottom:16px;left:16px','bottom:16px;right:16px'];
        const borders = [
          { borderTop:'1px solid rgba(0,255,194,0.3)', borderLeft:'1px solid rgba(0,255,194,0.3)' },
          { borderTop:'1px solid rgba(0,255,194,0.3)', borderRight:'1px solid rgba(0,255,194,0.3)' },
          { borderBottom:'1px solid rgba(0,255,194,0.3)', borderLeft:'1px solid rgba(0,255,194,0.3)' },
          { borderBottom:'1px solid rgba(0,255,194,0.3)', borderRight:'1px solid rgba(0,255,194,0.3)' },
        ];
        const posStyles = [
          { top:16, left:16 }, { top:16, right:16 }, { bottom:16, left:16 }, { bottom:16, right:16 },
        ];
        return (
          <div key={i} style={{
            position:'absolute', width:32, height:32, pointerEvents:'none',
            ...posStyles[i], ...borders[i],
          }} />
        );
      })}

      {/* Login card */}
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#08060d',
        border: '1px solid var(--accent-primary)',
        boxShadow: '0 0 30px rgba(0,255,194,0.1)',
        padding: 0,
        position: 'relative',
      }}>
        {/* Top accent bar */}
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
        }} />

        <div style={{ padding: '32px 32px 24px' }}>
          {/* Logo + title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            {/* Shield icon */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 52, height: 52,
              border: '1px solid var(--accent-primary)',
              color: 'var(--accent-primary)',
              marginBottom: 14,
              position: 'relative',
              boxShadow: '0 0 12px rgba(0,255,194,0.2)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h1 style={{
              margin: 0,
              fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700,
              color: 'var(--accent-primary)', letterSpacing: '0.2em', textTransform: 'uppercase',
              textShadow: '0 0 16px rgba(0,255,194,0.4)',
            }}>
              e-RAKSHAK
            </h1>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'var(--text-muted)', letterSpacing: '0.12em',
              marginTop: 6, textTransform: 'uppercase',
            }}>
              OSINT // DIGITAL FORENSICS // LINK ANALYSIS
            </div>
          </div>

          {/* Boot status line */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
            color: 'var(--accent-primary)', marginBottom: 20, textAlign: 'center',
            opacity: 0.6,
          }}
          className="cursor-blink"
          >
            {BOOT_LINES[bootLine]}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Investigator ID */}
            <div>
              <label style={{
                display: 'block', fontFamily: 'var(--font-heading)', fontSize: 9,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--text-muted)', marginBottom: 6,
              }}>
                INVESTIGATOR ID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--struct-line)',
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  padding: '10px 12px',
                  outline: 'none', caretColor: 'var(--accent-primary)',
                  letterSpacing: '0.05em',
                  transition: 'border-color 0.1s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--struct-line)'}
                placeholder="AGENT_NAME"
              />
            </div>

            {/* Passphrase */}
            <div>
              <label style={{
                display: 'block', fontFamily: 'var(--font-heading)', fontSize: 9,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--text-muted)', marginBottom: 6,
              }}>
                SECURITY PASSPHRASE
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--struct-line)',
                  color: 'var(--accent-primary)',
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  padding: '10px 12px',
                  outline: 'none', caretColor: 'var(--accent-primary)',
                  letterSpacing: '0.3em',
                  transition: 'border-color 0.1s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--struct-line)'}
                placeholder="••••••••"
              />
            </div>

            {/* Status row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)', fontSize: 8,
              color: 'var(--text-muted)', letterSpacing: '0.08em',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#00C853', display: 'inline-block',
                  boxShadow: '0 0 4px #00C853',
                }} />
                SECURE AUDIT LOGGING ACTIVE
              </span>
              <span style={{ color: 'var(--struct-line)' }}>LEVEL-5 CLEARANCE</span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              style={{
                padding: '12px',
                background: 'none',
                border: '1px solid var(--accent-primary)',
                color: 'var(--accent-primary)',
                fontFamily: 'var(--font-heading)', fontSize: 11,
                fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 0 8px rgba(0,255,194,0.15)',
                transition: 'background 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,194,0.08)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(0,255,194,0.35)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'none';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 8px rgba(0,255,194,0.15)';
              }}
            >
              AUTHORIZE SESSION
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--struct-line)',
          padding: '12px 32px',
          fontFamily: 'var(--font-mono)', fontSize: 8,
          color: 'var(--text-muted)', letterSpacing: '0.06em',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          STRICTLY AUTHORIZED PERSONNEL ONLY. ALL ACCESS AND INGESTION EVENTS ARE DIGITALLY LOGGED.
        </div>
      </div>
    </div>
  );
}
