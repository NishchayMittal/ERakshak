import React, {
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useState,
} from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";
import { useGraphStore } from "../../state/graphStore";
import { graphStyles } from "./graphStyles";
import TimelineSlider from "./TimelineSlider";
import { useTranslation } from "react-i18next";
import { useTransliteration } from "../ui/Transliterate";

// Register cytoscape-fcose layout algorithm
try {
  cytoscape.use(fcose);
} catch (e) {
  console.warn("Cytoscape extension registration warning:", e);
}

interface GraphViewProps {
  onSelectNode: (entityId: string) => void;
}

const CLUSTER_PREFIX = "cluster-";

const isVisibleInTime = (
  timestamp: string | undefined,
  timelineMaxTime: number | null,
) => {
  if (!timestamp || timelineMaxTime === null) return true;
  const time = new Date(timestamp).getTime();
  return !isNaN(time) && time <= timelineMaxTime;
};

export default function GraphView({ onSelectNode }: GraphViewProps) {
  const { t } = useTranslation();
  const transliterate = useTransliteration();
  const {
    graphData,
    confidenceThreshold,
    selectedSources,
    timelineMaxTime,
    selectedEntityId,
  } = useGraphStore();
  const cyRef = useRef<cytoscape.Core | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);

  // Visible node/edge counts, kept in sync by the filter effect (compound cluster parents excluded)
  const [visibleCounts, setVisibleCounts] = useState({ nodes: 0, edges: 0 });

  // Build the FULL element set from graphData only. No filter state here —
  // filters are applied afterwards via display toggles, not by rebuilding this array.
  // Nodes are grouped into per-type compound parents so the graph reads as
  // clusters radiating off the seed instead of one undifferentiated ring/halo.
  const elements = useMemo(() => {
    if (!graphData) return [];

    const typesPresent = Array.from(
      new Set(graphData.nodes.map((n) => n.type)),
    );
    const clusterParents = typesPresent.map((type) => ({
      data: { id: `${CLUSTER_PREFIX}${type}`, label: type.toUpperCase() },
    }));

    const cyNodes = graphData.nodes.map((n) => {
      let cleanLabel = transliterate(n.label);
      if (/\.(png|jpg|jpeg|webp|gif|bmp)(?:\?.*)?$/i.test(n.label)) {
        cleanLabel = n.label.split(/[/\\]/).pop()!;
      } else if (
        n.label.startsWith("http://") ||
        n.label.startsWith("https://")
      ) {
        try {
          const parsed = new URL(n.label);
          cleanLabel =
            parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
        } catch {
          cleanLabel = n.label;
        }
      }
      return {
        data: {
          id: n.id,
          label: cleanLabel,
          type: n.type,
          confidence: n.confidence,
          parent: `${CLUSTER_PREFIX}${n.type}`,
        },
      };
    });

    const cyEdges = graphData.edges.map((e) => ({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        relationType: e.relationType,
        confidence: e.confidence,
        sourceProvenance: e.sourceProvenance,
        highRisk: e.confidence < 0.4 ? "true" : "false",
        midRisk: e.confidence >= 0.4 && e.confidence < 0.7 ? "true" : "false",
      },
    }));

    return [...clusterParents, ...cyNodes, ...cyEdges];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]);

  // Re-run layout ONLY when the underlying graph structure changes (nodes/edges added/removed),
  // never on filter/timeline/confidence changes.
  useEffect(() => {
    if (cyRef.current && elements.length > 0) {
      const layout = cyRef.current.layout({
        name: "fcose",
        quality: "default",
        randomize: true,
        animate: true,
        fit: true,
        padding: 40,
        nodeDimensionsIncludeLabels: true,
        nodeRepulsion: () => 6000,
        nodeSeparation: 90,
        packComponents: true,
        idealEdgeLength: (edge: any) => {
          // Higher confidence pulls closer, low confidence is pushed further out —
          // edge length becomes a visual signal, not just aesthetics.
          const c = edge.data("confidence") ?? 0.5;
          return 60 + (1 - c) * 140;
        },
        edgeElasticity: () => 0.45,
        nestingFactor: 0.1,
        gravity: 0.3,
        numIter: 2500,
        tile: true,
      } as any);
      layout.run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);
  // Apply confidence / source / timeline filters by toggling display on existing elements.
  // This is what makes the slider feel like filtering instead of re-simulating the whole graph.
  // Cluster parent nodes are never individually filtered — they're hidden automatically
  // by Cytoscape once all their children are hidden (compound node behavior).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !graphData) return;

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        if (node.id().startsWith(CLUSTER_PREFIX)) return; // skip cluster parents
        const n = graphData.nodes.find((gn) => gn.id === node.id());
        const visible =
          !!n &&
          n.confidence >= confidenceThreshold &&
          isVisibleInTime(n.timestamp, timelineMaxTime);
        node.style("display", visible ? "element" : "none");
      });

      cy.edges().forEach((edge) => {
        const e = graphData.edges.find((ge) => ge.id === edge.id());
        if (!e) {
          edge.style("display", "none");
          return;
        }
        const matchesConfidence = e.confidence >= confidenceThreshold;
        const matchesSource =
          selectedSources.includes(e.sourceProvenance) ||
          e.sourceProvenance === "correlation_engine" ||
          e.sourceProvenance === "manual_intake";
        const matchesTime = isVisibleInTime(e.timestamp, timelineMaxTime);

        const sourceNode = cy.getElementById(e.source);
        const targetNode = cy.getElementById(e.target);
        const endpointsVisible =
          sourceNode.nonempty() &&
          targetNode.nonempty() &&
          sourceNode.style("display") !== "none" &&
          targetNode.style("display") !== "none";

        const visible =
          matchesConfidence && matchesSource && matchesTime && endpointsVisible;
        edge.style("display", visible ? "element" : "none");
      });
    });

    setVisibleCounts({
      nodes: cy
        .nodes()
        .filter(
          (n) =>
            !n.id().startsWith(CLUSTER_PREFIX) && n.style("display") !== "none",
        ).length,
      edges: cy.edges(":visible").length,
    });
  }, [graphData, confidenceThreshold, selectedSources, timelineMaxTime]);

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
    el.style.top = `${y - 28}px`;
    el.style.opacity = "1";
    el.style.animation = "none";
    // Force reflow then restart animation
    void el.offsetWidth;
    el.style.animation = "reticle-ring 0.6s ease-out forwards";
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

    cy.off("tap", "node");
    cy.off("mouseover", "node");
    cy.off("mouseout", "node");

    // Node click → navigate (cluster parents are not clickable entities)
    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      if (node.id().startsWith(CLUSTER_PREFIX)) return;
      onSelectNodeRef.current(node.id());
    });

    // Hover → cyan flash + reticle ring
    cy.on("mouseover", "node", (evt) => {
      const node = evt.target;
      if (node.id().startsWith(CLUSTER_PREFIX)) return;
      node.addClass("hovered");
      const pos = node.renderedPosition();
      showReticleRef.current(pos.x, pos.y);
    });

    cy.on("mouseout", "node", (evt) => {
      evt.target.removeClass("hovered");
    });
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 400,
        background: "#060a0e",
        border: "1px solid var(--struct-line)",
        position: "relative",
        overflow: "hidden",
        flex: 1,
      }}
    >
      {/* Cyber grid background */}
      <div
        className="cyber-grid"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      {/* Top-left HUD corner brackets */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          width: 20,
          height: 20,
          borderTop: "1px solid var(--accent-primary)",
          borderLeft: "1px solid var(--accent-primary)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 20,
          height: 20,
          borderTop: "1px solid var(--accent-primary)",
          borderRight: "1px solid var(--accent-primary)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          width: 20,
          height: 20,
          borderBottom: "1px solid var(--accent-primary)",
          borderLeft: "1px solid var(--accent-primary)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          width: 20,
          height: 20,
          borderBottom: "1px solid var(--accent-primary)",
          borderRight: "1px solid var(--accent-primary)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Reticle ring overlay (follows hovered node) */}
      <div
        ref={reticleRef}
        style={{
          position: "absolute",
          width: 56,
          height: 56,
          border: "1px solid var(--accent-primary)",
          borderRadius: "50%",
          pointerEvents: "none",
          opacity: 0,
          zIndex: 3,
          boxShadow: "0 0 8px var(--accent-primary)",
        }}
      />

      {/* Graph node count label — reflects currently VISIBLE real (non-cluster) elements after filtering */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 32,
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-muted)",
          letterSpacing: "0.1em",
          zIndex: 2,
        }}
      >
        {visibleCounts.nodes} NODES / {visibleCounts.edges} EDGES
      </div>

      {elements.length === 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: "1px solid var(--struct-line)",
              borderRadius: "50%",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 8,
                border: "1px solid var(--struct-line)",
                borderRadius: "50%",
              }}
            />
          </div>
          {t("graph.no_elements")}
        </div>
      ) : (
        <CytoscapeComponent
          elements={elements}
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
          stylesheet={graphStyles}
          cy={setupCytoscape}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          layout={{ name: "fcose" } as any}
        />
      )}

      {/* Timeline Slider Overlay */}
      <TimelineSlider />
    </div>
  );
}
