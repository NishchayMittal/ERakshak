import { apiClient, isMockMode } from './client';
import type { GraphData } from '../types/graph';
import type { ProfileData } from '../types/profile';
import type { TimelineEntry } from '../types/timeline';
import type { CaseSummary, CaseNote } from '../types/case';
import type { EvidencePack } from '../types/evidence';
import * as mock from './mocks/mockHandlers';

function normalizeCaseSummary(item: Record<string, unknown>): CaseSummary {
  return {
    caseId: (item.id || item.caseId) as string,
    title: (item.title || 'Untitled Case') as string,
    investigatorId: (item.leadInvestigatorId || item.investigatorId || 'unknown') as string,
    status: (item.status === 'closed' ? 'closed' : 'active') as CaseSummary['status'],
    createdAt: (item.created_at || item.createdAt || new Date().toISOString()) as string,
    lastActivity: (item.updated_at || item.lastActivity || item.created_at || item.createdAt || new Date().toISOString()) as string,
    tags: (item.tags || []) as string[],
    entityCount: (item.entityCount || 0) as number,
    is_watched: (item.is_watched || false) as boolean,
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
  } catch {
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

import type { EvidenceIdentifier } from '../types/evidence';

export async function getIdentifiers(caseId: string): Promise<EvidenceIdentifier[]> {
  if (isMockMode()) {
    // Return mock identifiers based on pending seeds?
    // In mock mode, we don't have an endpoint for this currently, just returning empty.
    return [];
  }
  const res = await apiClient.get(`/cases/${caseId}/identifiers`);
  return res.data;
}

export async function deleteIdentifier(caseId: string, identifierId: string): Promise<void> {
  if (isMockMode()) return;
  await apiClient.delete(`/cases/${caseId}/identifiers/${identifierId}`);
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

export async function chatWithEvidence(caseId: string, question: string): Promise<{ answer: string; question: string; case_id: string }> {
  if (isMockMode()) {
    return {
      answer: `I'm an AI assistant for the e-Rakshak OSINT platform. In mock mode, I can help you understand how to interact with your evidence. Your question was: "${question}".\n\nIn a real deployment, I would analyze your evidence pack (which includes case details, identifiers, findings from OSINT connectors, and relationship maps) to provide detailed, evidence-based answers to investigative questions like:\n- "Who is linked to this domain?"\n- "What email addresses were found associated with this suspect?"\n- "Show me all social media profiles discovered"\n- "What breach data was found for this email?"\n- "What IP addresses are connected to this domain?"\n\nTo get real AI-powered insights, please ensure the backend is running with a valid GROQ_API_KEY configured.`,
      question: question,
      case_id: caseId
    };
  }
  const res = await apiClient.post(`/cases/${caseId}/chat`, { question });
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
  } catch {
    return { caseId, summary: {}, findings: [] } as unknown as EvidencePack;
  }
}

export async function triggerModelRetrain(): Promise<{ message: string }> {
  if (isMockMode()) return mock.triggerMockModelRetrain();
  const res = await apiClient.post('/model/retrain');
  return res.data;
}

export async function updateInvestigatorProfile(fullName?: string, password?: string): Promise<unknown> {
  if (isMockMode()) return mock.updateMockProfile(fullName || 'Leon Lobo');
  const payload: Record<string, unknown> = {};
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

let mockPendingApprovals: Array<Record<string, string>> = [
  { id: 'mock-1', badge_id: 'INV-043', full_name: 'Asha Mehta', created_at: new Date().toISOString() },
  { id: 'mock-2', badge_id: 'INV-044', full_name: 'John Doe', created_at: new Date().toISOString() }
];

interface LoginError extends Error {
  response?: {
    data: {
      detail: string;
    };
  };
}

export async function loginRequest(badgeId: string, password?: string): Promise<unknown> {
  if (isMockMode()) {
    const lowerBadge = badgeId.toLowerCase().trim();
    
    // Check if the badge is in the pending approval queue
    const isPending = mockPendingApprovals.some(
      (a) => a.badge_id.toLowerCase().trim() === lowerBadge
    );
    if (isPending) {
      const err = new Error("Account pending approval by Lead Investigator.") as LoginError;
      err.response = { data: { detail: "Account pending approval by Lead Investigator." } };
      throw err;
    }

    // Check if badge is recognized
    if (lowerBadge !== 'inv-001' && lowerBadge !== 'leon' && lowerBadge !== 'inv-042') {
      const err = new Error("Badge ID is not registered.") as LoginError;
      err.response = { data: { detail: "Badge ID is not registered." } };
      throw err;
    }

    // Validate security passphrase (password)
    if (password !== 'Password123!') {
      const err = new Error("Invalid security passphrase.") as LoginError;
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

export async function signupRequest(badgeId: string, fullName: string, securityPassphrase?: string): Promise<unknown> {
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

export async function getPendingApprovals(): Promise<unknown[]> {
  if (isMockMode()) return mockPendingApprovals;
  const res = await apiClient.get('/auth/pending-approvals');
  return res.data;
}

export async function approveInvestigator(id: string): Promise<unknown> {
  if (isMockMode()) {
    mockPendingApprovals = mockPendingApprovals.filter(a => a.id !== id);
    return { status: 'approved' };
  }
  const res = await apiClient.post(`/auth/approve/${id}`);
  return res.data;
}

export async function rejectInvestigator(id: string): Promise<unknown> {
  if (isMockMode()) {
    mockPendingApprovals = mockPendingApprovals.filter(a => a.id !== id);
    return { status: 'rejected' };
  }
  const res = await apiClient.post(`/auth/reject/${id}`);
  return res.data;
}

export async function getAuditLogs(): Promise<unknown[]> {
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

export interface FootprintEvent {
  source: string;
  type: string;
  title: string;
  value: string;
  timestamp_utc: string;
  node_id?: string;
}

export interface TemporalAnalysisResult {
  case_id: string;
  total_observations: number;
  heatmap_utc: number[][];
  inferred_timezone: string;
  utc_offset_hours: number;
  sleep_window_local: string;
  peak_hours_local: string;
  night_owl_percentage: number;
  weekend_ratio: number;
  tradecraft_summary: string;
  sources_breakdown?: {
    identifiers: number;
    findings: number;
    notes: number;
    audits: number;
  };
  cell_details_utc?: Record<string, FootprintEvent[]>;
}

export async function getTemporalAnalysis(caseId: string): Promise<TemporalAnalysisResult> {
  if (isMockMode()) {
    const mockGrid = [
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,6,9,7,4,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,2,8,12,10,5,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,11,14,8,3,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,4,9,13,11,6,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,10,8,4,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,5,7,3,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,4,2,0,0],
    ];
    return {
      case_id: caseId,
      total_observations: 184,
      heatmap_utc: mockGrid,
      inferred_timezone: "UTC+05:30 (Asia/Kolkata)",
      utc_offset_hours: 5.5,
      sleep_window_local: "01:00 - 07:00 Local",
      peak_hours_local: "19:00, 20:00, 21:00",
      night_owl_percentage: 28.4,
      weekend_ratio: 0.12,
      tradecraft_summary: "Temporal analysis indicates suspect operational activity aligned with UTC+05:30. Inferred sleep window is 01:00 - 07:00 Local with peak activity concentrated in evening hours.",
      sources_breakdown: {
        identifiers: 12,
        findings: 142,
        notes: 8,
        audits: 22
      }
    };
  }
  const res = await apiClient.get(`/cases/${caseId}/temporal-analysis`);
  return res.data;
}

export interface GeoNode {
  id: string;
  lat: number;
  lng: number;
  label: string;
  source: string;
}

export interface GeoArc {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  label: string;
}

export interface GeoIntelligenceResult {
  nodes: GeoNode[];
  arcs: GeoArc[];
}

export async function getGeoIntelligence(caseId: string): Promise<GeoIntelligenceResult> {
  if (isMockMode()) {
    return { nodes: [], arcs: [] };
  }
  const res = await apiClient.get(`/cases/${caseId}/geo`);
  return res.data;
}

export async function uploadImage(file: File): Promise<{ filepath: string; filename: string }> {
  if (isMockMode()) {
    return { filepath: "backend/app/resources/suspects/suspect_alpha.png", filename: file.name };
  }
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/identifiers/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

// ─── Watchlist & Alerts ───

export interface AlertItem {
  id: string;
  case_id: string;
  investigator_id: string;
  alert_type: string;
  title: string;
  detail: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export async function toggleCaseWatch(caseId: string): Promise<{ case_id: string; is_watched: boolean }> {
  if (isMockMode()) return { case_id: caseId, is_watched: true };
  const res = await apiClient.patch(`/cases/${caseId}/watch`);
  return res.data;
}

export async function getAlerts(): Promise<AlertItem[]> {
  if (isMockMode()) return [];
  const res = await apiClient.get('/cases/alerts/list');
  return res.data;
}

export async function getUnreadAlertCount(): Promise<{ unread_count: number }> {
  if (isMockMode()) return { unread_count: 0 };
  const res = await apiClient.get('/cases/alerts/unread-count');
  return res.data;
}

export async function markAlertRead(alertId: string): Promise<unknown> {
  if (isMockMode()) return { status: 'ok' };
  const res = await apiClient.patch(`/cases/alerts/${alertId}/read`);
  return res.data;
}

export async function markAllAlertsRead(): Promise<unknown> {
  if (isMockMode()) return { status: 'ok' };
  const res = await apiClient.patch('/cases/alerts/read-all');
  return res.data;
}