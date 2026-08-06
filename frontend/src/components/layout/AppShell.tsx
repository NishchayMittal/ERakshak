import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../state/uiStore';
import { useCaseStore } from '../../state/caseStore';
import { useIsMobile } from '../../hooks/useMediaQuery';

export default function AppShell() {
  const { isAuthenticated } = useAuth();
  const { toast, clearToast } = useUIStore();
  const { loadCases } = useCaseStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'auto minmax(0, 1fr)',
            gridTemplateRows: 'auto 1fr auto',
            height: '100vh',
            background: 'linear-gradient(160deg, #000 0%, #0D1117 50%, #131A22 100%)',
            overflow: 'hidden',
            fontFamily: 'var(--font-mono)',
            position: 'relative'
          }}
        >
          {(!isMobile) && (
            <div style={{ gridColumn: '1', gridRow: '1 / 4' }}>
              <Sidebar />
            </div>
          )}
          <div style={{ gridColumn: isMobile ? '1' : '2', gridRow: '1' }}>
            <TopBar isMobile={isMobile} onMenuToggle={() => setMobileSidebarOpen(true)} />
          </div>
          <main
            style={{
              gridColumn: isMobile ? '1' : '2', gridRow: '2',
              position: 'relative',
              background: 'transparent',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '16px 20px', boxSizing: 'border-box' }}>
              <Outlet />
            </div>
          </main>
          {(!isMobile) && (
            <div style={{ gridColumn: '2', gridRow: '3' }}>
              <StatusBar />
            </div>
          )}

          {/* Mobile Sidebar Overlay */}
          {isMobile && mobileSidebarOpen && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000 }} 
                onClick={() => setMobileSidebarOpen(false)}
              />
              <div style={{ position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 1001, transform: 'translateX(0)', transition: 'transform 0.3s ease' }}>
                <Sidebar />
              </div>
            </>
          )}
        </div>
      )}

      {toast && (
        <div
          onClick={clearToast}
          style={{
            position: 'fixed', 
            bottom: isMobile ? 16 : 24, 
            right: isMobile ? 8 : 24, 
            left: isMobile ? 8 : 'auto',
            zIndex: 100000,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px',
            background: 'rgba(4, 8, 14, 0.95)',
            border: `1px solid ${
              toast.type === 'error' ? '#ff3b30' : toast.type === 'success' ? '#39ff14' : '#a855f7'
            }`,
            boxShadow: `0 0 16px ${
              toast.type === 'error' ? 'rgba(255,59,48,0.2)' : toast.type === 'success' ? 'rgba(57,255,20,0.2)' : 'rgba(168,85,247,0.2)'
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
            background: toast.type === 'error' ? '#ff3b30' : toast.type === 'success' ? '#39ff14' : '#a855f7',
            boxShadow: `0 0 6px ${ toast.type === 'error' ? '#ff3b30' : toast.type === 'success' ? '#39ff14' : '#a855f7'}`,
            flexShrink: 0
          }} />
          <span style={{ flex: 1 }}>{toast.message}</span>
          <span style={{ marginLeft: 12, opacity: 0.5, fontSize: 8 }}>✕</span>
        </div>
      )}
    </>
  );
}
