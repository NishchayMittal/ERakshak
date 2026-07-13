// Cytoscape styles mapping to fit our cyber-security investigation theme
export const graphStyles: any[] = [
  {
    selector: 'node',
    style: {
      'width': 38,
      'height': 38,
      'label': 'data(label)',
      'color': '#e2e8f0', // slate-200
      'font-size': '10px',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      'background-color': '#475569', // slate-600 (default)
      'border-width': 2,
      'border-color': '#1e293b', // slate-800
      'text-background-color': '#0f172a', // slate-900 background for readability
      'text-background-opacity': 0.75,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '3px',
      'transition-property': 'background-color, border-color, width, height',
      'transition-duration': 0.2,
    }
  },
  // Color code nodes by entity type
  {
    selector: 'node[type="email"]',
    style: {
      'background-color': '#6366f1', // indigo-500
      'border-color': '#4f46e5',
    }
  },
  {
    selector: 'node[type="username"]',
    style: {
      'background-color': '#06b6d4', // cyan-500
      'border-color': '#0891b2',
    }
  },
  {
    selector: 'node[type="domain"]',
    style: {
      'background-color': '#a855f7', // purple-500
      'border-color': '#9333ea',
    }
  },
  {
    selector: 'node[type="phone"]',
    style: {
      'background-color': '#10b981', // emerald-500
      'border-color': '#059669',
    }
  },
  {
    selector: 'node[type="wallet"]',
    style: {
      'background-color': '#f59e0b', // amber-500
      'border-color': '#d97706',
    }
  },
  {
    selector: 'node[type="person"]',
    style: {
      'background-color': '#ef4444', // red-500
      'border-color': '#dc2626',
    }
  },
  // Selected state
  {
    selector: 'node:selected',
    style: {
      'border-width': 4,
      'border-color': '#ffffff',
      'width': 44,
      'height': 44,
    }
  },
  
  // Edge Styles
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#334155', // slate-700
      'target-arrow-shape': 'chevron',
      'target-arrow-color': '#334155',
      'curve-style': 'bezier',
      'label': 'data(relationType)',
      'font-size': '8px',
      'color': '#94a3b8', // slate-400
      'text-rotation': 'autorotate',
      'text-margin-y': -8,
      'text-background-color': '#0f172a',
      'text-background-opacity': 0.75,
      'text-background-shape': 'roundrectangle',
      'text-background-padding': '2px',
      'line-style': 'solid',
      'opacity': 'data(confidence)', // scale edge opacity based on confidence
    }
  },
  {
    selector: 'edge:selected',
    style: {
      'width': 4,
      'line-color': '#6366f1',
      'target-arrow-color': '#6366f1',
      'color': '#ffffff',
    }
  }
];
