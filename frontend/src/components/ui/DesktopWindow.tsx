import React from 'react';
import { Folder, Edit, Minus, Minimize2, Maximize2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Transliterate, useTransliterate } from './Transliterate';
import { CaseWindow } from '../cases/CaseWindow';
import { ProfileWindow } from '../cases/ProfileWindow';
import { ExplorerWindow } from '../cases/ExplorerWindow';
import { CrossCorrelationWindow } from '../cases/CrossCorrelationWindow';
import { GeoMapWindow } from './GeoMapWindow';

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

interface DesktopWindowProps {
  win: WindowState;
  activeWindowId: string | null;
  isMobile: boolean;
  focusWindow: (id: string) => void;
  handleDragStart: (e: React.MouseEvent, id: string) => void;
  toggleMaximize: (id: string) => void;
  toggleMinimize: (id: string) => void;
  closeWindow: (id: string) => void;
  handleResizeStart: (e: React.MouseEvent, id: string, dir: string) => void;
  handleTriggerRename: (caseId: string, title: string) => void;
  cases: { caseId: string; title: string }[];
}

export default function DesktopWindow({
  win,
  activeWindowId,
  isMobile,
  focusWindow,
  handleDragStart,
  toggleMaximize,
  toggleMinimize,
  closeWindow,
  handleResizeStart,
  handleTriggerRename,
  cases
}: DesktopWindowProps) {
  const { t } = useTranslation();
  const transliterate = useTransliterate();

  if (win.isMinimized) return null;
  const isFocused = activeWindowId === win.id;

  return (
    <div
      onClick={() => focusWindow(win.id)}
      className={`absolute flex flex-col border shadow-2xl transition-all duration-100 bg-[#04080e]/95 backdrop-blur-xl ${isFocused ? 'border-[#39ff14] shadow-[#39ff14]/5' : 'border-white/10 shadow-black/80'}`}
      style={{
        left: (win.isMaximized || isMobile) ? 0 : win.x,
        top: (win.isMaximized || isMobile) ? '2rem' : win.y,
        width: (win.isMaximized || isMobile) ? '100%' : win.width,
        height: (win.isMaximized || isMobile) ? (isMobile ? 'calc(100% - 2rem - 120px)' : 'calc(100% - 2rem)') : win.height,
        zIndex: win.zIndex
      }}
    >
      {/* Window Header / Title Bar */}
      <div
        onMouseDown={(e) => handleDragStart(e, win.id)}
        onDoubleClick={() => toggleMaximize(win.id)}
        className={`h-7 px-3 flex items-center justify-between cursor-move select-none border-b window-drag-surface ${isFocused ? 'bg-[#39ff14]/5 border-[#39ff14]/20 text-[#39ff14]' : 'bg-[#04080e]/40 border-white/5 text-gray-400'}`}
      >
        <div className="flex items-center gap-2 pointer-events-auto">
          <Folder size={12} className="flex-shrink-0" />
          <span className="text-[9px] font-bold tracking-wider uppercase truncate max-w-[400px]">
            {(() => {
              if (win.type === 'case_workspace') {
                const targetCase = win.caseId ? cases.find(c => c.caseId === win.caseId) : null;
                const titleVal = targetCase ? targetCase.title : win.title.replace('Case Workspace: ', '').replace('Case Analysis: ', '');
                return t('dashboard.case_workspace', { title: transliterate(titleVal) });
              }
              return transliterate(win.title);
            })()}
          </span>
          {win.type === 'case_workspace' && win.caseId && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const targetCase = cases.find(c => c.caseId === win.caseId);
                const title = targetCase ? targetCase.title : win.title.replace('Case Workspace: ', '');
                handleTriggerRename(win.caseId!, title);
              }}
              className="p-1 text-gray-400 hover:text-[#39ff14] hover:bg-white/5 transition rounded flex items-center justify-center"
              title={t('dashboard.rename_dossier')}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <Edit size={10} />
            </button>
          )}
        </div>

        {/* Window controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={(e) => { e.stopPropagation(); toggleMinimize(win.id); }}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/5 transition"
            title={t('dashboard.minimize_window', 'MINIMIZE')}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <Minus size={10} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleMaximize(win.id); }}
            className="p-1 text-gray-400 hover:text-white hover:bg-white/5 transition"
            title={win.isMaximized ? t('dashboard.restore_window') : t('dashboard.maximize_window')}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {win.isMaximized ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
            title={t('dashboard.close_window')}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col p-4">
        {win.type === 'case_workspace' && <CaseWindow win={win as { id: string; type: string; caseId: string; activeTab?: 'intake' | 'graph' | 'dossier' | 'report' }} />}
        {win.type === 'profile' && <ProfileWindow />}
        {win.type === 'cases_explorer' && <ExplorerWindow win={win} />}
        {win.type === 'cross_correlate' && <CrossCorrelationWindow win={win} />}

        {win.type === 'geo_map' && (
          <div className="flex-1 relative w-full h-full min-h-0">
            <GeoMapWindow caseId={win.caseId || 'global'} />
          </div>
        )}
      </div>

      {/* Directional Resize Handles (4 edges + 4 corners) */}
      {!win.isMaximized && (
        <>
          {/* Top edge */}
          <div
            onMouseDown={(e) => handleResizeStart(e, win.id, 'n')}
            className="absolute top-0 left-3 right-3 h-1.5 cursor-ns-resize hover:bg-[#39ff14]/30 z-30"
          />
          {/* Bottom edge */}
          <div
            onMouseDown={(e) => handleResizeStart(e, win.id, 's')}
            className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize hover:bg-[#39ff14]/30 z-30"
          />
          {/* Left edge */}
          <div
            onMouseDown={(e) => handleResizeStart(e, win.id, 'w')}
            className="absolute top-3 bottom-3 left-0 w-1.5 cursor-ew-resize hover:bg-[#39ff14]/30 z-30"
          />
          {/* Right edge */}
          <div
            onMouseDown={(e) => handleResizeStart(e, win.id, 'e')}
            className="absolute top-3 bottom-3 right-0 w-1.5 cursor-ew-resize hover:bg-[#39ff14]/30 z-30"
          />

          {/* Top-Left corner */}
          <div
            onMouseDown={(e) => handleResizeStart(e, win.id, 'nw')}
            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize hover:bg-[#39ff14]/50 z-30"
          />
          {/* Top-Right corner */}
          <div
            onMouseDown={(e) => handleResizeStart(e, win.id, 'ne')}
            className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize hover:bg-[#39ff14]/50 z-30"
          />
          {/* Bottom-Left corner */}
          <div
            onMouseDown={(e) => handleResizeStart(e, win.id, 'sw')}
            className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize hover:bg-[#39ff14]/50 z-30"
          />
          {/* Bottom-Right corner */}
          <div
            onMouseDown={(e) => handleResizeStart(e, win.id, 'se')}
            className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize hover:bg-[#39ff14]/50 z-30"
          />
        </>
      )}
    </div>
  );
}
