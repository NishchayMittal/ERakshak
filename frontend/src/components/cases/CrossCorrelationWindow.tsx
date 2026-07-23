import React, { useEffect, useState } from 'react';
import { Network, AlertTriangle, Shield, Folder, RefreshCw } from 'lucide-react';
import { getCrossCorrelations, type CrossCorrelationResult } from '../../api/endpoints';
import { useDashboardContext } from '../../pages/DashboardContext';
import { useUIStore } from '../../state/uiStore';
import { useTranslation } from 'react-i18next';

export function CrossCorrelationWindow({ win }: { win: { id: string } }) {
  const [data, setData] = useState<CrossCorrelationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const { openWindow, closeWindow } = useDashboardContext();
  const { showToast } = useUIStore();
  const { t } = useTranslation();

  const fetchCorrelations = async () => {
    setLoading(true);
    try {
      const result = await getCrossCorrelations();
      setData(result);
    } catch (err) {
      console.error('Cross-correlate failed:', err);
      showToast(t('cross_correlation.scan_failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    // loading starts true via initial useState(true)
    getCrossCorrelations().then(result => {
      if (active) {
        setData(result);
        setLoading(false);
      }
    }).catch(err => {
      if (active) {
        console.error('Cross-correlate failed:', err);
        showToast(t('cross_correlation.scan_failed'), 'error');
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [t, showToast]);

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1 select-none text-gray-200">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[10px] font-bold text-[#a855f7] uppercase tracking-wider flex items-center gap-1.5">
          <Network size={12} /> {t('cross_correlation.title')}
        </span>
        <button
          onClick={fetchCorrelations}
          disabled={loading}
          className="text-[8px] font-bold border border-[#a855f7]/50 hover:bg-[#a855f7]/10 text-[#a855f7] px-2 py-1 uppercase disabled:opacity-50 flex items-center gap-1"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {loading ? t('cross_correlation.scanning') : t('cross_correlation.rescan')}
        </button>
      </div>

      {/* Stats bar */}
      {data && (
        <div className="flex gap-4 text-[8.5px] font-mono uppercase tracking-wider bg-black/30 p-2 rounded border border-white/5">
          <span className="text-gray-400">{t('cross_correlation.cases_analyzed')}<span className="text-[#39ff14] font-bold">{data.cases_analyzed}</span></span>
          <span className="text-gray-400">{t('cross_correlation.shared_ids')}<span className={data.total_shared_identifiers > 0 ? 'text-[#a855f7] font-bold' : 'text-gray-400'}>{data.total_shared_identifiers}</span></span>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center flex flex-col items-center gap-2">
            <RefreshCw size={24} className="text-[#a855f7] animate-spin" />
            <span className="text-[9px] font-mono text-[#a855f7] animate-pulse uppercase tracking-widest">
              {t('cross_correlation.scanning_msg')}
            </span>
          </div>
        </div>
      )}

      {!loading && data && data.correlations.length === 0 && (
        <div className="flex-1 flex items-center justify-center py-12">
          <div className="text-center flex flex-col items-center gap-2">
            <Shield size={32} className="text-gray-600 mb-1" />
            <p className="text-[10px] font-mono text-gray-400 uppercase font-bold">{t('cross_correlation.no_shared')}</p>
            <p className="text-[8.5px] font-mono text-gray-500 max-w-xs">
              {t('cross_correlation.no_shared_desc')}
            </p>
          </div>
        </div>
      )}

      {!loading && data && data.correlations.length > 0 && (
        <div className="flex flex-col gap-3">
          {data.correlations.map((corr, idx) => (
            <div key={idx} className="bg-[#a855f7]/5 border border-[#a855f7]/20 p-3 rounded-lg hover:border-[#a855f7]/40 transition-all">
              {/* Correlation Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className="text-[#a855f7]" />
                  <span className="text-[10px] font-bold text-[#a855f7] uppercase tracking-wide">{t('cross_correlation.cross_match')}</span>
                </div>
                <span className="text-[8px] font-mono bg-[#a855f7]/15 text-[#a855f7] px-1.5 py-0.5 rounded uppercase font-bold">{corr.type}</span>
              </div>

              {/* Shared Value */}
              <div className="bg-black/40 border border-white/5 px-2.5 py-1.5 rounded mb-2">
                <span className="text-[8px] text-gray-500 font-mono uppercase block mb-0.5">{t('cross_correlation.shared_identifier')}</span>
                <span className="text-[11px] text-[#39ff14] font-mono font-bold break-all">{corr.normalized_value}</span>
              </div>

              {/* Involved Cases */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] text-gray-400 font-mono uppercase font-bold">{t('cross_correlation.appears_in', { count: corr.case_count })}</span>
                {corr.cases.map((c, cIdx) => (
                  <div
                    key={cIdx}
                    onClick={() => {
                      closeWindow(win.id);
                      openWindow(
                        `workspace-${c.case_id}`,
                        `Case Workspace: ${c.case_title}`,
                        'case_workspace',
                        { caseId: c.case_id }
                      );
                    }}
                    className="flex items-center justify-between bg-white/5 border border-white/5 hover:border-[#39ff14]/40 px-2.5 py-1.5 rounded cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Folder size={12} className="text-[#a855f7] group-hover:text-[#39ff14] transition-colors" />
                      <span className="text-[9.5px] font-bold text-gray-300 group-hover:text-white uppercase">{c.case_title}</span>
                    </div>
                    <span className="text-[7.5px] font-mono text-gray-500 uppercase">{c.source}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
