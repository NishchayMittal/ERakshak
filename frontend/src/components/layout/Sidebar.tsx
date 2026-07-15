import React from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useUIStore } from '../../state/uiStore';
import { useCaseStore } from '../../state/caseStore';
import { useAuth } from '../../hooks/useAuth';

// Hard-edged SVG icons – no libraries needed
const Icons = {
  cases: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5" width="16" height="11" rx="0" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M6 5V3h8v2" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="2" y1="9" x2="18" y2="9" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  entities: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="4"  cy="15" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="16" cy="15" r="2" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="10" y1="10" x2="4"  y2="13" stroke="currentColor" strokeWidth="0.9"/>
      <line x1="10" y1="10" x2="16" y2="13" stroke="currentColor" strokeWidth="0.9"/>
    </svg>
  ),
  graph: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <polygon points="10,2 18,16 2,16" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <circle cx="10" cy="10" r="2" fill="currentColor"/>
    </svg>
  ),
  breach: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="9" width="14" height="9" rx="0" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M7 9V6a3 3 0 116 0v3" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="10" cy="13.5" r="1.5" fill="currentColor"/>
    </svg>
  ),
  export: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="10" height="13" rx="0" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M13 6h4v11H7v-3" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M10 10v-5l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="bevel"/>
    </svg>
  ),
  collapse: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square"/>
    </svg>
  ),
  expand: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square"/>
    </svg>
  ),
};

const NAV_ITEMS = [
  { key: 'cases',    label: 'CASES',    path: '/cases' },
  { key: 'entities', label: 'ENTITIES', path: null },
  { key: 'graph',    label: 'GRAPH',    path: null },
  { key: 'breach',   label: 'BREACH',   path: null },
  { key: 'export',   label: 'EXPORT',   path: null },
];

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const { cases, activeCase, selectCase } = useCaseStore();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  const activeCaseId = params.caseId || activeCase?.caseId;

  const handleCaseChange = (caseId: string) => {
    selectCase(caseId);
    navigate(`/cases/${caseId}/intake`);
  };

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
            fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700,
            color: 'var(--accent-primary)', letterSpacing: '0.2em',
            textTransform: 'uppercase', textShadow: '0 0 10px rgba(0,255,194,0.4)',
          }}>
            e-RAKSHAK
          </span>
        )}
        {sidebarCollapsed && (
          <span style={{
            fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
            color: 'var(--accent-primary)', letterSpacing: '0.1em',
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
          const to = item.path ?? (activeCaseId ? `/cases/${activeCaseId}/${item.key}` : '/cases');
          return (
            <NavLink
              key={item.key}
              to={to}
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

              {/* Red notification dot – always show for demo */}
              <span style={{
                position: 'absolute', top: 6, right: sidebarCollapsed ? 10 : 8,
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent-threat)',
                boxShadow: '0 0 4px var(--accent-threat)',
              }} />
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
              onClick={() => { logout(); navigate('/login'); }}
              title="Disconnect"
              style={{
                background: 'none', border: '1px solid var(--struct-line)',
                color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M13 3h4v14h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                <path d="M9 14l5-4-5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/>
                <line x1="3" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
          </>
        )}
        {/* Online indicator */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--accent-primary)',
          boxShadow: '0 0 6px var(--accent-primary)',
          display: sidebarCollapsed ? 'block' : 'none',
        }} />
      </div>
    </aside>
  );
}
