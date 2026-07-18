import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import IntroSequence from '../intro/IntroSequence';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../state/uiStore';
import { useCaseStore } from '../../state/caseStore';

// Key to track if intro has been shown this browser session
const INTRO_SHOWN_KEY = 'er_intro_shown';

export default function AppShell() {
  const { isAuthenticated } = useAuth();
  const { toast, clearToast } = useUIStore();
  const { loadCases } = useCaseStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Show intro once per session
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    return !sessionStorage.getItem(INTRO_SHOWN_KEY);
  });

  // Authentication Guard
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Load cases after auth
  useEffect(() => {
    if (isAuthenticated) {
      loadCases();
    }
  }, [isAuthenticated, loadCases]);

  if (!isAuthenticated) return null;

  const handleIntroComplete = () => {
    sessionStorage.setItem(INTRO_SHOWN_KEY, '1');
    setShowIntro(false);
  };

  const isDesktopMode = location.pathname.startsWith('/cases');

  return (
    <>
      {/* Intro Sequence overlay */}
      {showIntro && <IntroSequence onComplete={handleIntroComplete} />}

      {isDesktopMode ? (
        <div className="w-screen h-screen overflow-hidden bg-black relative">
          <Outlet />
        </div>
      ) : (
        /* Main App Layout – grid: sidebar | [topbar / content / statusbar] */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr)',
            gridTemplateRows: 'auto 1fr auto',
            height: '100vh',
            background: 'linear-gradient(160deg, #000 0%, #0D1117 50%, #131A22 100%)',
            overflow: 'hidden',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {/* ── Left Sidebar ── */}
          <div style={{ gridColumn: '1', gridRow: '1 / 4' }}>
            <Sidebar />
          </div>

          {/* ── Top Bar ── */}
          <div style={{ gridColumn: '2', gridRow: '1' }}>
            <TopBar />
          </div>

          <main
            style={{
              gridColumn: '2', gridRow: '2',
              position: 'relative',
              background: 'transparent',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Subtle cyber-grid background */}
            <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px 20px', boxSizing: 'border-box' }}>
              <Outlet />
            </div>
          </main>

          {/* ── Status Bar ── */}
          <div style={{ gridColumn: '2', gridRow: '3' }}>
            <StatusBar />
          </div>
        </div>
      )}

      {/* ── Global Toast ── */}
      {toast && (
        <div
          onClick={clearToast}
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 10000,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 16px',
            background: 'var(--bg-card)',
            border: `1px solid ${toast.type === 'error' ? 'var(--accent-threat)' : toast.type === 'success' ? 'var(--accent-primary)' : 'var(--accent-secondary)'}`,
            boxShadow: `0 0 12px ${toast.type === 'error' ? 'rgba(255,0,68,0.3)' : 'rgba(0,255,194,0.25)'}`,
            cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--text-primary)', letterSpacing: '0.03em',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: toast.type === 'error' ? 'var(--accent-threat)' : toast.type === 'success' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
          }} />
          {toast.message}
          <span style={{ marginLeft: 8, opacity: 0.5 }}>✕</span>
        </div>
      )}
    </>
  );
}
