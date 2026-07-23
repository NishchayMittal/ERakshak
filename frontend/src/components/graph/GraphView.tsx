import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import { useGraphStore } from '../../state/graphStore';
import { graphStyles } from './graphStyles';
import TimelineSlider from './TimelineSlider';
import { useTranslation } from 'react-i18next';
import { useTransliteration } from '../ui/Transliterate';

// Register cytoscape-cola layout algorithm
try {
  cytoscape.use(cola);
} catch (e) {
  console.warn('Cytoscape extension registration warning:', e);
}

interface GraphViewProps {
  onSelectNode: (entityId: string) => void;
}

export default function GraphView({ onSelectNode }: GraphViewProps) {
  const { t } = useTranslation();
  const transliterate = useTransliteration();
  const { graphData, confidenceThreshold, selectedSources, timelineMaxTime, selectedEntityId } = useGraphStore();
  const cyRef = useRef<cytoscape.Core | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);

  // Compute filtered elements
  const elements = useMemo(() => {
    if (!graphData) return [];

    const isVisibleInTime = (timestamp?: string) => {
      if (!timestamp || timelineMaxTime === null) return true;
      const time = new Date(timestamp).getTime();
      return !isNaN(time) && time <= timelineMaxTime;
    };

    const filteredNodes = graphData.nodes.filter(
      (node) => node.confidence >= confidenceThreshold && isVisibleInTime(node.timestamp)
    );
    const filteredEdges = graphData.edges.filter((edge) => {
      const matchesConfidence = edge.confidence >= confidenceThreshold;
      const matchesSource = selectedSources.includes(edge.sourceProvenance) || 
                            edge.sourceProvenance === 'correlation_engine' || 
                            edge.sourceProvenance === 'manual_intake';
      const matchesTime = isVisibleInTime(edge.timestamp);
      const sourceExists = filteredNodes.some((n) => n.id === edge.source);
      const targetExists = filteredNodes.some((n) => n.id === edge.target);
      return matchesConfidence && matchesSource && matchesTime && sourceExists && targetExists;
    });

    const cyNodes = filteredNodes.map((n) => {
      let cleanLabel = transliterate(n.label);
      if (/\.(png|jpg|jpeg|webp|gif|bmp)(?:\?.*)?$/i.test(n.label)) {
        cleanLabel = n.label.split(/[/\\]/).pop()!;
      } else if (n.label.startsWith('http://') || n.label.startsWith('https://')) {
        try {
          const parsed = new URL(n.label);
          cleanLabel = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
        } catch {
          cleanLabel = n.label;
        }
      }
      return {
        data: { id: n.id, label: cleanLabel, type: n.type, confidence: n.confidence },
        selected: n.id === selectedEntityId,
      };
    });
    const cyEdges = filteredEdges.map((e) => ({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        relationType: e.relationType,
        confidence: e.confidence,
        sourceProvenance: e.sourceProvenance,
        highRisk: e.confidence < 0.4 ? 'true' : 'false',
        midRisk:  e.confidence >= 0.4 && e.confidence < 0.7 ? 'true' : 'false',
      },
    }));

    return [...cyNodes, ...cyEdges];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData, confidenceThreshold, selectedSources, timelineMaxTime, selectedEntityId]);

  // Re-run layout when element count changes
  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      const layout = cyRef.current.layout({
        name: 'cola',
        animate: true,
        refresh: 1,
        maxSimulationTime: 1000,
        ungrabifyDuringSim: false,
        fit: true,
        padding: 40,
        nodeSpacing: () => 50,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      layout.run();
    }
  }, [elements.length]);

  // Synchronize visual node selection state in Cytoscape instance
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.nodes().unselect();
      if (selectedEntityId) {
        const selNode = cyRef.current.getElementById(selectedEntityId);
        if (selNode && selNode.length > 0) {
          selNode.select();
        }
      }
    }
  }, [selectedEntityId]);

  // Position the reticle overlay over a node
  const showReticle = (x: number, y: number) => {
    const el = reticleRef.current;
    if (!el) return;
    el.style.left = `${x - 28}px`;
    el.style.top  = `${y - 28}px`;
    el.style.opacity = '1';
    el.style.animation = 'none';
    // Force reflow then restart animation
    void el.offsetWidth;
    el.style.animation = 'reticle-ring 0.6s ease-out forwards';
  };

  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  });

  const showReticleRef = useRef(showReticle);
  useEffect(() => {
    showReticleRef.current = showReticle;
  });

  const setupCytoscape = useCallback((cy: cytoscape.Core) => {
    cyRef.current = cy;

    cy.off('tap', 'node');
    cy.off('mouseover', 'node');
    cy.off('mouseout', 'node');

    // Node click → navigate
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      onSelectNodeRef.current(node.id());
    });

    // Hover → cyan flash + reticle ring
    cy.on('mouseover', 'node', (evt) => {
      const node = evt.target;
      node.addClass('hovered');
      const pos = node.renderedPosition();
      showReticleRef.current(pos.x, pos.y);
    });

    cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('hovered');
    });
  }, []);

  return (
    <div
      style={{
        width: '100%', height: '100%', minHeight: 400,
        background: '#060a0e',
        border: '1px solid var(--struct-line)',
        position: 'relative', overflow: 'hidden', flex: 1,
      }}
    >
      {/* Cyber grid background */}
      <div className="cyber-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Top-left HUD corner brackets */}
      <div style={{
        position: 'absolute', top: 8, left: 8, width: 20, height: 20,
        borderTop: '1px solid var(--accent-primary)', borderLeft: '1px solid var(--accent-primary)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      <div style={{
        position: 'absolute', top: 8, right: 8, width: 20, height: 20,
        borderTop: '1px solid var(--accent-primary)', borderRight: '1px solid var(--accent-primary)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      <div style={{
        position: 'absolute', bottom: 8, left: 8, width: 20, height: 20,
        borderBottom: '1px solid var(--accent-primary)', borderLeft: '1px solid var(--accent-primary)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      <div style={{
        position: 'absolute', bottom: 8, right: 8, width: 20, height: 20,
        borderBottom: '1px solid var(--accent-primary)', borderRight: '1px solid var(--accent-primary)',
        pointerEvents: 'none', zIndex: 2,
      }} />

      {/* Reticle ring overlay (follows hovered node) */}
      <div
        ref={reticleRef}
        style={{
          position: 'absolute', width: 56, height: 56,
          border: '1px solid var(--accent-primary)',
          borderRadius: '50%', pointerEvents: 'none',
          opacity: 0, zIndex: 3,
          boxShadow: '0 0 8px var(--accent-primary)',
        }}
      />

      {/* Graph node count label */}
      <div style={{
        position: 'absolute', top: 10, right: 32,
        fontFamily: 'var(--font-mono)', fontSize: 9,
        color: 'var(--text-muted)', letterSpacing: '0.1em',
        zIndex: 2,
      }}>
        {elements.filter(e => !('source' in e.data)).length} NODES / {elements.filter(e => 'source' in e.data).length} EDGES
      </div>

      {elements.length === 0 ? (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase',
          gap: 8,
        }}>
          <div style={{ width: 32, height: 32, border: '1px solid var(--struct-line)', borderRadius: '50%', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 8, border: '1px solid var(--struct-line)', borderRadius: '50%' }} />
          </div>
          {t('graph.no_elements')}
        </div>
      ) : (
        <CytoscapeComponent
          elements={elements}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          stylesheet={graphStyles}
          cy={setupCytoscape}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          layout={{ name: 'cola' } as any}
        />
      )}

      {/* Timeline Slider Overlay */}
      <TimelineSlider />
    </div>
  );
}
