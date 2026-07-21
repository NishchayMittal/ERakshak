import { apiClient, isMockMode } from './client';
import type { GraphData } from '../types/graph';
import type { ProfileData } from '../types/profile';
import type { TimelineEntry } from '../types/timeline';
import type { CaseSummary, CaseNote } from '../types/case';
import type { EvidencePack } from '../types/evidence';
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

export async function createCase(title: string, description?: string): Promise<CaseSummary> {
  if (isMockMode()) {
    const mockCase: CaseSummary = {
      caseId: `case-${Date.now()}`,
      title,
      investigatorId: 'inv-042',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      tags: ['investigation', 'ad-hoc'],
      entityCount: 0
    };
    mock.appendMockCase(mockCase);
    return mockCase;
  }
  const res = await apiClient.post('/cases', { title, description: description || '', status: 'open' });
  return normalizeCaseSummary(res.data);
}

export async function getGraph(caseId: string, entityId: string): Promise<GraphData> {
  if (isMockMode()) return mock.getMockGraph(caseId, entityId);
  try {
    const res = await apiClient.get(`/cases/${caseId}/graph`);
    return res.data || { nodes: [], edges: [] };
  } catch (err) {
    return { nodes: [], edges: [] };
  }
}

export async function getProfile(caseId: string, entityId: string): Promise<ProfileData> {
  if (isMockMode()) return mock.getMockProfile(caseId, entityId);
  const res = await apiClient.get(`/cases/${caseId}/entity/profile?entity_id=${encodeURIComponent(entityId)}`);
  return res.data;
}

