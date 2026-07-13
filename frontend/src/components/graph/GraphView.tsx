import React, { useEffect, useRef, useMemo } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import { useGraphStore } from '../../state/graphStore';
import { graphStyles } from './graphStyles';

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
  const { graphData, confidenceThreshold, selectedSources } = useGraphStore();
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Compute filtered elements for Cytoscape to avoid orphaned edges crashes
  const elements = useMemo(() => {
    if (!graphData) return [];

    // Filter nodes by confidence
    const filteredNodes = graphData.nodes.filter(
      (node) => node.confidence >= confidenceThreshold
    );

    // Filter edges by confidence, source check, and ensure both ends exist
    const filteredEdges = graphData.edges.filter((edge) => {
      const matchesConfidence = edge.confidence >= confidenceThreshold;
      const matchesSource = selectedSources.includes(edge.sourceProvenance);
      const sourceExists = filteredNodes.some((n) => n.id === edge.source);
      const targetExists = filteredNodes.some((n) => n.id === edge.target);
      return matchesConfidence && matchesSource && sourceExists && targetExists;
    });

    // Format elements for react-cytoscapejs
    const cyNodes = filteredNodes.map((n) => ({
      data: { id: n.id, label: n.label, type: n.type, confidence: n.confidence }
    }));
    
    const cyEdges = filteredEdges.map((e) => ({
      data: { 
        id: e.id, 
        source: e.source, 
        target: e.target, 
        relationType: e.relationType,
        confidence: e.confidence,
        sourceProvenance: e.sourceProvenance 
      }
    }));

    return [...cyNodes, ...cyEdges];
  }, [graphData, confidenceThreshold, selectedSources]);

  // Redraw layout when elements count changes
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
      } as any);
      
      layout.run();
    }
  }, [elements.length]);

  // Setup click listeners
  const setupCytoscape = (cy: cytoscape.Core) => {
    cyRef.current = cy;
    
    // Clear old event listeners
    cy.off('tap', 'node');
    
    // Node tap listener
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      onSelectNode(node.id());
    });

    // Fit canvas on load
    cy.fit();
  };

  // Safe sizing for container
  return (
    <div className="w-full h-full min-h-[400px] bg-slate-950 border border-slate-900 rounded-lg relative overflow-hidden flex-1 glow-shadow">
      {/* Background Grid Accent */}
      <div className="absolute inset-0 cyber-grid opacity-75 pointer-events-none"></div>

      {elements.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">
          No elements match active filtering. Lower threshold or enable sources.
        </div>
      ) : (
        <CytoscapeComponent
          elements={elements}
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
          stylesheet={graphStyles}
          cy={setupCytoscape}
          layout={{ name: 'cola' } as any}
        />
      )}
    </div>
  );
}
