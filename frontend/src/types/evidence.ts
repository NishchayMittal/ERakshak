import type { IdentifierType } from './identifier';

export interface EvidenceFinding {
  id: string;
  connector: string;
  type: string;
  value: string;
  confidence: number;
  discoveredAt?: string;
  rawPayload?: any;
}

export interface EvidenceIdentifier {
  id: string;
  type: IdentifierType;
  rawValue: string;
  normalizedValue: string;
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
