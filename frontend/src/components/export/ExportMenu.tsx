import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, ChevronDown } from 'lucide-react';
import { exportCaseCSV, exportCaseJSON, exportCasePDF } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';
import { useTranslation } from 'react-i18next';

interface ExportMenuProps {
  caseId: string;
}

// Audio click synth
const playClickTone = () => {};

export default function ExportMenu({ caseId }: ExportMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useUIStore();

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = filename;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExportJSON = async () => {
    playClickTone();
    setExporting(true);
    try {
      const blob = await exportCaseJSON(caseId);
      downloadBlob(blob, `ERakshak_Dossier_${caseId}_Export.json`);
      showToast(t('export.json_success'), 'success');
    } catch (error) {
      console.error(error);
      showToast(t('export.json_failed'), 'error');
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  const handleExportCSV = async () => {
    playClickTone();
    setExporting(true);
    try {
      const blob = await exportCaseCSV(caseId);
      downloadBlob(blob, `ERakshak_Findings_${caseId}.csv`);
      showToast(t('export.csv_success'), 'success');
    } catch (error) {
      console.error(error);
      showToast(t('export.csv_failed'), 'error');
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  const handleExportPDF = async () => {
    playClickTone();
    setExporting(true);
    showToast(t('export.pdf_generating'), 'info');

    try {
      const blob = await exportCasePDF(caseId);
      downloadBlob(blob, `ERakshak_Dossier_${caseId}.pdf`);
      showToast(t('export.pdf_success'), 'success');
    } catch (error) {
      console.error(error);
      showToast(t('export.pdf_failed'), 'error');
    } finally {
      setExporting(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left select-none">
      <div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => {
            playClickTone();
            setIsOpen(!isOpen);
          }}
          disabled={exporting}
          className="px-3.5 py-2 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded text-xs font-bold shadow hover:shadow-indigo-500/10 transition-all border border-indigo-400/40 flex items-center gap-1.5 font-mono uppercase tracking-wider"
        >
          {exporting ? (
            <RefreshCw className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Download className="w-4 h-4 text-slate-100" />
          )}
          <span>{exporting ? t('export.exporting') : t('export.export_dossier')}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-slate-200 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </motion.button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-10"
            ></div>
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="origin-top-right absolute right-0 mt-2.5 w-52 rounded-lg shadow-2xl bg-slate-900 border border-slate-800 z-20 focus:outline-none overflow-hidden cyber-panel"
            >
              <div className="py-1">
                <button
                  onClick={() => void handleExportJSON()}
                  disabled={exporting}
                  className="w-full text-left px-4 py-3 text-xs text-slate-350 hover:bg-slate-850 hover:text-white flex items-center gap-2.5 transition-colors border-b border-slate-850/50 font-sans"
                >
                  <span className="font-bold text-[8px] uppercase px-1.5 py-0.5 bg-slate-950 rounded text-amber-500 font-mono border border-slate-800">{t('export.json')}</span>
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wide">{t('export.json_desc')}</span>
                </button>

                <button
                  onClick={() => void handleExportCSV()}
                  disabled={exporting}
                  className="w-full text-left px-4 py-3 text-xs text-slate-350 hover:bg-slate-850 hover:text-white flex items-center gap-2.5 transition-colors border-b border-slate-850/50 font-sans"
                >
                  <span className="font-bold text-[8px] uppercase px-1.5 py-0.5 bg-slate-950 rounded text-emerald-500 font-mono border border-slate-800">{t('export.csv')}</span>
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wide">{t('export.csv_desc')}</span>
                </button>

                <button
                  onClick={() => void handleExportPDF()}
                  disabled={exporting}
                  className="w-full text-left px-4 py-3 text-xs text-slate-350 hover:bg-slate-850 hover:text-white flex items-center gap-2.5 transition-colors font-sans"
                >
                  <span className="font-bold text-[8px] uppercase px-1.5 py-0.5 bg-slate-950 rounded text-rose-500 font-mono border border-slate-800">{t('export.pdf')}</span>
                  <span className="font-mono text-[10px] uppercase font-bold tracking-wide">{t('export.pdf_desc')}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
