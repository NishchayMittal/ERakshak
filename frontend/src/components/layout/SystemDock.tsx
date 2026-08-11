import React from 'react';
import { Plus, RefreshCw, Compass, Network, User, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NotificationPanel } from '../ui/NotificationPanel';
import { Transliterate } from '../ui/Transliterate';
import { useDashboardContext } from '../../pages/DashboardContext';

interface WindowState {
  id: string;
  title: string;
  type: 'case_workspace' | 'profile' | 'cases_explorer' | 'cross_correlate' | 'geo_map';
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  caseId?: string;
  activeTab?: 'intake' | 'graph' | 'dossier' | 'report';
}

interface SystemDockProps {
  isMobile: boolean;
  windows: WindowState[];
  caseCreating: boolean;
  handleCreateCase: () => void;
  openWindow: (id: string, title: string, type: 'case_workspace' | 'profile' | 'cases_explorer' | 'cross_correlate' | 'geo_map') => void;
  toggleMinimize: (id: string) => void;
  setDockContextMenu: (val: { x: number; y: number; windowId: string; title: string } | null) => void;
  setShowLogoutConfirm: (val: boolean) => void;
}

export default function SystemDock({
  isMobile,
  windows,
  caseCreating,
  handleCreateCase,
  openWindow,
  toggleMinimize,
  setDockContextMenu,
  setShowLogoutConfirm
}: SystemDockProps) {
  const { t } = useTranslation();
  const { pendingApprovals, user } = useDashboardContext();
  const showPendingDot = user?.badgeNumber?.toUpperCase() === 'INV-001' && pendingApprovals && pendingApprovals.length > 0;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-14 bg-[#080d16]/75 border border-white/10 backdrop-blur-xl rounded-2xl flex items-center px-2 sm:px-4 gap-2 sm:gap-3 z-[999] shadow-2xl max-w-[calc(100vw-2rem)]">
      <button
        onClick={handleCreateCase}
        disabled={caseCreating}
        title={t('dashboard.create_case')}
        className="w-10 h-10 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors flex items-center justify-center text-gray-300 hover:text-[#39ff14] disabled:opacity-50 disabled:pointer-events-none"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        {caseCreating ? <RefreshCw size={20} className="animate-spin" /> : <Plus size={20} />}
      </button>

      <div className="h-6 w-[1px] bg-white/10" />

      {/* Launchers */}
      <button
        onClick={() => openWindow('cases_explorer', t('dashboard.explorer_title'), 'cases_explorer')}
        title={t('dashboard.explorer_tooltip')}
        className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${windows.some(w => w.id === 'cases_explorer') ? 'text-[#39ff14] bg-white/5 border border-white/10' : 'text-gray-300 hover:text-[#39ff14] hover:bg-white/5'}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <Compass size={20} />
      </button>

      <button
        onClick={() => openWindow('cross_correlate_window', t('dashboard.correlator_title'), 'cross_correlate')}
        title={t('dashboard.correlator_tooltip')}
        data-tutorial="cross-correlate"
        className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${windows.some(w => w.id === 'cross_correlate_window') ? 'text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/30' : 'text-gray-300 hover:text-[#a855f7] hover:bg-white/5'}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <Network size={20} />
      </button>

      <button
        onClick={() => openWindow('profile_window', t('dashboard.profile_title'), 'profile')}
        title={t('dashboard.profile_tooltip')}
        className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center relative ${windows.some(w => w.id === 'profile_window') ? 'text-[#39ff14] bg-white/5 border border-white/10' : 'text-gray-300 hover:text-[#39ff14] hover:bg-white/5'}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <User size={20} />
        {showPendingDot && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#0a0f18]"></span>
        )}
      </button>

      <NotificationPanel />

      {/* On desktop: window task buttons stay inline in the dock */}
      {!isMobile && windows.length > 0 && <div className="h-6 w-[1px] bg-white/10" />}

      {!isMobile && windows.map(w => {
        const isOpen = !w.isMinimized;
        return (
          <button
            key={`task-${w.id}`}
            onClick={() => toggleMinimize(w.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setDockContextMenu({ x: e.clientX, y: e.clientY - 50, windowId: w.id, title: w.title });
            }}
            title={w.title}
            className={`px-3 h-10 rounded-xl transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${isOpen ? 'bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]' : 'bg-white/5 border border-white/5 text-gray-500 hover:text-white'}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-[#39ff14] animate-pulse' : 'bg-gray-600'}`} />
            <span className="max-w-[70px] truncate"><Transliterate>{w.title.replace('Case Workspace: ', '').replace('Case Analysis: ', '')}</Transliterate></span>
          </button>
        );
      })}

      {!isMobile && windows.length > 0 && <div className="h-6 w-[1px] bg-white/10" />}

      {/* Disconnect */}
      <button
        onClick={() => setShowLogoutConfirm(true)}
        title={t('dashboard.logout_tooltip')}
        className="w-10 h-10 rounded-xl hover:bg-red-500/10 active:bg-red-500/20 transition-colors flex items-center justify-center text-gray-500 hover:text-red-400"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <LogOut size={20} />
      </button>
    </div>
  );
}
