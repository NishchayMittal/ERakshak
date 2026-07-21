import React, { useEffect, useState } from 'react';
import { Clock, Globe, Activity, Moon, Sun, Shield, RefreshCw, X, FileText, Database, Key, Info, ExternalLink } from 'lucide-react';
import { getTemporalAnalysis, type TemporalAnalysisResult, type FootprintEvent } from '../../api/endpoints';
import { useSciFiSounds } from '../../hooks/useSciFiSounds';
import { useDashboardContext } from '../../pages/DashboardContext';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TemporalWindow({ caseId }: { caseId: string }) {
  const { handleGoToNode, nodePositionsPerCase, graphDataPerCase, graphData } = useDashboardContext();
  const [data, setData] = useState<TemporalAnalysisResult | null>(null);

  const hasGraphNode = (nodeId?: string): boolean => {
    if (!nodeId) return false;
    if (nodePositionsPerCase?.[caseId]?.[nodeId]) return true;
    
    const caseGraph = graphDataPerCase?.[caseId] || graphData;
    if (caseGraph?.nodes && caseGraph.nodes.length > 0) {
      return caseGraph.nodes.some((n: any) => 
        n.id === nodeId || 
        n.data?.id === nodeId || 
        n.label === nodeId || 
        n.data?.label === nodeId ||
        n.normalized_value === nodeId
      );
    }
    
    // Fallback: If nodeId is a non-empty string for identifiers or findings, allow pivoting
    return Boolean(nodeId && nodeId.trim() !== '');
  };
  const [loading, setLoading] = useState(true);
  const [timezoneMode, setTimezoneMode] = useState<'suspected' | 'indian' | 'utc'>('suspected');
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; count: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    day: string;
    hour: number;
    count: number;
    events: FootprintEvent[];
  } | null>(null);

  const { playHover, playClick } = useSciFiSounds();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getTemporalAnalysis(caseId);
      setData(res);
    } catch (err) {
      console.error('Failed to load temporal analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
        <RefreshCw size={24} className="animate-spin text-[#39ff14]" />
        <span className="text-[10px] font-mono tracking-widest uppercase animate-pulse">
          EXTRACTING TEMPORAL FOOTPRINTS & CIRCADIAN METRICS...
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-xs font-mono">
        Failed to load temporal footprint data for this dossier.
      </div>
    );
  }

  // Calculate shift based on active timezoneMode
  const getActiveOffsetHours = (): number => {
    if (timezoneMode === 'suspected') return data.utc_offset_hours;
    if (timezoneMode === 'indian') return 5.5; // IST +05:30
    return 0; // UTC
  };

  const activeOffsetHours = getActiveOffsetHours();
  const offsetShift = Math.round(activeOffsetHours);

  const getShiftedCount = (dayIdx: number, hourIdx: number): number => {
    if (!data.heatmap_utc) return 0;
    const rawUtcHour = (hourIdx - offsetShift + 24) % 24;
    return data.heatmap_utc[dayIdx]?.[rawUtcHour] || 0;
  };

  const getTimezoneLabel = (): string => {
    if (timezoneMode === 'suspected') return `Suspected (${data.inferred_timezone.split(' ')[0]})`;
    if (timezoneMode === 'indian') return 'Indian View (IST +05:30)';
    return 'UTC View (Raw +00:00)';
  };

  const handleCellClick = (dayIdx: number, hourIdx: number) => {
    playClick();
    const count = getShiftedCount(dayIdx, hourIdx);
    const rawUtcHour = (hourIdx - offsetShift + 24) % 24;
    const cellKey = `${dayIdx}_${rawUtcHour}`;
    const events = data.cell_details_utc?.[cellKey] || [];

    setSelectedCell({
      day: DAYS[dayIdx],
      hour: hourIdx,
      count,
      events
    });
  };

  const getMaxCount = (): number => {
    if (!data.heatmap_utc) return 1;
    let max = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (data.heatmap_utc[d][h] > max) max = data.heatmap_utc[d][h];
      }
    }
    return max || 1;
  };

  const maxVal = getMaxCount();

  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-white/5 border-white/5 hover:border-[#39ff14]/30';
    const ratio = count / maxVal;
    if (ratio < 0.25) return 'bg-[#39ff14]/20 border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/30';
    if (ratio < 0.55) return 'bg-[#39ff14]/45 border-[#39ff14]/60 text-white font-semibold hover:bg-[#39ff14]/60';
    if (ratio < 0.85) return 'bg-[#39ff14]/75 border-[#39ff14]/90 text-black font-bold hover:bg-[#39ff14]';
    return 'bg-[#39ff14] border-[#39ff14] text-black font-extrabold shadow-[0_0_8px_#39ff14] hover:scale-105';
  };

  const getBadgeColor = (source: string) => {
    switch (source.toUpperCase()) {
      case 'FINDING': return 'bg-[#39ff14]/15 border-[#39ff14]/40 text-[#39ff14]';
      case 'IDENTIFIER': return 'bg-purple-500/15 border-purple-500/40 text-purple-400';
      case 'NOTE': return 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400';
      case 'AUDIT': return 'bg-blue-500/15 border-blue-500/40 text-blue-400';
      default: return 'bg-gray-500/15 border-gray-500/40 text-gray-300';
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 text-gray-200 select-none relative">
      {/* Metrics HUD Row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-black/40 border border-white/10 p-2.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[8.5px] font-bold uppercase tracking-wider">Inferred Timezone</span>
            <Globe size={12} className="text-[#39ff14]" />
          </div>
          <span className="text-[11px] font-bold text-[#39ff14] font-mono truncate">
            {data.inferred_timezone}
          </span>
        </div>

        <div className="bg-black/40 border border-white/10 p-2.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[8.5px] font-bold uppercase tracking-wider">Sleep Window</span>
            <Moon size={12} className="text-[#a855f7]" />
          </div>
          <span className="text-[11px] font-bold text-gray-200 font-mono truncate">
            {data.sleep_window_local}
          </span>
        </div>

        <div className="bg-black/40 border border-white/10 p-2.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[8.5px] font-bold uppercase tracking-wider">Peak Active Hours</span>
            <Sun size={12} className="text-yellow-400" />
          </div>
          <span className="text-[11px] font-bold text-gray-200 font-mono truncate">
            {data.peak_hours_local}
          </span>
        </div>

        <div className="bg-black/40 border border-white/10 p-2.5 rounded-lg flex flex-col gap-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[8.5px] font-bold uppercase tracking-wider">Night Owl Index</span>
            <Activity size={12} className={data.night_owl_percentage > 25 ? "text-red-400" : "text-[#39ff14]"} />
          </div>
          <span className={`text-[11px] font-bold font-mono truncate ${data.night_owl_percentage > 25 ? "text-red-400" : "text-[#39ff14]"}`}>
            {data.night_owl_percentage}% Executions
          </span>
        </div>
      </div>

      {/* Control Header & Timezone Segment Control */}
      <div className="flex items-center justify-between bg-black/40 border border-white/10 px-3 py-2 rounded-xl flex-wrap gap-2">
        {/* Left Side: Title & Counter Badges */}
        <div className="flex items-center gap-2 font-mono flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-200 uppercase tracking-wider">
            <Clock size={14} className="text-[#39ff14]" />
            <span>Temporal Heatmap (7×24)</span>
          </div>

          <span className="text-[9px] font-semibold text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
            {data.total_observations} Footprints
          </span>

          {data.sources_breakdown && (
            <div className="flex items-center gap-1 text-[8.5px]">
              <span className="bg-[#39ff14]/10 text-[#39ff14] px-2 py-0.5 rounded border border-[#39ff14]/20 font-bold">
                {data.sources_breakdown.findings} Findings
              </span>
              <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 font-bold">
                {data.sources_breakdown.identifiers} IDs
              </span>
              <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold">
                {data.sources_breakdown.audits} Audits
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Clean Segmented Timezone Pill Control */}
        <div className="flex items-center bg-black/60 p-0.5 rounded-lg border border-white/10 font-mono text-[9px] font-bold">
          <button
            onMouseEnter={playHover}
            onClick={() => {
              playClick();
              setTimezoneMode('suspected');
            }}
            title={`Suspected Local Wall Clock (${data.inferred_timezone})`}
            className={`px-2.5 py-1 rounded-md transition uppercase ${
              timezoneMode === 'suspected'
                ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Suspected ({data.inferred_timezone.split(' ')[0]})
          </button>

          <button
            onMouseEnter={playHover}
            onClick={() => {
              playClick();
              setTimezoneMode('indian');
            }}
            title="Indian Standard Time (UTC+05:30)"
            className={`px-2.5 py-1 rounded-md transition uppercase ${
              timezoneMode === 'indian'
                ? 'bg-orange-500/25 text-orange-400 border border-orange-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            IST (+05:30)
          </button>

          <button
            onMouseEnter={playHover}
            onClick={() => {
              playClick();
              setTimezoneMode('utc');
            }}
            title="Universal Coordinated Time (UTC+00:00)"
            className={`px-2.5 py-1 rounded-md transition uppercase ${
              timezoneMode === 'utc'
                ? 'bg-blue-500/25 text-blue-400 border border-blue-500/40 shadow-sm'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            UTC (+00:00)
          </button>
        </div>
      </div>

      {/* 7x24 Matrix Activity Heatmap */}
      <div className="bg-black/50 border border-white/10 p-3 rounded-xl flex flex-col gap-2 relative">
        {/* Heatmap Grid Header: 24 Hours */}
        <div className="grid grid-cols-[40px_repeat(24,1fr)] gap-1 text-center font-mono text-[8px] text-gray-500 font-bold border-b border-white/5 pb-1">
          <div>DAY</div>
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="truncate">{h.toString().padStart(2, '0')}</div>
          ))}
        </div>

        {/* Heatmap Grid Body: 7 Days */}
        {DAYS.map((day, dIdx) => (
          <div key={day} className="grid grid-cols-[40px_repeat(24,1fr)] gap-1 items-center">
            <span className="text-[9px] font-bold font-mono text-gray-400 uppercase tracking-wider">{day}</span>
            {Array.from({ length: 24 }).map((_, hIdx) => {
              const count = getShiftedCount(dIdx, hIdx);
              return (
                <div
                  key={hIdx}
                  onMouseEnter={() => {
                    playHover();
                    setHoveredCell({ day, hour: hIdx, count });
                  }}
                  onMouseLeave={() => setHoveredCell(null)}
                  onClick={() => handleCellClick(dIdx, hIdx)}
                  title={`Click to inspect ${count} footprint events on ${day} @ ${hIdx.toString().padStart(2, '0')}:00`}
                  className={`h-6 rounded border transition-all cursor-pointer flex items-center justify-center text-[7.5px] font-mono ${getCellColor(count)}`}
                >
                  {count > 0 ? count : ''}
                </div>
              );
            })}
          </div>
        ))}

        {/* Hover Tooltip Footer */}
        <div className="h-5 flex items-center justify-between border-t border-white/5 pt-1 mt-1 text-[8.5px] font-mono text-gray-400">
          <span>
            {hoveredCell ? (
              <span className="text-[#39ff14] font-bold">
                {hoveredCell.day} @ {hoveredCell.hour.toString().padStart(2, '0')}:00 {getTimezoneLabel()} — {hoveredCell.count} Footprint Events (Click cell to inspect)
              </span>
            ) : (
              'Click any active grid cell to open detailed footprint event inspector'
            )}
          </span>
          <div className="flex items-center gap-1.5 text-[8px]">
            <span>Low</span>
            <div className="w-2 h-2 rounded bg-white/5 border border-white/5" />
            <div className="w-2 h-2 rounded bg-[#39ff14]/20 border border-[#39ff14]/40" />
            <div className="w-2 h-2 rounded bg-[#39ff14]/50 border border-[#39ff14]/70" />
            <div className="w-2 h-2 rounded bg-[#39ff14] shadow-[0_0_6px_#39ff14]" />
            <span>High</span>
          </div>
        </div>
      </div>

      {/* Tradecraft Assessment Summary Box */}
      <div className="bg-black/40 border border-[#39ff14]/20 p-3 rounded-xl flex flex-col gap-1.5">
        <div className="flex items-center justify-between border-b border-white/5 pb-1">
          <span className="text-[9.5px] font-bold text-[#39ff14] uppercase tracking-wider flex items-center gap-1.5">
            <Shield size={12} /> Circadian & Timezone OSINT Intelligence Summary
          </span>
          <span className="text-[8px] font-mono text-gray-500">CONFIDENCE: HIGH</span>
        </div>
        <p className="text-[10px] text-gray-300 font-mono leading-relaxed">
          {data.tradecraft_summary}
        </p>
      </div>

      {/* Click Event Inspector Modal Overlay */}
      {selectedCell && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[1000] flex items-center justify-center p-4">
          <div className="bg-[#080d16] border border-[#39ff14]/30 rounded-xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#39ff14]" />
                <span className="text-[11px] font-bold text-[#39ff14] uppercase tracking-wider">
                  Footprint Event Inspector: {selectedCell.day} @ {selectedCell.hour.toString().padStart(2, '0')}:00 ({getTimezoneLabel()})
                </span>
                <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded border border-white/10 text-gray-300">
                  {selectedCell.count} EVENTS
                </span>
              </div>
              <button
                onClick={() => { playClick(); setSelectedCell(null); }}
                className="p-1 text-gray-400 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Event List */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
              {selectedCell.events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2 text-center">
                  <Info size={24} />
                  <span className="text-[10px]">No specific raw event payload stored for this baseline cell.</span>
                </div>
              ) : (
                selectedCell.events.map((evt, idx) => (
                  <div key={idx} className="bg-black/50 border border-white/10 p-3 rounded-lg flex flex-col gap-1.5 hover:border-[#39ff14]/30 transition">
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase ${getBadgeColor(evt.source)}`}>
                        {evt.source}: {evt.type}
                      </span>
                      <span className="text-[8px] text-gray-500">
                        {evt.timestamp_utc}
                      </span>
                    </div>

                    <div className="text-[10.5px] font-bold text-gray-200">
                      {evt.title}
                    </div>

                    {evt.value && (
                      <div className="text-[9.5px] text-gray-300 leading-relaxed bg-black/60 p-2.5 rounded border border-white/5 font-mono">
                        {evt.value}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-1 border-t border-white/5 pt-1.5 font-mono">
                      <span className="text-[8px] text-gray-500">
                        NODE REF: {hasGraphNode(evt.node_id) ? evt.node_id!.slice(0, 16) + '...' : 'SYSTEM_TIMELINE'}
                      </span>
                      {hasGraphNode(evt.node_id) && (
                        <button
                          onClick={() => {
                            playClick();
                            setSelectedCell(null);
                            handleGoToNode(caseId, evt.node_id!);
                          }}
                          className="flex items-center gap-1 text-[8.5px] font-bold text-[#39ff14] hover:text-white px-2 py-1 rounded border border-[#39ff14]/40 hover:border-[#39ff14] bg-[#39ff14]/15 hover:bg-[#39ff14]/30 transition uppercase tracking-wider"
                        >
                          <ExternalLink size={10} />
                          Pivot to Node
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2 bg-black/40 border-t border-white/10 flex justify-end">
              <button
                onClick={() => { playClick(); setSelectedCell(null); }}
                className="text-[9px] font-bold bg-[#39ff14]/15 border border-[#39ff14] text-[#39ff14] px-4 py-1.5 rounded hover:bg-[#39ff14] hover:text-black transition uppercase tracking-wider"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
