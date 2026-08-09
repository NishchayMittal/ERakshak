import React from 'react';
import { Network, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HUDPanelProps {
  isMobile: boolean;
  showSidebarOnMobile: boolean;
  setShowSidebarOnMobile: (val: boolean) => void;
  lastAccessedCaseId: string | null;
  cases: { caseId: string; title: string }[];
  transliterate: (txt: string) => string;
  hudLogs: string[];
  renderMatrixGraph: () => React.ReactNode;
}

export default function HUDPanel({
  isMobile,
  showSidebarOnMobile,
  setShowSidebarOnMobile,
  lastAccessedCaseId,
  cases,
  transliterate,
  hudLogs,
  renderMatrixGraph
}: HUDPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      className={
        isMobile
          ? `fixed top-12 right-0 bottom-20 w-full max-w-[420px] bg-[#050b14]/95 border-l border-[#39ff14]/20 p-4 flex flex-col gap-4 z-[991] transition-transform duration-300 pointer-events-auto select-none overflow-y-auto ${showSidebarOnMobile ? 'translate-x-0 shadow-[0_0_50px_rgba(57,255,20,0.15)]' : 'translate-x-full'}`
          : "absolute top-12 right-6 bottom-20 w-[420px] flex flex-col gap-4 pointer-events-none z-10 select-none"
      }
    >
      {/* Animated Cyber Link graph */}
      <div className="w-full bg-black/40 border border-white/5 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center justify-between border-b border-white/5 pb-1">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Network size={12} className="text-[#39ff14]" /> {t('dashboard.cyber_link')}
          </span>
          <span className="text-[7.5px] text-[#39ff14] font-semibold uppercase tracking-wider">
            {(() => {
              const lastAccessedCase = cases.find(c => c.caseId === lastAccessedCaseId);
              return lastAccessedCase ? transliterate(lastAccessedCase.title.replace('Investigation', 'FILE').toUpperCase()) : t('dashboard.no_active_mesh');
            })()}
          </span>
        </div>
        <div className="w-full h-64 flex items-center justify-center relative overflow-hidden bg-black/20 rounded">
          {renderMatrixGraph()}
        </div>
      </div>

      {/* Live log Terminal */}
      <div data-tutorial="hud-terminal" className="w-full flex-1 bg-black/40 border border-white/5 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 pointer-events-auto overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 pb-1">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Terminal size={12} className="text-[#a855f7]" /> {t('dashboard.audit_stream')}
          </span>
        </div>

        <div className="flex-1 overflow-auto font-mono text-[8px] text-gray-400 flex flex-col gap-1 select-text scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {hudLogs.map((log, idx) => (
            <div key={idx} className="whitespace-nowrap flex items-start gap-1">
              <span className="text-[#39ff14]">&gt;</span>
              <span className={log.includes('AUDIT') ? 'text-[#39ff14]' : 'text-gray-300'}>{transliterate(log)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
