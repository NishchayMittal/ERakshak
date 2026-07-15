import React from 'react';
import { useGraphStore } from '../../state/graphStore';

export default function TimelineView() {
  const { evidencePack, selectedEntityId, loading } = useGraphStore();

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 animate-pulse space-y-4">
        <div className="w-1/3 h-4 bg-slate-800 rounded"></div>
        <div className="space-y-6 pl-4 border-l border-slate-800">
          {[1, 2, 3].map((n) => (
            <div key={n} className="space-y-2 relative">
              <div className="absolute -left-6 w-3.5 h-3.5 rounded-full bg-slate-800"></div>
              <div className="w-24 h-3 bg-slate-800 rounded"></div>
              <div className="w-3/4 h-4 bg-slate-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedEntityId || !evidencePack) {
    return (
      <div className="bg-slate-900 border border-slate-855 rounded-lg p-5 text-center py-10">
        <svg className="w-10 h-10 text-slate-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-xs text-slate-500 font-medium">
          Select any node in the link graph to review chronological intelligence timeline events.
        </p>
      </div>
    );
  }

  // Compile timeline events from evidencePack findings
  let events: Array<{ id: string; date: string; label: string; source: string; entityId: string }> = [];

  const activeIdentifier = evidencePack.identifiers.find(
    (i) => i.id === selectedEntityId || i.normalizedValue.toLowerCase() === selectedEntityId.toLowerCase()
  );

  if (activeIdentifier) {
    events = activeIdentifier.findings
      .filter((f) => f.discoveredAt)
      .map((f) => ({
        id: f.id,
        date: f.discoveredAt ? f.discoveredAt.split('T')[0] : new Date().toISOString().split('T')[0],
        label: f.rawPayload?.label || `${f.connector.toUpperCase()} — Detected ${f.type.replace(/_/g, ' ')}: ${f.value}`,
        source: f.connector,
        entityId: selectedEntityId,
      }));
  } else {
    for (const ident of evidencePack.identifiers) {
      const match = ident.findings.find(
        (f) => f.value.toLowerCase() === selectedEntityId.toLowerCase() || f.id === selectedEntityId
      );
      if (match) {
        events = ident.findings
          .filter((f) => f.value.toLowerCase() === match.value.toLowerCase() && f.discoveredAt)
          .map((f) => ({
            id: f.id,
            date: f.discoveredAt ? f.discoveredAt.split('T')[0] : new Date().toISOString().split('T')[0],
            label: f.rawPayload?.label || `${f.connector.toUpperCase()} — Detected ${f.type.replace(/_/g, ' ')}: ${f.value}`,
            source: f.connector,
            entityId: selectedEntityId,
          }));
        break;
      }
    }
  }

  if (events.length === 0) {
    return (
      <div className="bg-slate-905 border border-slate-850 rounded-lg p-5 text-center py-10 font-mono text-[10px] text-slate-500 uppercase">
        No chronological history logs logged for this node.
      </div>
    );
  }

  // Sort chronological ascending
  const sortedData = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="bg-slate-900 border border-slate-850 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/20">
        <h3 className="font-bold text-slate-200 text-xs uppercase tracking-wider font-mono">Chronological Event Timeline</h3>
        <p className="text-[10px] text-slate-500 mt-0.5">Dated footprints collected from historical registries and archives.</p>
      </div>

      {/* Timeline track container */}
      <div className="flex-1 overflow-y-auto p-4 max-h-[300px]">
        <div className="relative pl-6 border-l border-slate-800 space-y-6 py-2">
          {sortedData.map((event) => (
            <div key={event.id} className="relative group text-xs">
              {/* Event node dot indicator */}
              <span className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-full bg-slate-950 border-2 border-indigo-500 group-hover:bg-indigo-400 group-hover:scale-125 transition-all"></span>

              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono font-semibold text-indigo-400 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-900/50">
                  {event.date}
                </span>
                
                {/* Source badge */}
                <span className="text-[9px] font-mono text-slate-500 uppercase">
                  {event.source}
                </span>
              </div>

              <p className="text-slate-350 leading-relaxed font-sans mt-1">
                {event.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
