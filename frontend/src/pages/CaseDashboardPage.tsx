import React, { useEffect } from 'react';
import CaseList from '../components/cases/CaseList';
import { useCaseStore } from '../state/caseStore';
import { useUIStore } from '../state/uiStore';
import { useAuth } from '../hooks/useAuth';

export default function CaseDashboardPage() {
  const { cases, loading, loadCases, selectCase } = useCaseStore();
  const { showToast } = useUIStore();
  const { user } = useAuth();

  useEffect(() => { loadCases(); }, [loadCases]);

  const handleCreateCase = () => {
    const newId = `CASE-${String(cases.length + 1).padStart(4, '0')}`;
    const newCase = {
      caseId: newId,
      title: `Investigation #${cases.length + 1} — AD HOC`,
      investigatorId: user?.id || 'inv-042',
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      tags: ['investigation', 'ad-hoc'],
      entityCount: 0,
    };
    useCaseStore.setState({ cases: [newCase, ...cases] });
    showToast(`${newId} INITIALIZED`, 'success');
  };

  const activeCasesCount = cases.filter((c) => c.status === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: '#080c10',
        border: '1px solid var(--struct-line)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle cyber-grid bg */}
        <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700,
            color: 'var(--text-primary)', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            INVESTIGATIVE CASE FILES
          </h1>
          <p style={{
            margin: '4px 0 0 0',
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: 'var(--text-muted)', letterSpacing: '0.08em',
          }}>
            ACCESS GRANTED // BADGE&nbsp;
            <span style={{ color: 'var(--accent-primary)' }}>{user?.badgeNumber}</span>
          </p>
        </div>
        <button
          onClick={handleCreateCase}
          style={{
            position: 'relative', zIndex: 1,
            padding: '8px 16px',
            background: 'none',
            border: '1px solid var(--accent-primary)',
            color: 'var(--accent-primary)',
            fontFamily: 'var(--font-heading)', fontSize: 9,
            fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 0 6px rgba(0,255,194,0.15)',
            transition: 'background 0.1s, box-shadow 0.1s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,194,0.08)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 12px rgba(0,255,194,0.3)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 6px rgba(0,255,194,0.15)';
          }}
        >
          + INITIALIZE CASE
        </button>
      </div>

      {/* ── Metrics ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'TOTAL DOSSIERS', value: cases.length, color: 'var(--accent-primary)' },
          { label: 'ACTIVE STATUS', value: activeCasesCount, color: '#00C853' },
          { label: 'AUDIT EVENTS', value: 114, color: 'var(--accent-secondary)' },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              padding: '12px 16px',
              background: '#080c10',
              border: '1px solid var(--struct-line)',
              display: 'flex', flexDirection: 'column', gap: 4,
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-heading)', fontSize: 8,
              color: 'var(--text-muted)', letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              {m.label}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700,
              color: m.color, textShadow: `0 0 12px ${m.color}40`,
            }}>
              {m.value}
            </div>
            {/* Accent corner */}
            <div style={{
              position: 'absolute', top: 0, right: 0,
              width: 0, height: 0,
              borderStyle: 'solid',
              borderWidth: '0 28px 28px 0',
              borderColor: `transparent ${m.color}20 transparent transparent`,
            }} />
          </div>
        ))}
      </div>

      {/* ── Case list ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <CaseList cases={cases} loading={loading} onSelectCase={selectCase} />
      </div>
    </div>
  );
}
