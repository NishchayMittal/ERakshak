import { apiClient, isMockMode } from './client';
import type { GraphData } from '../types/graph';
import type { ProfileData } from '../types/profile';
import type { TimelineEntry } from '../types/timeline';
import type { CaseSummary, CaseNote } from '../types/case';
import * as mock from './mocks/mockHandlers';

export async function getCaseList(): Promise<CaseSummary[]> {
  if (isMockMode()) return mock.getMockCaseList();
  const res = await apiClient.get('/cases');
  return res.data;
}

export async function getGraph(caseId: string, entityId: string): Promise<GraphData> {
  if (isMockMode()) return mock.getMockGraph(caseId, entityId);
  const res = await apiClient.get(`/cases/${caseId}/entities/${entityId}/graph`);
  return res.data;
}

export async function getProfile(caseId: string, entityId: string): Promise<ProfileData> {
  if (isMockMode()) return mock.getMockProfile(caseId, entityId);
  const res = await apiClient.get(`/cases/${caseId}/entities/${entityId}/profile`);
  return res.data;
}

export async function getTimeline(caseId: string, entityId: string): Promise<TimelineEntry[]> {
  if (isMockMode()) return mock.getMockTimeline(caseId, entityId);
  const res = await apiClient.get(`/cases/${caseId}/entities/${entityId}/timeline`);
  return res.data;
}

export async function submitIdentifiers(caseId: string, identifiers: unknown[]) {
  if (isMockMode()) return mock.submitMockIdentifiers(caseId, identifiers);
  const res = await apiClient.post(`/cases/${caseId}/identifiers`, { identifiers });
  return res.data;
}

export async function getNotes(caseId: string): Promise<CaseNote[]> {
  if (isMockMode()) return mock.getMockNotes(caseId);
  const res = await apiClient.get(`/cases/${caseId}/notes`);
  return res.data;
}

export async function addNote(caseId: string, authorId: string, text: string): Promise<CaseNote> {
  if (isMockMode()) return mock.addMockNote(caseId, authorId, text);
  const res = await apiClient.post(`/cases/${caseId}/notes`, { authorId, text });
  return res.data;
}

export async function getNarrative(caseId: string): Promise<{ narrative: string }> {
  if (isMockMode()) {
    return {
      narrative: `### e-Rakshak Suspect Dossier Intelligence Report (Mock Mode)\n\n**Subject Profile**: Suspect Alpha (Developer Profile)\n**Associated Entities**: suspect@example.com (Email), +919876543210 (Phone), asha.mehta@example.com (Email)\n\n#### 1. Ingest Overview & Intake Summary\nInvestigation was initiated upon receiving seed domain identifiers indicating suspect activities. Dynamic query scanning was deployed to crawl public RDAP WHOIS databases, Certificate Logs, and historical snapshots.\n\n#### 2. Suspect Correlation & Leaks Analysis\nCross-referencing the database against local breach repository archives reveals high-confidence links:\n- Leaked credentials associate username \`suspect_dev\` and email \`suspect@example.com\` to Canva Leak 2024.\n- Historic CDX Wayback snapshots trace active domains registering contact email \`john.doe@example.com\` and matching suspect phone numbers with standard geographic parameters.\n\n#### 3. Face Similarity Match\nGrayscale structural similarity calculations of suspect photo inputs yield **92.5% alignment** to known Developer suspect alpha.`
    };
  }
  const res = await apiClient.get(`/cases/${caseId}/narrative`);
  return res.data;
}