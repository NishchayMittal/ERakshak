// Cytoscape styles for the e-RAKSHAK black-ops forensics theme
// Node shapes: rectangle=org, diamond=domain, ellipse=person, triangle=flagged
export const graphStyles: any[] = [
  // ── Base node defaults ──
  {
    selector: 'node',
    style: {
      width: 38,
      height: 38,
      label: 'data(label)',
      color: '#E6EDF3',
      'font-family': 'JetBrains Mono, monospace',
      'font-size': '9px',
      'letter-spacing': '0.03em',
      'text-valign': 'bottom',
      'text-margin-y': 7,
      'background-color': '#0D1117',
      'border-width': 1.5,
      'border-color': '#2A3038',
      'text-background-color': '#080c10',
      'text-background-opacity': 0.85,
      'text-background-shape': 'rectangle',
      'text-background-padding': '2px',
      'transition-property': 'background-color, border-color, border-width, width, height',
      'transition-duration': 0.1,
    },
  },

  // ── Entity types ──
  {
    selector: 'node[type="email"]',
    style: {
      shape: 'ellipse',
      'border-color': '#00FFC2',
      'border-width': 1.5,
      'background-color': '#001f18',
    },
  },
  {
    selector: 'node[type="username"]',
    style: {
      shape: 'ellipse',
      'border-color': '#00E5FF',
      'border-width': 1.5,
      'background-color': '#001a1f',
    },
  },
  {
    selector: 'node[type="domain"]',
    style: {
      shape: 'diamond',
      width: 44,
      height: 44,
      'border-color': '#00FFC2',
      'border-width': 1.5,
      'background-color': '#001a0f',
    },
  },
  {
    selector: 'node[type="phone"]',
    style: {
      shape: 'pentagon',
      'border-color': '#FFB800',
      'border-width': 1.5,
      'background-color': '#1a1200',
    },
  },
  {
    selector: 'node[type="wallet"]',
    style: {
      shape: 'hexagon',
      width: 40,
      height: 40,
      'border-color': '#FFB800',
      'border-width': 1.5,
      'background-color': '#130e00',
    },
  },
  {
    selector: 'node[type="person"]',
    style: {
      shape: 'ellipse',
      width: 42,
      height: 42,
      'border-color': '#00FFC2',
      'border-width': 2,
      'background-color': '#001e14',
    },
  },
  {
    selector: 'node[type="org"]',
    style: {
      shape: 'rectangle',
      width: 42,
      height: 38,
      'border-color': '#00FFC2',
      'border-width': 1.5,
      'background-color': '#001a10',
    },
  },
  // Flagged / high-risk nodes → triangle warning shape + red
  {
    selector: 'node[flagged="true"]',
    style: {
      shape: 'triangle',
      width: 44,
      height: 44,
      'background-color': '#300010',
      'border-color': '#FF0044',
      'border-width': 2,
      color: '#FF0044',
    },
  },

  // ── Selected state ──
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': '#00FFC2',
      'background-color': '#002e22',
      width: 48,
      height: 48,
      'box-shadow': '0 0 12px #00FFC2',
    },
  },

  // ── Hover state (animated via JS event, but pre-style) ──
  {
    selector: 'node.hovered',
    style: {
      'border-width': 2.5,
      'border-color': '#00FFC2',
      'background-color': '#002a1e',
    },
  },

  // ── Base edge ──
  {
    selector: 'edge',
    style: {
      width: 1,
      'line-color': '#00FFC2',
      'target-arrow-shape': 'chevron',
      'target-arrow-color': '#00FFC2',
      'curve-style': 'bezier',
      label: 'data(relationType)',
      'font-size': '7px',
      'font-family': 'JetBrains Mono, monospace',
      color: '#6E7681',
      'text-rotation': 'autorotate',
      'text-margin-y': -7,
      'text-background-color': '#080c10',
      'text-background-opacity': 0.7,
      'text-background-shape': 'rectangle',
      'text-background-padding': '1px',
      'line-style': 'solid',
      opacity: 0.6,
      'transition-property': 'line-color, width, opacity',
      'transition-duration': 0.1,
    },
  },

  // ── High-risk edges (confidence < 0.5 or explicitly flagged) ──
  {
    selector: 'edge[highRisk="true"]',
    style: {
      'line-color': '#FF0044',
      'target-arrow-color': '#FF0044',
      width: 2,
      opacity: 0.85,
    },
  },

  // ── Medium-risk / unverified edges ──
  {
    selector: 'edge[midRisk="true"]',
    style: {
      'line-color': '#FFB800',
      'target-arrow-color': '#FFB800',
      width: 1.5,
      opacity: 0.75,
    },
  },

  // ── Selected edge ──
  {
    selector: 'edge:selected',
    style: {
      width: 3,
      'line-color': '#00FFC2',
      'target-arrow-color': '#00FFC2',
      opacity: 1,
      color: '#E6EDF3',
    },
  },
];
