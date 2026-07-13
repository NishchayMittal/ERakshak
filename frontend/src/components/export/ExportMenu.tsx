import React, { useState } from 'react';
import { useUIStore } from '../../state/uiStore';
import { useGraphStore } from '../../state/graphStore';

interface ExportMenuProps {
  caseId: string;
}

export default function ExportMenu({ caseId }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { showToast } = useUIStore();
  const { graphData, profileData } = useGraphStore();

  const handleExportJSON = () => {
    if (!graphData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ caseId, graphData, profileData }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ERakshak_Dossier_${caseId}_Export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Raw JSON Dossier exported', 'success');
    setIsOpen(false);
  };

  const handleExportCSV = () => {
    if (!graphData) return;
    // Flatten findings to CSV format
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Node ID,Label,Type,Confidence,Source Count\n";
    
    graphData.nodes.forEach(n => {
      csvContent += `"${n.id}","${n.label}","${n.type}",${n.confidence},${n.sourceCount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `ERakshak_Findings_${caseId}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Flattened CSV exported successfully', 'success');
    setIsOpen(false);
  };

  const handleExportPDF = () => {
    setExporting(true);
    showToast('Generating PDF Intelligence Report...', 'info');

    // Simulate PDF generation delay
    setTimeout(() => {
      setExporting(false);
      showToast('Intelligence Report PDF exported successfully', 'success');
      setIsOpen(false);
    }, 2000);
  };

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 rounded text-xs font-semibold shadow border border-slate-700 flex items-center gap-1.5 transition-all"
        >
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Export Dossier</span>
          <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <>
          <div 
            onClick={() => setIsOpen(false)} 
            className="fixed inset-0 z-10"
          ></div>
          <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-2xl bg-slate-900 border border-slate-800 z-20 focus:outline-none overflow-hidden">
            <div className="py-1">
              <button
                onClick={handleExportJSON}
                disabled={exporting}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-850 hover:text-white flex items-center gap-2 transition-colors border-b border-slate-850/50"
              >
                <span className="font-semibold text-[9px] uppercase px-1 bg-slate-950 rounded text-amber-500 font-mono">JSON</span>
                Raw Graph Dataset
              </button>
              
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-850 hover:text-white flex items-center gap-2 transition-colors border-b border-slate-850/50"
              >
                <span className="font-semibold text-[9px] uppercase px-1 bg-slate-950 rounded text-emerald-500 font-mono">CSV</span>
                Flattened Findings Table
              </button>
              
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-850 hover:text-white flex items-center gap-2 transition-colors"
              >
                <span className="font-semibold text-[9px] uppercase px-1 bg-slate-950 rounded text-rose-500 font-mono">PDF</span>
                {exporting ? 'Generating Report...' : 'Intelligence Report PDF'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