export async function getTimeline(caseId: string, entityId: string): Promise<TimelineEntry[]> {
  if (isMockMode()) return mock.getMockTimeline(caseId, entityId);
  const res = await apiClient.get(`/cases/${caseId}/entity/timeline?entity_id=${encodeURIComponent(entityId)}`);
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

export async function getEvidencePack(caseId: string): Promise<EvidencePack> {
  if (isMockMode()) return mock.getMockEvidencePack(caseId);
  try {
    const res = await apiClient.get(`/cases/${caseId}/evidence`);
    return res.data;
  } catch (error) {
    return { caseId, summary: {}, findings: [] } as unknown as EvidencePack;
  }
}

export async function triggerModelRetrain(): Promise<{ message: string }> {
  if (isMockMode()) return mock.triggerMockModelRetrain();
  const res = await apiClient.post('/model/retrain');
  return res.data;
}

export async function updateInvestigatorProfile(fullName?: string, password?: string): Promise<any> {
  if (isMockMode()) return mock.updateMockProfile(fullName || 'Leon Lobo');
  const payload: any = {};
  if (fullName) payload.full_name = fullName;
  if (password) payload.password = password;
  const res = await apiClient.patch('/auth/profile', payload);
  return res.data;
}

export async function renameCase(caseId: string, title: string): Promise<CaseSummary> {
  if (isMockMode()) {
    const updated = await mock.renameMockCase(caseId, title);
    if (!updated) throw new Error('Case not found');
    return updated;
  }
  const res = await apiClient.patch(`/cases/${caseId}`, { title });
  return normalizeCaseSummary(res.data);
}

export async function deleteCase(caseId: string): Promise<void> {
  if (isMockMode()) {
    await mock.deleteMockCase(caseId);
    return;
  }
  await apiClient.delete(`/cases/${caseId}`);
}

let mockPendingApprovals: any[] = [
  { id: 'mock-1', badge_id: 'INV-043', full_name: 'Asha Mehta', created_at: new Date().toISOString() },
  { id: 'mock-2', badge_id: 'INV-044', full_name: 'John Doe', created_at: new Date().toISOString() }
];

export async function loginRequest(badgeId: string, password?: string): Promise<any> {
  if (isMockMode()) {
    const lowerBadge = badgeId.toLowerCase().trim();
    
    // Check if the badge is in the pending approval queue
    const isPending = mockPendingApprovals.some(
      (a) => a.badge_id.toLowerCase().trim() === lowerBadge
    );
    if (isPending) {
      const err: any = new Error("Account pending approval by Lead Investigator.");
      err.response = { data: { detail: "Account pending approval by Lead Investigator." } };
      throw err;
    }

    // Check if badge is recognized
    if (lowerBadge !== 'inv-001' && lowerBadge !== 'leon' && lowerBadge !== 'inv-042') {
      const err: any = new Error("Badge ID is not registered.");
      err.response = { data: { detail: "Badge ID is not registered." } };
      throw err;
    }

    // Validate security passphrase (password)
    if (password !== 'Password123!') {
      const err: any = new Error("Invalid security passphrase.");
      err.response = { data: { detail: "Invalid security passphrase." } };
      throw err;
    }

    return {
      access_token: 'mock-token',
      badge_id: badgeId,
      full_name: badgeId === 'INV-001' || badgeId.toLowerCase().includes('leon') ? 'Leon Lobo' : badgeId
    };
  }
  const params = new URLSearchParams();
  params.append('username', badgeId);
  params.append('password', password || '');
  const res = await apiClient.post('/auth/login', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return res.data;
}

export async function signupRequest(badgeId: string, fullName: string, securityPassphrase?: string): Promise<any> {
  if (isMockMode()) {
    const newMock = { id: `mock-${Date.now()}`, badge_id: badgeId, full_name: fullName, created_at: new Date().toISOString() };
    mockPendingApprovals.push(newMock);
    return newMock;
  }
  const res = await apiClient.post('/auth/signup', {
    badge_id: badgeId,
    full_name: fullName,
    password: securityPassphrase || 'Password123!',
    is_active: true
  });
  return res.data;
}

export async function getPendingApprovals(): Promise<any[]> {
  if (isMockMode()) return mockPendingApprovals;
  const res = await apiClient.get('/auth/pending-approvals');
  return res.data;
}

export async function approveInvestigator(id: string): Promise<any> {
  if (isMockMode()) {
    mockPendingApprovals = mockPendingApprovals.filter(a => a.id !== id);
    return { status: 'approved' };
  }
  const res = await apiClient.post(`/auth/approve/${id}`);
  return res.data;
}

export async function rejectInvestigator(id: string): Promise<any> {
  if (isMockMode()) {
    mockPendingApprovals = mockPendingApprovals.filter(a => a.id !== id);
    return { status: 'rejected' };
  }
  const res = await apiClient.post(`/auth/reject/${id}`);
  return res.data;
}

export async function getAuditLogs(): Promise<any[]> {
  if (isMockMode()) {
    return [
      { id: '1', action: 'investigator.login', timestamp: new Date().toISOString(), detail: { badge_id: 'INV-001' } },
      { id: '2', action: 'case.create', timestamp: new Date().toISOString(), detail: { title: 'OPERATION PEGASUS' } },
      { id: '3', action: 'identifier.resolve', timestamp: new Date().toISOString(), detail: { type: 'domain', value: 'example.com' } },
      { id: '4', action: 'pipeline.completed', timestamp: new Date().toISOString(), detail: { status: 'success' } }
    ];
  }
  const res = await apiClient.get('/auth/audit-logs');
  return res.data;
}

export interface CrossCorrelation {
  normalized_value: string;
  type: string;
  case_count: number;
  cases: Array<{
    case_id: string;
    case_title: string;
    identifier_id: string;
    type: string;
    raw_value: string;
    source: string;
  }>;
}

export interface CrossCorrelationResult {
  correlations: CrossCorrelation[];
  total_shared_identifiers: number;
  cases_analyzed: number;
}

export async function getCrossCorrelations(): Promise<CrossCorrelationResult> {
  if (isMockMode()) {
    return { correlations: [], total_shared_identifiers: 0, cases_analyzed: 0 };
  }
  const res = await apiClient.get('/cases/cross-correlate');
  return res.data;
}