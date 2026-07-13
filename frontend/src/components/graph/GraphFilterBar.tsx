import React from 'react';
import { useGraphStore } from '../../state/graphStore';

export default function GraphFilterBar() {
  const { 
    confidenceThreshold, 
    setConfidenceThreshold, 
    selectedSources, 
    toggleSourceFilter 
  } = useGraphStore();

  const sources = [
    { id: 'whois', label: 'WHOIS/RDAP' },
    { id: 'crt.sh', label: 'crt.sh Certs' },
    { id: 'wayback', label: 'Wayback CDX' },
    { id: 'sherlock', label: 'Sherlock Enum' },
    { id: 'breach_demo', label: 'Breach DB (Demo)' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-6">
      
      {/* Slider Filter */}
      <div className="flex-1 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <label className="font-semibold text-slate-300">Link Confidence Threshold</label>
          <span className="font-mono text-indigo-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            &gt;= {Math.round(confidenceThreshold * 100)}%
          </span>
        </div>
        
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={confidenceThreshold}
          onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
          className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      {/* Sources Checkboxes */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-300">Provenance Source Filter</label>
        
        <div className="flex flex-wrap gap-2">
          {sources.map((src) => {
            const isChecked = selectedSources.includes(src.id);
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => toggleSourceFilter(src.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                  isChecked
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow'
                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                {src.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
