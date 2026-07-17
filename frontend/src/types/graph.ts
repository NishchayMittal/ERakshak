export interface GraphNode {
  id: string;
  label: string;
  type: 'person' | 'email' | 'username' | 'phone' | 'domain' | 'wallet';
  confidence: number;
  sourceCount: number;
  pivot?: boolean;
  expandInvestigation?: boolean;
  timestamp?: string;
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
  timestamp?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}