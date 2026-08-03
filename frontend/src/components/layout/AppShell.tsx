import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../state/uiStore';
import { useCaseStore } from '../../state/caseStore';

export default function AppShell() {
  const { isAuthenticated } = useAuth();
  const { toast, clearToast } = useUIStore();
  const { loadCases } = useCaseStore();
  const navigate = useNavigate();
  const location = useLocation();

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

  const isDesktopMode = location.pathname.startsWith('/cases');

  return (
    <>
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
            position: 'fixed', bottom: 24, right: 24, zIndex: 100000,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px',
            background: 'rgba(4, 8, 14, 0.95)',
            border: `1px solid ${
              toast.type === 'error'
                ? '#ff3b30'
                : toast.type === 'success'
                ? '#39ff14'
                : '#a855f7'
            }`,
            boxShadow: `0 0 16px ${
              toast.type === 'error'
                ? 'rgba(255,59,48,0.2)'
                : toast.type === 'success'
                ? 'rgba(57,255,20,0.2)'
                : 'rgba(168,85,247,0.2)'
            }`,
            cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-primary)', letterSpacing: '0.08em',
            backdropFilter: 'blur(12px)',
            borderRadius: '4px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background:
              toast.type === 'error'
                ? '#ff3b30'
                : toast.type === 'success'
                ? '#39ff14'
                : '#a855f7',
            boxShadow: `0 0 6px ${
              toast.type === 'error'
                ? '#ff3b30'
                : toast.type === 'success'
                ? '#39ff14'
                : '#a855f7'
            }`,
          }} />
          {toast.message}
          <span style={{ marginLeft: 12, opacity: 0.5, fontSize: 8 }}>✕</span>
        </div>
      )}
    </>
  );
}
