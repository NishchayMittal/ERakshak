export type CaseStatus = 'active' | 'closed';

export interface CaseSummary {
  caseId: string;
  title: string;
  investigatorId: string;
  status: CaseStatus;
  createdAt: string;
  lastActivity: string;
  tags: string[];
  entityCount: number;
}

export interface CaseNote {
  id: string;
  caseId: string;
  authorId: string;
  text: string;
  createdAt: string;
}