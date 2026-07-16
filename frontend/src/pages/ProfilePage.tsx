import React, { useState } from 'react';
import { User, Shield, Award, Terminal, Lock, Edit2, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUIStore } from '../state/uiStore';
import { updateInvestigatorProfile } from '../api/endpoints';

// Audio click synth
const playClickTone = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
};

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { showToast } = useUIStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [updating, setUpdating] = useState(false);

  if (!user) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: 24, fontFamily: 'var(--font-mono)' }}>
        NO ACTIVE SESSION FOUND. PLEASE RETRANSMIT AUTHENTICATION.
      </div>
    );
  }

  const handleUpdateName = async () => {
    playClickTone();
    if (!editedName.trim()) return;
    setUpdating(true);
    try {
      const updated = await updateInvestigatorProfile(editedName.trim());
      setUser({
        ...user,
        name: updated.full_name || editedName.trim(),
      });
      setIsEditing(false);
      showToast('INVESTIGATOR IDENTITY UPDATED', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update profile name', 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none' }}>
      
      {/* Header Panel */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: '#080c10',
        border: '1px solid var(--struct-line)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            INVESTIGATOR PROFILE
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-muted)', letterSpacing: '0.08em',
          }}>
            OPERATIONAL HUD // CREDENTIAL VERIFICATION
          </p>
        </div>
      </div>

      {/* Main Grid Content */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: 16,
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
      }}>
        
        {/* Left Card: Hologram Avatar & Quick Status */}
        <div style={{
          background: '#080c10',
          border: '1px solid var(--struct-line)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          position: 'relative',
        }}>
          {/* Top subtle visual grid decor */}
          <div style={{
            width: '100%', height: 180,
            border: '1px dashed var(--struct-line)',
            background: 'linear-gradient(180deg, rgba(0,255,194,0.02) 0%, transparent 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Radar scan-like background line */}
            <div className="hologram-scanline" style={{
              position: 'absolute', width: '100%', height: '2px',
              background: 'var(--accent-primary)',
              opacity: 0.3,
              boxShadow: '0 0 8px var(--accent-primary)',
              animation: 'hologramScan 3.5s infinite linear',
            }} />
            <User size={80} style={{ color: 'var(--accent-primary)', opacity: 0.85, filter: 'drop-shadow(0 0 12px rgba(0,255,194,0.3))' }} />
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '0.05em' }}>
              {user.name.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>
              {user.role.toUpperCase()}
            </div>
          </div>

          <div style={{ width: '100%', borderTop: '1px solid var(--struct-line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SYSTEM STATE:</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-primary)',
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-primary)', boxShadow: '0 0 6px var(--accent-primary)' }} />
                ACTIVE / SECURE
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>BADGE ID:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-primary)' }}>{user.badgeNumber}</span>
            </div>
          </div>
        </div>

        {/* Right Card: Full Profile Details & Actionable Panels */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          
          {/* Identity & Clearance Settings */}
          <div style={{
            background: '#080c10',
            border: '1px solid var(--struct-line)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--struct-line)', paddingBottom: 10 }}>
              <Shield size={16} style={{ color: 'var(--accent-primary)' }} />
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.1em' }}>
                SECURITY & CREDENTIALS INFO
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '14px 20px', alignItems: 'center' }}>
              <label style={{ fontFamily: 'var(--font-heading)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                INVESTIGATOR NAME:
              </label>
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    disabled={updating}
                    style={{
                      background: 'var(--bg-1)',
                      border: '1px solid var(--accent-primary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      padding: '4px 8px',
                      outline: 'none',
                      flex: 1,
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateName}
                    disabled={updating}
                    style={{
                      background: 'var(--accent-primary)', border: 'none', color: '#000000',
                      padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center'
                    }}
                    title="Save Change"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedName(user.name);
                    }}
                    disabled={updating}
                    style={{
                      background: 'none', border: '1px solid var(--struct-line)', color: 'var(--text-muted)',
                      padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center'
                    }}
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {user.name}
                  </span>
                  <button
                    onClick={() => {
                      playClickTone();
                      setIsEditing(true);
                    }}
                    style={{
                      background: 'none', border: '1px solid var(--struct-line)', color: 'var(--text-muted)',
                      padding: '4px 8px', fontSize: 8, fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <Edit2 size={10} />
                    EDIT NAME
                  </button>
                </div>
              )}

              <label style={{ fontFamily: 'var(--font-heading)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                ASSIGNED POST:
              </label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)' }}>
                {user.role}
              </span>

              <label style={{ fontFamily: 'var(--font-heading)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                SECURITY CLEARANCE:
              </label>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-secondary)',
                fontWeight: 700, letterSpacing: '0.05em'
              }}>
                CLASS-3 SECRET INTELLIGENCE
              </span>
            </div>
          </div>

          {/* System Environment & Logs Status */}
          <div style={{
            background: '#080c10',
            border: '1px solid var(--struct-line)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--struct-line)', paddingBottom: 10 }}>
              <Terminal size={16} style={{ color: 'var(--accent-secondary)' }} />
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.1em' }}>
                OPERATIONAL CONTEXT
              </h2>
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              <div>&gt; HOST SYSTEM: WINDOWS SECURE SHELL</div>
              <div>&gt; ENCRYPTION ALGORITHM: HS256 JWT SCHEME</div>
              <div>&gt; ACTIVE LOCAL VOLUME: erakshak.db [CONNECTED]</div>
              <div>&gt; PORTAL RENDER ENGINE: THREE.JS GRAPHICS ACCELERATED</div>
              <div>&gt; ACCESS TOKEN STATE: SECURE // TIMEOUT GATED</div>
              <div style={{ color: 'var(--accent-primary)', marginTop: 8 }}>&gt; STATUS 200: INVESTIGATION HANDLER LAUNCHED ON SHIELD PORT 5173.</div>
            </div>
          </div>

        </div>

      </div>

      <style>{`
        @keyframes hologramScan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>

    </div>
  );
}
