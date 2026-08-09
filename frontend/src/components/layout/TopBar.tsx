import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useParams } from 'react-router';
import { useCaseStore } from '../../state/caseStore';
import AlertBell from '../alerts/AlertBell';
import { useTransliterate } from '../ui/Transliterate';
import { useTranslation } from 'react-i18next';

interface TopBarProps {
  onMenuToggle?: () => void;
  isMobile?: boolean;
}

export default function TopBar({ onMenuToggle, isMobile }: TopBarProps) {
  const [time, setTime] = useState('');
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeCase } = useCaseStore();
  const location = useLocation();
  const params = useParams<{ caseId: string }>();
  const transliterate = useTransliterate();
  const { t } = useTranslation();

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setTime(`${hh}:${mm}:${ss}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  let pageContext = t('topbar.dashboard');
  if (location.pathname.includes('/intake')) pageContext = t('topbar.ingestion');
  else if (location.pathname.includes('/entities')) pageContext = t('topbar.workspace');

  const caseId = params.caseId || activeCase?.caseId;
  const caseLabel = caseId ? `CASE // ${caseId.toUpperCase().slice(0, 8)}` : null;

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim()) {
      setSearch('');
    }
  };

  return (
    <header style={{ height: 56, background: '#080c10', borderBottom: '1px solid var(--struct-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', gap: 16, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isMobile && (
          <button 
            onClick={onMenuToggle}
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ☰
          </button>
        )}
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', borderLeft: '2px solid var(--accent-primary)', paddingLeft: 10, whiteSpace: 'nowrap' }}>
          {pageContext}
        </div>
      </div>
      
      {!isMobile && (
        <div style={{ flex: 1, maxWidth: 480, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, pointerEvents: 'none' }}>▶</span>
          <input ref={inputRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearch} placeholder={t('topbar.search_placeholder')} style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--struct-line)', outline: 'none', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em', padding: '7px 12px 7px 26px', caretColor: 'var(--accent-primary)', transition: 'border-color 0.1s' }} onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--struct-line)'; }} />
          {!search && (<span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)', fontSize: 10, animation: 'blink 1s step-start infinite' }}>▌</span>)}
        </div>
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        {!isMobile && caseLabel && (<div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', border: '1px solid var(--struct-line)', padding: '3px 8px' }}>{transliterate(caseLabel)}</div>)}
        <AlertBell />
        {!isMobile && (
          <>
            <div style={{ width: 1, height: 28, background: 'var(--struct-line)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'var(--accent-threat)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-threat)', boxShadow: '0 0 4px var(--accent-threat)', animation: 'intro-live-pulse 0.8s step-start infinite', display: 'inline-block' }} />
              LIVE
            </div>
          </>
        )}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em', color: 'var(--accent-primary)', textShadow: '0 0 8px rgba(0,255,194,0.4)', minWidth: 70, textAlign: 'right' }}>{time}</div>
      </div>
    </header>
  );
}
