import React from 'react';
import { Folder, Search, X } from 'lucide-react';
import { useDashboardContext } from '../../pages/DashboardContext';
import { useTranslation } from 'react-i18next';
import type { CaseSummary } from '../../types/case';

export function ExplorerWindow({ win }: { win: { id: string } }) {
  const { 
    explorerSearchQuery, 
    setExplorerSearchQuery, 
    handleCreateCase, 
    cases, 
    closeWindow, 
    openWindow, 
    handleDeleteCase 
  } = useDashboardContext();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[10px] font-bold text-gray-300 uppercase">{t('explorer.file_path')}</span>
        <button
          onClick={handleCreateCase}
          className="text-[8px] font-bold border border-[#39ff14]/50 hover:bg-[#39ff14]/10 text-[#39ff14] px-2 py-1 uppercase"
        >
          {t('explorer.init_file')}
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-2.5 py-1 rounded focus-within:border-[#39ff14] transition-all w-full pointer-events-auto flex-shrink-0">
        <Search size={10} className="text-gray-500" />
        <input
          type="text"
          placeholder={t('explorer.search_placeholder')}
          value={explorerSearchQuery}
          onChange={(e) => setExplorerSearchQuery(e.target.value)}
          className="bg-transparent border-none text-gray-200 placeholder-gray-600 text-[9px] font-mono outline-none w-full uppercase"
        />
        {explorerSearchQuery && (
          <button
            onClick={() => setExplorerSearchQuery('')}
            className="text-gray-500 hover:text-gray-350 text-[8px] font-bold"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cases.filter((c: CaseSummary) => c.title.toLowerCase().includes(explorerSearchQuery.toLowerCase())).map((c: CaseSummary) => (
          <div
            key={c.caseId}
            onClick={() => {
              closeWindow(win.id);
              openWindow(
                `workspace-${c.caseId}`,
                `Case Workspace: ${c.title}`,
                'case_workspace',
                { caseId: c.caseId }
              );
            }}
            className="p-3 bg-white/5 border border-white/10 hover:border-[#39ff14]/50 cursor-pointer transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <Folder size={18} className="text-[#a855f7] group-hover:text-[#39ff14] transition-colors" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-200">{c.title}</span>
                <span className="text-[8px] text-gray-500 font-mono mt-0.5">{c.caseId}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCase(e, c.caseId, c.title);
              }}
              className="text-gray-500 hover:text-red-400 p-1"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
