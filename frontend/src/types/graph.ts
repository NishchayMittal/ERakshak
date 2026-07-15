export interface GraphNode {
  id: string;
  label: string;
  type: 'person' | 'email' | 'username' | 'phone' | 'domain' | 'wallet';
  confidence: number;
  sourceCount: number;
  pivot?: boolean;
  expandInvestigation?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  confidence: number;
  sourceProvenance: string;
  matchType?: 'baseline' | 'xgboost' | 'confirmed' | 'rejected';
  shapFeatures?: Record<string, number>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}