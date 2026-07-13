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