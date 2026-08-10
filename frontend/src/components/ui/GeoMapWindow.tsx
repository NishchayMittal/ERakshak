import React, { useEffect, useState, useRef, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { getGeoIntelligence, type GeoIntelligenceResult } from '../../api/endpoints';
import { useUIStore } from '../../state/uiStore';
import { useTransliterate } from './Transliterate';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface GeoMapWindowProps {
  caseId: string;
}

export function GeoMapWindow({ caseId }: GeoMapWindowProps) {
  const [data, setData] = useState<GeoIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeEl = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useUIStore();
  const transliterate = useTransliterate();
  const { t } = useTranslation();

  // Measure container and set globe size to fill it
  const updateSize = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width: Math.round(width), height: Math.round(height) });
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
      <div className="absolute top-4 left-4 bg-black/80 p-3 rounded border border-white/10 z-10 font-mono text-[10px] pointer-events-none backdrop-blur-sm">
        <div className="text-[#39ff14] font-bold mb-2 tracking-wider">{t('geo_map.title', 'GEO-INTELLIGENCE MATRIX')}</div>
        <div><span className="text-gray-500">{t('geo_map.nodes_detected', 'NODES DETECTED:')}</span> <span className="text-white">{data?.nodes.length || 0}</span></div>
        <div><span className="text-gray-500">{t('geo_map.active_arcs', 'ACTIVE ARCS:')}</span> <span className="text-[#a855f7]">{data?.arcs.length || 0}</span></div>
      </div>

      {/* Selected Node Details Panel */}
      {selectedNode && (
          <div className="absolute top-4 right-4 bg-black/90 p-4 rounded border border-[#39ff14]/30 z-10 font-mono text-[10px] w-64 backdrop-blur-md shadow-[0_0_15px_rgba(57,255,20,0.15)] pointer-events-auto">
            <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-2">
              <span className="text-[#39ff14] font-bold">{t('geo_map.node_intel', 'NODE INTEL')}</span>
              <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white"><X size={14} /></button>
            </div>
            <div className="space-y-2">
              <div><span className="text-gray-500">{t('geo_map.label', 'LABEL:')}</span> <span className="break-all">{transliterate(selectedNode.label)}</span></div>
              <div><span className="text-gray-500">{t('geo_map.source', 'SOURCE:')}</span> {transliterate(selectedNode.source || 'UNKNOWN')}</div>
              <div><span className="text-gray-500">{t('geo_map.coords', 'COORDS:')}</span> {selectedNode.lat?.toFixed(4)}, {selectedNode.lng?.toFixed(4)}</div>
            </div>
          </div>
      )}

      {/* Globe — sized to fill container exactly */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: dimensions.width,
          height: dimensions.height,
          pointerEvents: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(2, 4, 8, 0)"

          pointsData={data?.nodes || []}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => '#39ff14'}
          pointAltitude={0.02}
          pointRadius={0.5}
          pointsMerge={false}
          onPointClick={(point) => setSelectedNode(point)}

          labelsData={data?.nodes || []}
          labelLat="lat"
          labelLng="lng"
          labelText={(d: { label?: string }) => transliterate((d.label || '').replace(/^Domain:\s*/, '').replace(/\s*\([A-Z]{2}\)$/, ''))}
          labelSize={1.2}
          labelDotRadius={0.3}
          labelColor={() => 'rgba(255, 255, 255, 1)'}
          labelResolution={8}
          labelAltitude={(d: { label?: string }) => 0.02 + ((d.label || '').length % 5) * 0.02}
          onLabelClick={(label) => setSelectedNode(label)}

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
