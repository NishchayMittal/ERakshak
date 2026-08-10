import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useParams } from 'react-router';
import { useCaseStore } from '../../state/caseStore';
import AlertBell from '../alerts/AlertBell';
import { useTransliterate } from '../ui/Transliterate';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../state/uiStore';
import { useTutorialStore } from '../../state/tutorialStore';
import { Shield, Play, Terminal, RefreshCw, X, Folder } from 'lucide-react';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

export const WALLPAPERS = [
  {
    name: 'Cyber Mesh',
    value: 'linear-gradient(135deg, #090e17 0%, #03060c 60%, #010204 100%)',
    gridColor: 'rgba(57, 255, 20, 0.03)',
    accentGlow: 'rgba(57, 255, 20, 0.12)',
    accentColor: '#39FF14'
  },
  {
    name: 'Techno Void',
    value: 'radial-gradient(circle at center, #18052b 0%, #080112 50%, #000000 100%)',
    gridColor: 'rgba(168, 85, 247, 0.03)',
    accentGlow: 'rgba(168, 85, 247, 0.15)',
    accentColor: '#A855F7'
  },
  {
    name: 'Deep Hazard',
    value: 'radial-gradient(circle at 30% 30%, #29080e 0%, #0b0103 70%, #000000 100%)',
    gridColor: 'rgba(239, 68, 68, 0.03)',
    accentGlow: 'rgba(239, 68, 68, 0.12)',
    accentColor: '#EF4444'
  }
];

interface TopBarProps {
  isDashboard?: boolean;
  onMenuToggle?: () => void; // mobile menu
  isMobile?: boolean;

  // Sidebar controls for Dashboard
  showSidebarOnMobile?: boolean;
  setShowSidebarOnMobile?: (val: boolean) => void;

  // Wallpaper controls for Dashboard
  wallpaperIdx?: number;
  setWallpaperIdx?: (idx: number) => void;
  customWallpaper?: string | null;
  setCustomWallpaper?: (val: string | null) => void;

  // User badge info
  user?: { badgeNumber: string; name: string } | null;
}

