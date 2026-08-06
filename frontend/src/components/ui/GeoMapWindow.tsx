import React, { useEffect, useState, useRef, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { getGeoIntelligence, type GeoIntelligenceResult } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';

interface GeoMapWindowProps {
  caseId: string;
}

export function GeoMapWindow({ caseId }: GeoMapWindowProps) {
  const [data, setData] = useState<GeoIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [globeSize, setGlobeSize] = useState(600);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useUIStore();

  // Measure container and set globe size to fill it
  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const size = Math.max(Math.min(width, height) * 1.4, 300);
      setGlobeSize(Math.round(size));
    }
  }, []);

  useEffect(() => {
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateSize]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const res = await getGeoIntelligence(caseId);
        if (mounted) setData(res);
      } catch (err) {
        if (mounted) {
          console.error('Failed to load geo intelligence:', err);
          showToast('FAILED TO LOAD GEO-INTELLIGENCE', 'error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, [caseId, showToast]);

  useEffect(() => {
    if (globeEl.current && data?.nodes.length) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.8;
      globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1500);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-[#39ff14]/30 border-t-[#39ff14] rounded-full animate-spin mb-4" />
        <div className="text-[10px] font-mono text-[#39ff14] animate-pulse uppercase tracking-widest">
          ESTABLISHING SATELLITE UPLINK...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#020408] overflow-hidden rounded-md border border-white/5"
      style={{ minHeight: 0, minWidth: 0 }}
    >
      {/* HUD Overlay */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-[12px] font-bold font-mono text-[#39ff14] tracking-widest mb-1 shadow-black drop-shadow-md">
          GEO-INTELLIGENCE MATRIX
        </div>
        <div className="flex gap-4 text-[9px] font-mono text-gray-400">
          <div>NODES DETECTED: <span className="text-white">{data?.nodes.length || 0}</span></div>
          <div>ACTIVE ARCS: <span className="text-[#a855f7]">{data?.arcs.length || 0}</span></div>
        </div>
      </div>

      {/* Globe — centered in container, sized to fill it */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: globeSize,
          height: globeSize,
          pointerEvents: 'auto',
        }}
      >
        <Globe
          ref={globeEl}
          width={globeSize}
          height={globeSize}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(2, 4, 8, 0)"

          pointsData={data?.nodes || []}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => '#39ff14'}
          pointAltitude={0.02}
          pointRadius={0.5}
          pointsMerge={false}

          labelsData={data?.nodes || []}
          labelLat="lat"
          labelLng="lng"
          labelText={(d: { label?: string }) => (d.label || '').replace(/^Domain:\s*/, '').replace(/\s*\([A-Z]{2}\)$/, '')}
          labelSize={0.35}
          labelDotRadius={0.15}
          labelColor={() => 'rgba(255, 255, 255, 0.9)'}
          labelResolution={4}
          labelAltitude={(d: { label?: string }) => 0.02 + ((d.label || '').length % 5) * 0.02}

          arcsData={data?.arcs || []}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={() => ['#a855f7', '#39ff14']}
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={1500}
          arcAltitudeAutoScale={0.5}
          arcStroke={0.5}
        />
      </div>
    </div>
  );
}
