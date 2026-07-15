import React, { useEffect, useMemo, useRef, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape from 'cytoscape';
import cola from 'cytoscape-cola';
import { useGraphStore } from '../../state/graphStore';
import { useUIStore } from '../../state/uiStore';
import { submitLinkFeedback } from '../../api/endpoints';
import type { GraphEdge } from '../../types/graph';
import { graphStyles } from './graphStyles';

// Register cytoscape-cola layout algorithm
try {
  cytoscape.use(cola);
} catch (e) {
  console.warn('Cytoscape extension registration warning:', e);
}

interface GraphViewProps {
  caseId?: string;
  onSelectNode: (entityId: string) => void;
}

export default function GraphView({ caseId, onSelectNode }: GraphViewProps) {
  const { graphData, confidenceThreshold, selectedSources } = useGraphStore();
  const { showToast } = useUIStore();
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const elements = useMemo(() => {
    if (!graphData) return [];

    const filteredNodes = graphData.nodes.filter((node) => node.confidence >= confidenceThreshold);

    const filteredEdges = graphData.edges.filter((edge) => {
      const matchesConfidence = edge.confidence >= confidenceThreshold;
      const matchesSource = selectedSources.includes(edge.sourceProvenance);
      const sourceExists = filteredNodes.some((n) => n.id === edge.source);
      const targetExists = filteredNodes.some((n) => n.id === edge.target);
      return matchesConfidence && matchesSource && sourceExists && targetExists;
    });

    const cyNodes = filteredNodes.map((n) => ({
      data: {
        id: n.id,
        label: n.label,
        type: n.type,
        confidence: n.confidence,
        pivot: n.pivot,
        expandInvestigation: n.expandInvestigation,
      },
    }));

    const cyEdges = filteredEdges.map((e) => ({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        relationType: e.relationType,
        confidence: e.confidence,
        sourceProvenance: e.sourceProvenance,
        matchType: e.matchType,
        shapFeatures: e.shapFeatures,
      },
    }));

    return [...cyNodes, ...cyEdges];
  }, [graphData, confidenceThreshold, selectedSources]);

  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      const layout = cyRef.current.layout({
        name: 'cola',
        animate: true,
        refresh: 1,
        maxSimulationTime: 1500,
        ungrabifyDuringSim: false,
        fit: true,
        padding: 45,
        nodeSpacing: () => 55,
        flow: { axis: 'y', minSeparation: 60 },
      } as any);

      layout.run();
    }
  }, [elements.length]);

  const setupCytoscape = (cy: cytoscape.Core) => {
    cyRef.current = cy;

    cy.off('tap', 'node');
    cy.off('tap', 'edge');
    cy.off('tap');

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      setSelectedEdge(null);
      onSelectNode(node.id());
    });

    cy.on('tap', 'edge', (evt) => {
      const edge = evt.target;
      const edgeData = edge.data();
      setSelectedEdge({
        id: edgeData.id,
        source: edgeData.source,
        target: edgeData.target,
        relationType: edgeData.relationType,
        confidence: Number(edgeData.confidence ?? 0),
        sourceProvenance: edgeData.sourceProvenance ?? 'unknown',
        matchType: edgeData.matchType,
        shapFeatures: edgeData.shapFeatures,
      });
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedEdge(null);
      }
    });

    cy.fit();
  };

  const handleFeedback = async (status: 'confirmed' | 'rejected') => {
    if (!caseId || !selectedEdge) return;

    setSubmittingFeedback(true);
    try {
      await submitLinkFeedback(caseId, {
        case_id: caseId,
        source_id: selectedEdge.source,
        target_id: selectedEdge.target,
        status,
      });
      setSelectedEdge((current) => (current ? { ...current, matchType: status === 'confirmed' ? 'confirmed' : 'rejected' } : current));
      showToast(status === 'confirmed' ? 'Link confirmed' : 'Link rejected', 'success');
    } catch (error) {
      console.error('Failed to submit link feedback:', error);
      showToast('Unable to save link feedback right now', 'error');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="w-full h-full min-h-[420px] relative overflow-hidden flex-1">
      <div className="absolute inset-0 animated-sky grid-fade pointer-events-none"></div>
      <div className="absolute right-0 top-0 pointer-events-none">
        <div className="orb" style={{ '--orb-size': '220px' } as React.CSSProperties} />
      </div>
      <div className="relative w-full h-full p-4 card-soft border border-slate-800/40 rounded-lg glow-shadow">
        <div className="absolute inset-0 cyber-grid opacity-35 pointer-events-none rounded-lg"></div>

      {selectedEdge && (
        <div className="absolute right-3 top-3 z-10 w-72 max-w-[calc(100%-1.5rem)] rounded-lg border border-slate-800 bg-slate-900/95 p-3 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Edge detail</p>
              <h3 className="text-sm font-semibold text-slate-100">{selectedEdge.relationType}</h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedEdge(null)}
              className="text-xs text-slate-400 hover:text-slate-100"
            >
              Close
            </button>
          </div>

          <div className="mt-3 space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between rounded bg-slate-800/70 px-2 py-1.5">
              <span className="text-slate-500">Confidence</span>
              <span className="font-medium text-slate-100">{selectedEdge.confidence.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-slate-800/70 px-2 py-1.5">
              <span className="text-slate-500">Match type</span>
              <span className="font-medium text-slate-100">{selectedEdge.matchType ?? 'baseline'}</span>
            </div>
            <div className="flex items-center justify-between rounded bg-slate-800/70 px-2 py-1.5">
              <span className="text-slate-500">Source</span>
              <span className="font-medium text-slate-100">{selectedEdge.sourceProvenance}</span>
            </div>
          </div>

          <div className="mt-3 rounded bg-slate-800/50 p-2">
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500">Explainability</p>
            {selectedEdge.shapFeatures && Object.keys(selectedEdge.shapFeatures).length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {Object.entries(selectedEdge.shapFeatures).slice(0, 3).map(([feature, value]) => (
                  <li key={feature} className="flex items-center justify-between">
                    <span>{feature}</span>
                    <span className="font-medium text-slate-100">{value.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No SHAP explanation available yet for this edge.</p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleFeedback('confirmed')}
              disabled={submittingFeedback}
              className="flex-1 rounded bg-emerald-600/90 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingFeedback ? 'Saving...' : 'Confirm Link'}
            </button>
            <button
              type="button"
              onClick={() => void handleFeedback('rejected')}
              disabled={submittingFeedback}
              className="flex-1 rounded bg-rose-600/90 px-2.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reject Link
            </button>
          </div>
        </div>
      )}

        {elements.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-slate-400 text-sm leading-6">
            No elements match the active filters. Lower the confidence threshold or enable more source channels to inspect the graph.
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
    </div>
  );
}