export default function TopBar({
  isDashboard = false,
  onMenuToggle,
  isMobile = false,
  showSidebarOnMobile = false,
  setShowSidebarOnMobile,
  wallpaperIdx = 0,
  setWallpaperIdx,
  customWallpaper = null,
  setCustomWallpaper,
  user
}: TopBarProps) {
  const [time, setTime] = useState('');
  const [search, setSearch] = useState('');
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeCase } = useCaseStore();
  const location = useLocation();
  const params = useParams<{ caseId: string }>();
  const transliterate = useTransliterate();
  const { t, i18n } = useTranslation();
  const { showToast } = useUIStore();
  const { startDemo } = useTutorialStore();

  const adjustFontSize = (delta: number) => {
    const root = document.documentElement;
    if (delta === 0) {
      root.style.setProperty('--font-scale', '1');
      return;
    }
    const currentSize = parseFloat(getComputedStyle(root).getPropertyValue('--font-scale') || '1');
    const newSize = Math.max(0.7, Math.min(1.5, currentSize + delta));
    root.style.setProperty('--font-scale', newSize.toString());
  };

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

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && setCustomWallpaper) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomWallpaper(`url(${event.target.result})`);
          showToast(t('dashboard.wallpaper_loaded', 'Custom wallpaper loaded'), 'success');
          setShowWallpaperMenu(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWallpaperUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const url = e.currentTarget.value.trim();
      if (url && setCustomWallpaper) {
        setCustomWallpaper(`url(${url})`);
        showToast(t('dashboard.url_wallpaper_loaded', 'Custom URL wallpaper loaded'), 'success');
        setShowWallpaperMenu(false);
      }
    }
  };

  // LanguageSwitcher is imported at the top

  return (
    <header 
      style={{ 
        height: isDashboard ? 32 : 56, 
        background: '#080c10', 
        borderBottom: '1px solid var(--struct-line)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: isDashboard ? '0 16px' : '0 20px', 
        gap: 16, 
        flexShrink: 0, 
        position: 'relative' 
      }}
    >
      {/* LEFT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isDashboard ? 8 : 12 }}>
        {isDashboard ? (
          <>
            <span className="font-bold tracking-wider text-[#39ff14] flex items-center gap-1.5 animate-pulse whitespace-nowrap" style={{ fontSize: 'calc(10px * var(--font-scale))' }}>
              <Shield size={12} />
              <span className="hidden sm:inline">{t('dashboard.console_title')}</span>
              <span className="sm:hidden">ORION</span>
            </span>
            <div className="h-3 w-[1px] bg-white/10 hidden sm:block" />
            <button
              onClick={startDemo}
              className="text-[#39FF14] hover:text-white uppercase tracking-wider transition-colors whitespace-nowrap animate-pulse flex items-center gap-1 ml-2 sm:ml-0"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'calc(9px * var(--font-scale))', fontFamily: 'var(--font-mono)' }}
            >
              <Play size={10} className="sm:hidden" />
              <span className="hidden sm:inline">{t('dashboard.start_demo', 'START DEMO')}</span>
              <span className="sm:hidden">{t('dashboard.start_demo_short', 'DEMO')}</span>
            </button>
            {!isMobile && (
              <>
                <div className="h-3 w-[1px] bg-white/10" />
                <button
                  onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
                  className="text-gray-400 hover:text-white uppercase tracking-wider transition-colors whitespace-nowrap"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'calc(9px * var(--font-scale))', fontFamily: 'var(--font-mono)' }}
                >
                  {t('dashboard.wallpaper')}
                </button>
              </>
            )}
            {isMobile && setShowSidebarOnMobile && (
              <button
                onClick={() => setShowSidebarOnMobile(!showSidebarOnMobile)}
                className={`uppercase tracking-wider transition-colors flex items-center gap-1 flex-shrink-0 ${showSidebarOnMobile ? 'text-[#39ff14] font-bold' : 'text-gray-400 hover:text-white'}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'calc(9px * var(--font-scale))', fontFamily: 'var(--font-mono)' }}
              >
                <Terminal size={10} /> {showSidebarOnMobile ? 'HUD ✕' : 'HUD'}
              </button>
            )}
          </>
        ) : (
          <>
            {isMobile && (
              <button
                onClick={onMenuToggle}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: "calc(24px * var(--font-scale))", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ☰
              </button>
            )}
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: "calc(11px * var(--font-scale))", fontWeight: 700, letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', borderLeft: '2px solid var(--accent-primary)', paddingLeft: 10, whiteSpace: 'nowrap' }}>
              {pageContext}
            </div>
            
            {!isMobile && (
              <div style={{ width: 260, position: 'relative', marginLeft: 20 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: "calc(12px * var(--font-scale))", pointerEvents: 'none' }}>▶</span>
                <input ref={inputRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleSearch} placeholder={t('topbar.search_placeholder')} style={{ width: '100%', background: 'var(--bg-1)', border: '1px solid var(--struct-line)', outline: 'none', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)', fontSize: "calc(11px * var(--font-scale))", letterSpacing: '0.05em', padding: '7px 12px 7px 26px', caretColor: 'var(--accent-primary)', transition: 'border-color 0.1s' }} onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; }} onBlur={(e) => { e.target.style.borderColor = 'var(--struct-line)'; }} />
                {!search && (<span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent-primary)', fontSize: "calc(10px * var(--font-scale))", animation: 'blink 1s step-start infinite' }}>▌</span>)}
              </div>
            )}
          </>
        )}
      </div>

      {/* CENTERED FONT ADJUST CONTROLS */}
      {!isMobile && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-1)', border: '1px solid var(--struct-line)', padding: '2px 4px', borderRadius: 4, zIndex: 10 }}>
          <button onClick={() => adjustFontSize(-0.1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer', width: 24, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 'bold' }}>A-</button>
          <button onClick={() => adjustFontSize(0)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', width: 24, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 'bold' }}>A</button>
          <button onClick={() => adjustFontSize(0.1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', width: 24, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 'bold' }}>A+</button>
        </div>
      )}
      
      {/* RIGHT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isDashboard ? 6 : 16, flexShrink: 0 }}>
        {isDashboard ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
              <LanguageSwitcher />
            </div>
            {!isMobile && (
              <>
                <div className="h-3 w-[1px] bg-white/10" />
                <span data-tutorial="profile-menu" className="whitespace-nowrap" style={{ fontSize: 'calc(9px * var(--font-scale))', color: 'var(--text-muted)' }}>
                  {t('dashboard.badge_label')}{' '}
                  <span className="text-[#39ff14] font-bold">{user?.badgeNumber}</span>
                </span>
                <div className="h-3 w-[1px] bg-white/10" />
                <span className="flex items-center gap-1 text-[#39ff14] whitespace-nowrap" style={{ fontSize: 'calc(9px * var(--font-scale))' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-ping" /> {t('dashboard.core_ready')}
                </span>
              </>
            )}
            {isMobile && (
              <span className="flex items-center gap-1 text-[#39ff14]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-ping" />
              </span>
            )}
          </>
        ) : (
          <>
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
                <select
                  value={i18n.language || 'en'}
                  onChange={(e) => {
                    i18n.changeLanguage(e.target.value);
                    showToast(`Language set to ${e.target.value.toUpperCase()}`, 'info');
                  }}
                  style={{
                    background: 'var(--bg-1)',
                    border: '1px solid var(--struct-line)',
                    color: 'var(--accent-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: "calc(10px * var(--font-scale))",
                    padding: '4px 8px',
                    outline: 'none',
                    cursor: 'pointer',
                    borderRadius: 4
                  }}
                >
                  <option value="en">ENG</option>
                  <option value="hi">HIN</option>
                  <option value="gu">GUJ</option>
                </select>
              </div>
            )}
            {!isMobile && caseLabel && (<div style={{ fontFamily: 'var(--font-mono)', fontSize: "calc(9px * var(--font-scale))", letterSpacing: '0.2em', color: 'var(--text-muted)', textTransform: 'uppercase', border: '1px solid var(--struct-line)', padding: '3px 8px' }}>{transliterate(caseLabel)}</div>)}
            <AlertBell />
            {!isMobile && (
              <>
                <div style={{ width: 1, height: 28, background: 'var(--struct-line)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: "calc(9px * var(--font-scale))", letterSpacing: '0.15em', color: 'var(--accent-threat)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-threat)', boxShadow: '0 0 4px var(--accent-threat)', animation: 'intro-live-pulse 0.8s step-start infinite', display: 'inline-block' }} />
                  LIVE
                </div>
              </>
            )}
          </>
        )}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: `calc(${isDashboard ? 10 : 12}px * var(--font-scale))`, letterSpacing: '0.1em', color: 'var(--accent-primary)', textShadow: '0 0 8px rgba(0,255,194,0.4)', minWidth: isDashboard ? 60 : 70, textAlign: 'right' }}>{time}</div>
      </div>

      {/* Wallpaper backdrop click catcher */}
      {showWallpaperMenu && (
        <div
          className="fixed inset-0 z-[999]"
          onClick={() => setShowWallpaperMenu(false)}
        />
      )}

      {/* Wallpaper dropdown */}
      {showWallpaperMenu && (
        <div 
          className="absolute bg-[#080d16]/95 border border-[#39ff14]/20 backdrop-blur-xl p-2 rounded shadow-2xl z-[1000] flex flex-col gap-1 w-44"
          style={{ top: 36, left: 160 }}
        >
          {WALLPAPERS.map((wp, idx) => (
            <button
              key={wp.name}
              onClick={() => {
                if (setCustomWallpaper && setWallpaperIdx) {
                  setCustomWallpaper(null);
                  setWallpaperIdx(idx);
                  setShowWallpaperMenu(false);
                }
              }}
              className={`w-full text-left text-[10px] px-2 py-1.5 hover:bg-[#39ff14]/10 transition flex items-center justify-between ${wallpaperIdx === idx && !customWallpaper ? 'text-[#39ff14]' : 'text-gray-300'}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
            >
              <span>{wp.name}</span>
              {wallpaperIdx === idx && !customWallpaper && <div className="w-1.5 h-1.5 rounded-full bg-[#39ff14]" />}
            </button>
          ))}
          {/* File Upload Input */}
          <div className="border-t border-white/10 mt-1 pt-1">
            <label className="w-full text-left text-[9px] px-2 py-1.5 text-gray-400 hover:text-white cursor-pointer transition flex items-center gap-1.5 uppercase font-bold" style={{ fontFamily: 'var(--font-mono)' }}>
              <span>{t('dashboard.custom_file')}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleWallpaperUpload}
                className="hidden"
              />
            </label>
          </div>
          {/* Custom URL Input */}
          <div className="border-t border-[#39ff14]/10 mt-1 pt-1 flex flex-col gap-1 px-2">
            <span className="text-[7.5px] text-gray-500 font-mono">{t('dashboard.paste_url')}</span>
            <input
              type="text"
              placeholder={t('dashboard.url_placeholder')}
              onKeyDown={handleWallpaperUrlKeyDown}
              className="w-full bg-black border border-white/10 text-gray-300 text-[8px] px-1 py-0.5 focus:border-[#39ff14] outline-none"
            />
          </div>
        </div>
      )}
    </header>
  );
}
