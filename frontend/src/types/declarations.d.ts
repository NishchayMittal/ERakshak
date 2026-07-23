declare module 'react-cytoscapejs' {
  import { ComponentType } from 'react';
  const CytoscapeComponent: ComponentType<Record<string, unknown>>;
  export default CytoscapeComponent;
}

declare module 'cytoscape-cola' {
  const cola: (cytoscape: unknown) => void;
  export default cola;
}
