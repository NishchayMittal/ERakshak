export interface GraphNode {
  id: string;
  label: string;
  type: 'person' | 'email' | 'username' | 'phone' | 'domain' | 'wallet';
  confidence: number;
  sourceCount: number;
}

export interface GraphEdge {
  id: string;
  source: string;           // node id
  target: string;           // node id
  relationType: string;     // e.g. "registered_by", "used_on", "co-occurs_with"
  confidence: number;
  sourceProvenance: string; // e.g. "crt.sh", "whois", "sherlock"
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}