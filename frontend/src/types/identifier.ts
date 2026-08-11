export type IdentifierType = 'name' | 'email' | 'username' | 'domain' | 'photo' | 'ip' | 'other';

export interface Identifier {
  id: string;
  type: IdentifierType;
  rawValue: string;
  normalizedValue: string;
  confidence: number;       // 0-1
  source?: string;
  caseId: string;
  investigatorId: string;
  timestamp: string;        // ISO 8601
}