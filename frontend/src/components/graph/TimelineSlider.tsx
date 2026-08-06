import React, { useEffect, useMemo, useState } from 'react';
import { useGraphStore } from '../../state/graphStore';

// Stable "now" for fallback — captured once when the module loads
const INITIAL_NOW = Date.now();

export default function TimelineSlider() {
  const { graphData, timelineMaxTime, setTimelineMaxTime } = useGraphStore();
  const [isPlaying, setIsPlaying] = useState(false);

  const { minTime, maxTime } = useMemo(() => {
    const now = INITIAL_NOW;
    if (!graphData || graphData.nodes.length === 0) {
      return { minTime: now - 86400000, maxTime: now };
    }
    let minT = Infinity;
    let maxT = -Infinity;

    const checkTime = (ts?: string) => {
      if (ts) {
        const time = new Date(ts).getTime();
        if (!isNaN(time)) {
          if (time < minT) minT = time;
          if (time > maxT) maxT = time;
        }
      }
    };

    graphData.nodes.forEach(n => checkTime(n.timestamp));
    graphData.edges.forEach(e => checkTime(e.timestamp));

    if (minT === Infinity) {
      minT = now - 86400000;
      maxT = now;
    }
    if (minT === maxT) {
      minT -= 3600000;
    }
    return { minTime: minT, maxTime: maxT };
  }, [graphData]);

  useEffect(() => {
    if (timelineMaxTime === null || timelineMaxTime > maxTime) {
      setTimelineMaxTime(maxTime);
    }
  }, [maxTime, timelineMaxTime, setTimelineMaxTime]);

  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = window.setInterval(() => {
        const prev = useGraphStore.getState().timelineMaxTime;
        if (prev === null) {
          useGraphStore.getState().setTimelineMaxTime(minTime);
          return;
        }
        const step = (maxTime - minTime) / 100;
        const next = prev + step;
        if (next >= maxTime) {
          setIsPlaying(false);
          useGraphStore.getState().setTimelineMaxTime(maxTime);
        } else {
          useGraphStore.getState().setTimelineMaxTime(next);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, minTime, maxTime]);

  if (!graphData) return null;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimelineMaxTime(Number(e.target.value));
  };

  const togglePlay = () => {
    if (!isPlaying && timelineMaxTime === maxTime) {
      setTimelineMaxTime(minTime);
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number | null) => {
    if (!time) return '';
    return new Date(time).toLocaleDateString() + ' ' + new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      width: '60%', background: '#0a0f14', border: '1px solid var(--struct-line)',
      padding: '8px 16px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 16, zIndex: 10,
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
    }}>
      <button 
        onClick={togglePlay}
        style={{
          background: 'var(--accent-primary)', color: '#000', border: 'none', 
          width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 'bold'
        }}
      >
        {isPlaying ? '||' : '▶'}
      </button>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input 
          type="range" 
          min={minTime} 
          max={maxTime} 
          value={timelineMaxTime ?? maxTime}
          onChange={handleSliderChange}
          style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>{formatTime(minTime)}</span>
          <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{formatTime(timelineMaxTime)}</span>
          <span>{formatTime(maxTime)}</span>
        </div>
      </div>
    </div>
  );
}
