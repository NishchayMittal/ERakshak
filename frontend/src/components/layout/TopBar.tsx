import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, Cpu, Activity, Briefcase, X, Lock, Shield, CheckCircle, Settings } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCaseStore } from '../../state/caseStore';
import { useUIStore } from '../../state/uiStore';
import { updateInvestigatorProfile } from '../../api/endpoints';

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

export default function TopBar() {
  const { user, logout, login } = useAuth();
  const { activeCase } = useCaseStore();
  const { showToast } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Overlay profile modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.name) {
      setNewName(user.name);
    }
  }, [user, showProfileModal]);

  const handleLogout = () => {
    logout();
    setShowProfileModal(false);
    navigate('/');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickTone();
    if (!newName.trim()) {
      showToast('Investigator name cannot be empty', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateInvestigatorProfile(newName, newPassword || undefined);
      login(newName);
      setNewPassword('');
      setShowProfileModal(false);
      showToast('Investigator credentials updated successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update credentials', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Determine current page title
  let pageTitle = 'Case Dashboard';
  if (location.pathname.includes('/intake')) {
    pageTitle = 'Identifier Ingestion & Normalization';
  } else if (location.pathname.includes('/entities/')) {
    pageTitle = 'Link Analysis Workspace';
  } else if (location.pathname.includes('/settings')) {
    pageTitle = 'System & Calibration Control';
  }

  return (
    <>
      <header className="h-16 bg-slate-950/65 backdrop-blur-md border-b border-indigo-500/10 flex items-center justify-between px-6 z-20 relative select-none">
        <div className="absolute inset-0 opacity-15 pointer-events-none cyber-grid-dense"></div>
        
        {/* Title / Case Info */}
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-100 text-xs tracking-widest uppercase font-mono flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-indigo-500/30 flex items-center justify-center bg-indigo-950/40 text-indigo-400 font-bold text-sm float-anim">
              eR
            </div>
            <span className="glow-text-indigo">{pageTitle}</span>
          </h2>
          {activeCase && (location.pathname.includes('/intake') || location.pathname.includes('/entities/')) && (
            <>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 bg-indigo-950/40 text-indigo-400 rounded-full font-mono border border-indigo-500/20">
                  {activeCase.caseId}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-350 tracking-wider">
                  {activeCase.title}
                </span>
              </div>
            </>
          )}
        </div>

        {/* User profile clickable section */}
        <div className="flex items-center gap-4">
          {user && (
            <div 
              onClick={() => {
                playClickTone();
                setShowProfileModal(true);
              }}
              className="hidden sm:flex flex-col text-right cursor-pointer group hover:bg-slate-900/50 p-1 px-2.5 rounded border border-transparent hover:border-slate-800 transition-all"
              title="Click to view credentials calibration"
            >
              <span className="text-xs font-semibold text-slate-300 font-sans flex items-center justify-end gap-1.5 group-hover:text-indigo-300 transition-colors">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                {user.name}
              </span>
              <span className="text-[9px] text-slate-500 font-mono group-hover:text-slate-400 transition-colors">{user.role}</span>
            </div>
          )}

          <div className="w-px h-8 bg-indigo-500/10"></div>

          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-rose-500/25 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 text-xs font-semibold uppercase tracking-wider transition-all"
            title="Disconnect Gateway Session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </motion.button>
        </div>
      </header>

      {/* Floating profile overlay modal */}
      <AnimatePresence>
        {showProfileModal && user && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-lg p-6 max-w-sm w-full space-y-5 cyber-panel corner-decor text-left relative"
            >
              {/* Close Button */}
              <button 
                onClick={() => {
                  playClickTone();
                  setShowProfileModal(false);
                }}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Avatar Header */}
              <div className="flex items-center gap-4 border-b border-slate-800/60 pb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono text-lg font-bold">
                  {newName.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider font-mono">Investigator dossier</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{user.badgeNumber}</p>
                </div>
              </div>

              {/* Credentials calibration Form */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase font-bold text-slate-450 font-mono">Calibrated Display Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Enter full name"
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-850 rounded text-xs font-mono text-slate-250 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] uppercase font-bold text-slate-450 font-mono">Change Security Passphrase</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-850 rounded text-xs font-mono text-slate-250 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Immutable stats */}
                <div className="bg-slate-950/30 border border-slate-900 p-2.5 rounded text-xs font-mono flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-[9px] uppercase">Access clearance:</span>
                    <span className="text-indigo-400 font-semibold uppercase tracking-wider">{user.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 text-[9px] uppercase">Status code:</span>
                    <span className="text-emerald-500 font-semibold uppercase tracking-wider">ACTIVE / VERIFIED</span>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex gap-2.5 pt-2 border-t border-slate-800/60">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold shadow hover:shadow-indigo-500/10 transition-all flex items-center justify-center gap-1.5 border border-indigo-400/40 font-mono uppercase tracking-wider disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
