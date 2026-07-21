import React, { useEffect, useState } from 'react';
import { Clock, Globe, Activity, Moon, Sun, AlertTriangle, Shield, RefreshCw } from 'lucide-react';
import { getTemporalAnalysis, type TemporalAnalysisResult } from '../../api/endpoints';
import { useSciFiSounds } from '../../hooks/useSciFiSounds';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TemporalWindow({ caseId }: { caseId: string }) {
  const [data, setData] = useState<TemporalAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [useLocalTimezone, setUseLocalTimezone] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number; count: number } | null>(null);
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

  // Helper to shift matrix columns according to timezone offset when useLocalTimezone is true
  const offsetShift = useLocalTimezone ? Math.round(data.utc_offset_hours) : 0;

  const getShiftedCount = (dayIdx: number, hourIdx: number): number => {
    if (!data.heatmap_utc) return 0;
    // Calculate raw UTC hour that corresponds to this local display hour
    const rawUtcHour = (hourIdx - offsetShift + 24) % 24;
    return data.heatmap_utc[dayIdx]?.[rawUtcHour] || 0;
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
    if (count === 0) return 'bg-white/5 border-white/5';
    const ratio = count / maxVal;
    if (ratio < 0.25) return 'bg-[#39ff14]/20 border-[#39ff14]/40 text-[#39ff14]';
    if (ratio < 0.55) return 'bg-[#39ff14]/45 border-[#39ff14]/60 text-white font-semibold';
    if (ratio < 0.85) return 'bg-[#39ff14]/75 border-[#39ff14]/90 text-black font-bold';
    return 'bg-[#39ff14] border-[#39ff14] text-black font-extrabold shadow-[0_0_8px_#39ff14]';
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 text-gray-200 select-none">
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

      {/* Control Header & Timezone Toggle */}
      <div className="flex items-center justify-between bg-black/30 border border-white/10 px-3 py-1.5 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#39ff14]" />
          <span className="text-[10px] font-bold tracking-wider uppercase text-gray-300">
            Temporal Activity Heatmap Grid (7 × 24 Matrix)
          </span>
          <span className="text-[9px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
            {data.total_observations} TOTAL FOOTPRINTS
          </span>
        </div>

        <button
          onMouseEnter={playHover}
          onClick={() => {
            playClick();
            setUseLocalTimezone(!useLocalTimezone);
          }}
          className={`text-[9px] font-bold px-2.5 py-1 rounded transition border uppercase tracking-wider font-mono ${
            useLocalTimezone
              ? 'bg-[#39ff14]/15 border-[#39ff14]/50 text-[#39ff14]'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          {useLocalTimezone ? `Local View (${data.inferred_timezone.split(' ')[0]})` : 'UTC View (Raw +00:00)'}
        </button>
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
                {hoveredCell.day} @ {hoveredCell.hour.toString().padStart(2, '0')}:00 {useLocalTimezone ? 'Local' : 'UTC'} — {hoveredCell.count} Footprint Events
              </span>
            ) : (
              'Hover over any grid cell to inspect exact footprint observation counts'
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
    </div>
  );
}
