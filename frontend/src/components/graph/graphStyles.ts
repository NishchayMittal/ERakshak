// Cytoscape styles mapping to fit our cyber-security investigation theme
// Neon / cyberpunk visual theme for graph elements
export const graphStyles: any[] = [
  {
    selector: 'node',
    style: {
      'width': 44,
      'height': 44,
      'label': 'data(label)',
      'color': '#e6eef8',
      'font-size': '11px',
      'text-valign': 'bottom',
      'text-margin-y': 8,
      'background-color': '#071029',
      'border-width': 2,
      'border-color': '#071427',
      'text-background-color': 'rgba(6,8,15,0.7)',
      'text-background-opacity': 0.9,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '4px',
      'transition-property': 'background-color, border-color, width, height, opacity',
      'transition-duration': 200,
    },
  },
  {
    selector: 'node[type="email"]',
    style: {
      'background-color': '#7c3aed',
      'border-color': '#a78bfa',
    },
  },
  {
    selector: 'node[type="username"]',
    style: {
      'background-color': '#06b6d4',
      'border-color': '#0891b2',
    },
  },
  {
    selector: 'node[type="domain"]',
    style: {
      'background-color': '#a855f7',
      'border-color': '#9333ea',
    },
  },
  {
    selector: 'node[type="phone"]',
    style: {
      'background-color': '#10b981',
      'border-color': '#059669',
    },
  },
  {
    selector: 'node[type="wallet"]',
    style: {
      'background-color': '#f59e0b',
      'border-color': '#d97706',
    },
  },
  {
    selector: 'node[type="person"]',
    style: {
      'background-color': '#ef4444',
      'border-color': '#dc2626',
    },
  },
  {
    selector: 'node[data(pivot) = "true"]',
    style: {
      'border-width': 5,
      'border-color': '#fef08a',
      'width': 56,
      'height': 56,
      'shadow-blur': 24,
      'shadow-color': '#fef08a',
    },
  },
  {
    selector: 'node:selected',
    style: {
      'border-width': 4,
      'border-color': '#ffffff',
      'width': 44,
      'height': 44,
    },
  },
  {
    selector: 'edge',
    style: {
      'width': 'mapData(confidence, 0, 1, 1.8, 5)',
      'line-color': '#0f172a',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#0f172a',
      'curve-style': 'bezier',
      'label': 'data(relationType)',
      'font-size': '9px',
      'color': '#cbd5e1',
      'text-rotation': 'autorotate',
      'text-margin-y': -10,
      'text-background-color': 'rgba(6,8,15,0.7)',
      'text-background-opacity': 0.9,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '3px',
      'line-style': 'dashed',
      'opacity': 'mapData(confidence, 0, 1, 0.2, 1)',
      'z-index': 0,
    },
  },
  {
    selector: 'edge[data(matchType) = "confirmed"]',
    style: {
      'line-color': '#10b981',
      'target-arrow-color': '#10b981',
      'line-style': 'solid',
      'shadow-blur': 10,
      'shadow-color': '#10b981',
    },
  },
  {
    selector: 'edge[data(matchType) = "xgboost"]',
    style: {
      'line-color': '#38bdf8',
      'target-arrow-color': '#38bdf8',
    },
  },
  {
    selector: 'edge:selected',
    style: {
      'width': 6,
      'line-color': '#7c3aed',
      'target-arrow-color': '#7c3aed',
      'color': '#ffffff',
      'z-index': 9999,
      'shadow-blur': 18,
      'shadow-color': '#7c3aed',
    },
  },
];
