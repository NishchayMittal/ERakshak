import type { IdentifierType } from './identifier';

export interface EvidenceFinding {
  id: string;
  connector: string;
  type: string;
  value: string;
  confidence: number;
  discoveredAt?: string;
  discovered_at?: string;
  rawPayload?: any;
  raw_payload?: any;
}

export interface EvidenceIdentifier {
  id: string;
  type: IdentifierType;
  rawValue?: string;
  raw_value?: string;
  normalizedValue?: string;
  normalized_value?: string;
  confidence: number;
  source: string;
  findings: EvidenceFinding[];
}

export interface EvidencePack {
  case: {
    id: string;
    title: string;
    description?: string;
    status: 'active' | 'closed';
    createdAt: string;
  };
  identifiers: EvidenceIdentifier[];
  notes?: Array<{
    id: string;
    authorId: string;
    text: string;
    createdAt: string;
  }>;
}
