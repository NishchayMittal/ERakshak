// Cytoscape styles mapping to fit our cyber-security investigation theme
export const graphStyles: any[] = [
  {
    selector: 'node',
    style: {
      'width': 38,
      'height': 38,
      'label': 'data(label)',
      'color': '#e2e8f0',
      'font-size': '10px',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      'background-color': '#475569',
      'border-width': 2,
      'border-color': '#1e293b',
      'text-background-color': '#0f172a',
      'text-background-opacity': 0.75,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '3px',
      'transition-property': 'background-color, border-color, width, height',
      'transition-duration': 0.2,
    },
  },
  {
    selector: 'node[type="email"]',
    style: {
      'background-color': '#6366f1',
      'border-color': '#4f46e5',
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
      'border-width': 4,
      'border-color': '#fde68a',
      'width': 46,
      'height': 46,
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
      'width': 'mapData(confidence, 0, 1, 1.5, 4)',
      'line-color': '#334155',
      'target-arrow-shape': 'chevron',
      'target-arrow-color': '#334155',
      'curve-style': 'bezier',
      'label': 'data(relationType)',
      'font-size': '8px',
      'color': '#94a3b8',
      'text-rotation': 'autorotate',
      'text-margin-y': -8,
      'text-background-color': '#0f172a',
      'text-background-opacity': 0.75,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '2px',
      'line-style': 'solid',
      'opacity': 'mapData(confidence, 0, 1, 0.3, 1)',
    },
  },
  {
    selector: 'edge[data(matchType) = "confirmed"]',
    style: {
      'line-color': '#34d399',
      'target-arrow-color': '#34d399',
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
      'width': 4,
      'line-color': '#6366f1',
      'target-arrow-color': '#6366f1',
      'color': '#ffffff',
    },
  },
];
