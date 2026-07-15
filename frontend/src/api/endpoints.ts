import { apiClient, isMockMode } from './client';
import type { GraphData } from '../types/graph';
import type { ProfileData } from '../types/profile';
import type { TimelineEntry } from '../types/timeline';
import type { CaseSummary, CaseNote } from '../types/case';
import * as mock from './mocks/mockHandlers';

function normalizeCaseSummary(item: any): CaseSummary {
  return {
    caseId: item.id || item.caseId,
    title: item.title || 'Untitled Case',
    investigatorId: item.leadInvestigatorId || item.investigatorId || 'unknown',
    status: (item.status === 'closed' ? 'closed' : 'active') as CaseSummary['status'],
    createdAt: item.created_at || item.createdAt || new Date().toISOString(),
    lastActivity: item.updated_at || item.lastActivity || item.created_at || item.createdAt || new Date().toISOString(),
    tags: item.tags || [],
    entityCount: item.entityCount || 0,
  };
}

export async function getCaseList(): Promise<CaseSummary[]> {
  if (isMockMode()) return mock.getMockCaseList();
  const res = await apiClient.get('/cases');
  return (res.data || []).map(normalizeCaseSummary);
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

export async function submitLinkFeedback(
  caseId: string,
  payload: { case_id: string; source_id: string; target_id: string; status: 'confirmed' | 'rejected' },
) {
  if (isMockMode()) return { ok: true, payload };
  const res = await apiClient.post(`/cases/${caseId}/feedback`, payload);
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

export async function exportCaseJSON(caseId: string): Promise<Blob> {
  if (isMockMode()) {
    const payload = JSON.stringify({ caseId, exportedAt: new Date().toISOString(), mode: 'mock' }, null, 2);
    return new Blob([payload], { type: 'application/json' });
  }
  const res = await apiClient.get(`/cases/${caseId}/export/json`, { responseType: 'blob' });
  return res.data;
}

export async function exportCaseCSV(caseId: string): Promise<Blob> {
  if (isMockMode()) {
    return new Blob(['caseId,exportedAt\n' + caseId + ',' + new Date().toISOString() + '\n'], { type: 'text/csv;charset=utf-8' });
  }
  const res = await apiClient.get(`/cases/${caseId}/export/csv`, { responseType: 'blob' });
  return res.data;
}

export async function exportCasePDF(caseId: string): Promise<Blob> {
  if (isMockMode()) {
    return new Blob(['mock pdf byte stream'], { type: 'application/pdf' });
  }
  const res = await apiClient.get(`/cases/${caseId}/export/pdf`, { responseType: 'blob' });
  return res.data;
}