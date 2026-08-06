import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useUIStore } from '../../state/uiStore';
import { useCaseStore } from '../../state/caseStore';
import { useAuth } from '../../hooks/useAuth';
import { useGraphStore } from '../../state/graphStore';
import { getPendingApprovals } from '../../api/endpoints';

// Hard-edged SVG icons – no libraries needed
const Icons = {
  cases: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5" width="16" height="11" rx="0" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 5V3h8v2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="2" y1="9" x2="18" y2="9" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  intake: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="15" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16" cy="15" r="2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="10" y1="10" x2="4" y2="13" stroke="currentColor" strokeWidth="0.9" />
      <line x1="10" y1="10" x2="16" y2="13" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  ),
  investigate: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="15" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16" cy="15" r="2" stroke="currentColor" strokeWidth="1.2" />
      <line x1="10" y1="10" x2="4" y2="13" stroke="currentColor" strokeWidth="0.9" />
      <line x1="10" y1="10" x2="16" y2="13" stroke="currentColor" strokeWidth="0.9" />
    </svg>
  ),

  profile: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 17a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 2v2.5M10 15.5v2.5M2 10h2.5M15.5 10h2.5M4.3 4.3l1.8 1.8M13.9 13.9l1.8 1.8M15.7 4.3L13.9 6.1M6.1 13.9l-1.8 1.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  collapse: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </svg>
  ),
  expand: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { key: 'cases', label: 'CASES', path: '/cases' },
  { key: 'intake', label: 'INTAKE', path: null },
  { key: 'investigate', label: 'INVESTIGATE', path: null },
  { key: 'profile', label: 'PROFILE', path: '/profile' },
  { key: 'settings', label: 'SETTINGS', path: '/settings' },
];

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, showToast } = useUIStore();
  const { cases, activeCase, selectCase } = useCaseStore();
  const { user, logout } = useAuth();
  const { selectedEntityId } = useGraphStore();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const activeCaseId = params.caseId || activeCase?.caseId;

  const handleCaseChange = (caseId: string) => {
    selectCase(caseId);
    if (params.caseId) {
      const newPath = location.pathname.replace(params.caseId, caseId);
      navigate(newPath);
    } else {
      // Fallback if not on a case-specific page
      navigate(`/cases/${caseId}/intake`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const refreshPendingApprovals = async () => {
      if (user?.badgeNumber !== 'INV-001') {
        setPendingApprovalsCount(0);
        return;
      }

      try {
        const approvals = await getPendingApprovals();
        if (!cancelled) {
          setPendingApprovalsCount(approvals.length);
        }
      } catch (err) {
        if (!cancelled) {
          setPendingApprovalsCount(0);
        }
      }
    };

    refreshPendingApprovals();
    const interval = window.setInterval(refreshPendingApprovals, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user?.badgeNumber]);

  return (
    <aside
      style={{
        width: sidebarCollapsed ? 60 : 220,
        height: '100vh',
        background: '#080c10',
        borderRight: '1px solid var(--struct-line)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transition: 'width 0.15s linear',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* ── Logo / Brand ── */}
      <div
        style={{
          height: 56, width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          padding: sidebarCollapsed ? 0 : '0 12px',
          borderBottom: '1px solid var(--struct-line)',
          flexShrink: 0,
        }}
      >
        {!sidebarCollapsed && (
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
            color: 'var(--accent-action)', letterSpacing: '0.2em',
            textTransform: 'uppercase', textShadow: '0 0 10px rgba(57,255,20,0.5)',
          }}>
            e-RAKSHAK
          </span>
        )}
        {sidebarCollapsed && (
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
            color: 'var(--accent-action)', letterSpacing: '0.1em',
          }}>
            eR
          </span>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          style={{
            background: 'none', border: '1px solid var(--struct-line)',
            color: 'var(--text-muted)', cursor: 'pointer',
            padding: '4px 5px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {sidebarCollapsed ? Icons.expand : Icons.collapse}
        </button>
      </div>

      {/* ── Nav Items ── */}
      <nav style={{ width: '100%', padding: '8px 0', flex: 1, overflow: 'hidden' }}>
        {NAV_ITEMS.map((item) => {
          const entityId = selectedEntityId || 'n1';
          const to = item.key === 'intake'
            ? (activeCaseId ? `/cases/${activeCaseId}/intake` : '/cases')
            : (item.path ?? (activeCaseId ? `/cases/${activeCaseId}/entities/${entityId}` : '/cases'));
          return (
            <NavLink
              key={item.key}
              to={to}
              end={item.key === 'cases'}
              onClick={(e) => {
                if (!item.path && !activeCaseId) {
                  e.preventDefault();
                  showToast('Please select or initialize a case first', 'error');
                  return;
                }

                // Select corresponding tab on the investigation workspace
                if (item.key === 'export') {
                  useUIStore.setState({ activeTab: 'report' });
                } else if (item.key === 'entities' || item.key === 'graph') {
                  useUIStore.setState({ activeTab: 'graph' });
                } else if (item.key === 'breach') {
                  useUIStore.setState({ activeTab: 'timeline' });
                }
              }}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: sidebarCollapsed ? '10px 0' : '10px 14px',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                textDecoration: 'none',
                fontFamily: 'var(--font-heading)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: isActive ? 'var(--bg-0)' : 'var(--text-muted)',
                background: isActive ? 'var(--accent-primary)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                position: 'relative',
                transition: 'background 0.1s linear, color 0.1s linear',
              })}
            >
              {/* Bracket frame icon container */}
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                className="bracket-frame"
              >
                {Icons[item.key as keyof typeof Icons] as React.ReactNode}
              </span>
              {!sidebarCollapsed && <span>{item.label}</span>}

              {pendingApprovalsCount > 0 && (
                <span
                  title={`${pendingApprovalsCount} pending approval${pendingApprovalsCount === 1 ? '' : 's'}`}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: sidebarCollapsed ? 10 : 8,
                    minWidth: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--accent-threat)',
                    boxShadow: '0 0 4px var(--accent-threat)',
                  }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Case switcher (expanded only) ── */}
      {!sidebarCollapsed && cases.length > 0 && (
        <div style={{
          width: '100%', padding: '10px 12px',
          borderTop: '1px solid var(--struct-line)',
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 6, fontFamily: 'var(--font-heading)' }}>
            ACTIVE CASE
          </div>
          <select
            value={activeCaseId || ''}
            onChange={(e) => handleCaseChange(e.target.value)}
            style={{
              width: '100%', background: 'var(--bg-1)',
              border: '1px solid var(--struct-line)',
              color: 'var(--text-primary)', padding: '5px 8px',
              fontSize: 10, fontFamily: 'var(--font-mono)',
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="" disabled>SELECT CASE...</option>
            {cases.map((c) => (
              <option key={c.caseId} value={c.caseId}>
                {c.title.length > 22 ? `${c.title.substring(0, 22)}…` : c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Investigator badge ── */}
      <div style={{
        width: '100%', borderTop: '1px solid var(--struct-line)',
        padding: sidebarCollapsed ? '10px 0' : '10px 12px',
        display: 'flex', alignItems: 'center', justifyContent: sidebarCollapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!sidebarCollapsed && user && (
          <>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', fontWeight: 600 }}>
                {user.name}
              </div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 2 }}>
                {user.badgeNumber}
              </div>
            </div>
             <button
              onClick={() => setShowLogoutConfirm(true)}
              title="Disconnect"
              style={{
                background: 'none', border: '1px solid var(--struct-line)',
                color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M13 3h4v14h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                <path d="M9 14l5-4-5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                <line x1="3" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </>
        )}
        {/* Online indicator — green = live system */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--accent-action)',
          boxShadow: '0 0 6px var(--accent-action)',
          display: sidebarCollapsed ? 'block' : 'none',
        }} />
      </div>

      {/* Disconnect Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--accent-primary)',
            padding: 24, width: 300, display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 0 24px rgba(168,85,247,0.2)',
          }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', letterSpacing: '0.15em' }}>
              CONFIRM DISCONNECT
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              ARE YOU SURE YOU WANT TO TERMINATE THE ACTIVE INVESTIGATOR SESSION?
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--struct-line)', paddingTop: 12 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  background: 'none', border: '1px solid var(--struct-line)',
                  color: 'var(--text-muted)', fontFamily: 'var(--font-heading)',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  padding: '6px 12px', cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                  navigate('/');
                }}
                style={{
                  background: 'var(--accent-primary)', border: 'none',
                  color: '#000000', fontFamily: 'var(--font-heading)',
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  padding: '6px 12px', cursor: 'pointer',
                }}
              >
                DISCONNECT
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
