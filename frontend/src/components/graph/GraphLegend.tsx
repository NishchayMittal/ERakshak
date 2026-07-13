import React from 'react';

export default function GraphLegend() {
  const legendItems = [
    { label: 'Email Address', color: 'bg-indigo-500 border-indigo-400' },
    { label: 'Phone Number', color: 'bg-emerald-500 border-emerald-400' },
    { label: 'Domain Name', color: 'bg-purple-500 border-purple-400' },
    { label: 'Username/Alias', color: 'bg-cyan-500 border-cyan-400' },
    { label: 'Crypto Wallet', color: 'bg-amber-500 border-amber-400' },
    { label: 'Individual Name', color: 'bg-rose-500 border-rose-400' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
        Graph Legends
      </div>

      {/* Entity Nodes */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full border ${item.color} flex-shrink-0`}></span>
            <span className="text-slate-300 text-[11px]">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="h-px bg-slate-800 my-2"></div>

      {/* Edge Provenance info */}
      <div className="text-[10px] text-slate-500 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span>Solid Path:</span>
          <span className="font-semibold text-slate-400">High Confidence (&gt;80%)</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Dashed/Faded Path:</span>
          <span className="font-semibold text-slate-400">Low Confidence (&lt;50%)</span>
        </div>
      </div>
    </div>
  );
}
