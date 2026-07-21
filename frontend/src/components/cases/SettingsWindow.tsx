import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardContext } from '../../pages/DashboardContext';

export function SettingsWindow() {
  const { retrainLogs, retrainProgress, handleRetrain } = useDashboardContext();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      <div className="border-b border-white/5 pb-2">
        <h3 className="text-[10px] font-bold text-white tracking-widest uppercase">{t('settings.title')}</h3>
        <p className="text-[8px] text-gray-500 font-mono mt-0.5">{t('settings.description')}</p>
      </div>

      <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
        <h4 className="text-[9px] font-bold text-[#39ff14] uppercase">{t('settings.training_logs')}</h4>

        <div className="h-32 bg-black border border-white/5 rounded p-2.5 font-mono text-[8px] text-gray-400 overflow-y-auto flex flex-col gap-0.5">
          {retrainLogs.length === 0 ? (
            <span className="text-gray-600 italic">{t('settings.no_logs')}</span>
          ) : (
            retrainLogs.map((log, i) => (
              <div key={i}><span className="text-[#39ff14] mr-1.5">&gt;</span>{log}</div>
            ))
          )}
        </div>

        {retrainProgress !== null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[8px] font-bold text-[#39ff14]">
              <span>{t('settings.calibrating')}</span>
              <span>{retrainProgress}%</span>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-[#39ff14]" style={{ width: `${retrainProgress}%` }} />
            </div>
          </div>
        )}

        <button
          onClick={handleRetrain}
          disabled={retrainProgress !== null}
          className="w-full bg-[#39ff14] hover:bg-[#39ff14]/85 text-black disabled:bg-white/5 disabled:text-gray-600 text-[9px] font-bold py-2 uppercase text-center"
        >
          {t('settings.trigger_retrain')}
        </button>
      </div>
    </div>
  );
}
