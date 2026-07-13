export interface ProfileAttribute {
  key: string;              // e.g. "registrant_email"
  value: string;
  source: string;           // provenance — required, not optional, for evidentiary quality
  confidence: number;
  discoveredAt: string;
}

export interface ProfileData {
  entityId: string;
  displayName: string;
  attributes: ProfileAttribute[];
}