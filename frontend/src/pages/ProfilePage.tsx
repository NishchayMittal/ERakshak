import React, { useState } from 'react';
import { User, Shield, Terminal, Lock, Edit2, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUIStore } from '../state/uiStore';
import { useTransliterate } from '../components/ui/Transliterate';
import { useTranslation } from 'react-i18next';
import { updateInvestigatorProfile } from '../api/endpoints';
import { useIsMobile } from '../hooks/useMediaQuery';

// Audio click synth
const playClickTone = () => {};

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { showToast } = useUIStore();
  const transliterate = useTransliterate();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [updating, setUpdating] = useState(false);

  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  if (!user) {
    return (
      <div style={{ color: 'var(--text-muted)', padding: 24, fontFamily: 'var(--font-mono)' }}>
        {t('profile_page.no_session')}
      </div>
    );
  }

  const handleUpdateName = async () => {
    playClickTone();
    if (!editedName.trim()) return;
    setUpdating(true);
    try {
      const updated = (await updateInvestigatorProfile(editedName.trim())) as { full_name?: string };
      setUser({
        ...user,
        name: updated.full_name || editedName.trim(),
      });
      setIsEditing(false);
      showToast(t('profile_page.identity_updated'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('profile_page.identity_failed'), 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    playClickTone();
    if (!newPassword.trim()) return;
    setUpdatingPassword(true);
    try {
      await updateInvestigatorProfile(undefined, newPassword.trim());
      setIsEditingPassword(false);
      setNewPassword('');
      showToast(t('profile_page.passphrase_updated'), 'success');
    } catch (err) {
      console.error(err);
      showToast(t('profile_page.passphrase_failed'), 'error');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflowY: 'auto', userSelect: 'none' }}>
      
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
            fontFamily: 'var(--font-display)', fontSize: "calc(14px * var(--font-scale))", fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '0.12em', textTransform: 'uppercase',
          }}>
            {t('profile_page.header_title')}
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontFamily: 'var(--font-mono)', fontSize: "calc(9px * var(--font-scale))",
            color: 'var(--text-muted)', letterSpacing: '0.08em',
          }}>
            {t('profile_page.header_subtitle')}
          </p>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'min(320px, 100%) 1fr',
        gap: 16,
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
      }}>
        
        {/* Left Card: Hologram Avatar & Quick Status */}
        <div className="hud-panel" style={{
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
            background: 'linear-gradient(180deg, rgba(0,255,148,0.04) 0%, transparent 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Radar scan-like background line */}
            <div className="hologram-scanline" style={{
              position: 'absolute', width: '100%', height: '2px',
              background: 'var(--accent-action)',
              opacity: 0.3,
              boxShadow: '0 0 8px var(--accent-action)',
              animation: 'hologramScan 3.5s infinite linear',
            }} />
            <User size={80} style={{ color: 'var(--accent-primary)', opacity: 0.85, filter: 'drop-shadow(0 0 12px rgba(168,85,247,0.4))' }} />
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: "calc(13px * var(--font-scale))", color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '0.05em' }}>
              {transliterate(user.name).toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(9px * var(--font-scale))", color: 'var(--accent-primary)', letterSpacing: '0.1em' }}>
              {transliterate(user.role).toUpperCase()}
            </div>
          </div>

          <div style={{ width: '100%', borderTop: '1px solid var(--struct-line)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: "calc(8px * var(--font-scale))", color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{t('profile_page.system_state')}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: "calc(9px * var(--font-scale))", color: 'var(--accent-action)',
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-action)', boxShadow: '0 0 6px var(--accent-action)' }} />
                {t('profile_page.active_secure')}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: "calc(8px * var(--font-scale))", color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{t('profile_page.badge_id')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(9px * var(--font-scale))", color: 'var(--text-primary)' }}>{user.badgeNumber}</span>
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
          <div className="hud-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--struct-line)', paddingBottom: 10 }}>
              <Shield size={16} style={{ color: 'var(--accent-label)' }} />
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: "calc(11px * var(--font-scale))", fontWeight: 700, color: 'var(--accent-label)', letterSpacing: '0.1em' }}>
                {t('profile_page.security_section')}
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'min(150px, 40%) 1fr', gap: '14px 20px', alignItems: 'center' }}>
              <label style={{ fontFamily: 'var(--font-heading)', fontSize: "calc(9px * var(--font-scale))", color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {t('profile_page.investigator_name')}
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
                      fontSize: "calc(11px * var(--font-scale))",
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(11px * var(--font-scale))", color: 'var(--text-primary)', fontWeight: 600 }}>
                    {transliterate(user.name)}
                  </span>
                  <button
                    onClick={() => {
                      playClickTone();
                      setIsEditing(true);
                    }}
                    style={{
                      background: 'none', border: '1px solid var(--struct-line)', color: 'var(--text-muted)',
                      padding: '4px 8px', fontSize: "calc(8px * var(--font-scale))", fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <Edit2 size={10} />
                    {t('profile_page.edit_name')}
                  </button>
                </div>
              )}

              <label style={{ fontFamily: 'var(--font-heading)', fontSize: "calc(9px * var(--font-scale))", color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {t('profile_page.assigned_post')}
              </label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(11px * var(--font-scale))", color: 'var(--text-primary)' }}>
                {transliterate(user.role)}
              </span>

              <label style={{ fontFamily: 'var(--font-heading)', fontSize: "calc(9px * var(--font-scale))", color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {t('profile_page.security_clearance')}
              </label>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: "calc(10px * var(--font-scale))", color: 'var(--accent-secondary)',
                fontWeight: 700, letterSpacing: '0.05em'
              }}>
                {t('profile_page.clearance_val')}
              </span>

              <label style={{ fontFamily: 'var(--font-heading)', fontSize: "calc(9px * var(--font-scale))", color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                {t('profile_page.passphrase')}
              </label>
              {isEditingPassword ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={updatingPassword}
                    placeholder="New passphrase"
                    style={{
                      background: 'var(--bg-1)',
                      border: '1px solid var(--accent-primary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: "calc(11px * var(--font-scale))",
                      padding: '4px 8px',
                      outline: 'none',
                      flex: 1,
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleUpdatePassword}
                    disabled={updatingPassword}
                    style={{
                      background: 'var(--accent-primary)', border: 'none', color: '#000000',
                      padding: 6, cursor: 'pointer', display: 'flex', alignItems: 'center'
                    }}
                    title="Save Passphrase"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingPassword(false);
                      setNewPassword('');
                    }}
                    disabled={updatingPassword}
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
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(11px * var(--font-scale))", color: 'var(--text-muted)' }}>
                    ••••••••••••••
                  </span>
                  <button
                    onClick={() => {
                      playClickTone();
                      setIsEditingPassword(true);
                    }}
                    style={{
                      background: 'none', border: '1px solid var(--struct-line)', color: 'var(--text-muted)',
                      padding: '4px 8px', fontSize: "calc(8px * var(--font-scale))", fontFamily: 'var(--font-heading)',
                      letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                    }}
                  >
                    <Lock size={10} />
                    {t('profile_page.change_password')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* System Environment & Logs Status */}
          <div className="hud-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--struct-line)', paddingBottom: 10 }}>
              <Terminal size={16} style={{ color: 'var(--accent-action)' }} />
              <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: "calc(11px * var(--font-scale))", fontWeight: 700, color: 'var(--accent-label)', letterSpacing: '0.1em' }}>
                {t('profile_page.operational_context')}
              </h2>
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(10px * var(--font-scale))", color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              <div>&gt; HOST SYSTEM: WINDOWS SECURE SHELL</div>
              <div>&gt; ENCRYPTION ALGORITHM: HS256 JWT SCHEME</div>
              <div>&gt; ACTIVE LOCAL VOLUME: erakshak.db [CONNECTED]</div>
              <div>&gt; PORTAL RENDER ENGINE: THREE.JS GRAPHICS ACCELERATED</div>
              <div>&gt; ACCESS TOKEN STATE: SECURE // TIMEOUT GATED</div>
              <div style={{ color: 'var(--accent-action)', marginTop: 8 }}>&gt; STATUS 200: INVESTIGATION HANDLER LAUNCHED ON SHIELD PORT 5173.</div>
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
