import React, { useEffect, useState, useRef } from 'react';
import Globe from 'react-globe.gl';
import { getGeoIntelligence, type GeoIntelligenceResult } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';

interface GeoMapWindowProps {
  caseId: string;
}

const GLOBE_SIZE = 1400; // render at a large fixed size

export function GeoMapWindow({ caseId }: GeoMapWindowProps) {
  const [data, setData] = useState<GeoIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const globeEl = useRef<any>(null);
  const { showToast } = useUIStore();

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
      globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 3.5 }, 1500);
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
    /*
     * The outer div is the window's content area (full w/h, clips overflow).
     * The Globe renders at GLOBE_SIZE x GLOBE_SIZE pixels.
     * We use absolute positioning + translate(-50%,-50%) to pin its CENTER
     * to the CENTER of the outer div — no matter how big or small the window is.
     */
    <div
      className="relative w-full h-full bg-[#020408] overflow-hidden rounded-md border border-white/5"
      style={{ minHeight: 0, minWidth: 0 }}
    >
      {/* HUD Overlay — always on top via z-index */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="text-[12px] font-bold font-mono text-[#39ff14] tracking-widest mb-1 shadow-black drop-shadow-md">
          GEO-INTELLIGENCE MATRIX
        </div>
        <div className="flex gap-4 text-[9px] font-mono text-gray-400">
          <div>NODES DETECTED: <span className="text-white">{data?.nodes.length || 0}</span></div>
          <div>ACTIVE ARCS: <span className="text-[#a855f7]">{data?.arcs.length || 0}</span></div>
        </div>
      </div>



      {/* Globe — positioned so its centre is always the centre of the container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%)`,
          width: GLOBE_SIZE,
          height: GLOBE_SIZE,
          pointerEvents: 'auto',
        }}
      >
        <Globe
          ref={globeEl}
          width={GLOBE_SIZE}
          height={GLOBE_SIZE}
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
          labelText={(d: any) => (d.label || '').replace(/^Domain:\s*/, '').replace(/\s*\([A-Z]{2}\)$/, '')}
          labelSize={0.35}
          labelDotRadius={0.15}
          labelColor={() => 'rgba(255, 255, 255, 0.9)'}
          labelResolution={4}
          labelAltitude={(d: any) => 0.02 + ((d.label || '').length % 5) * 0.02}

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
