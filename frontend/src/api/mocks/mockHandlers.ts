import type { GraphData } from '../../types/graph';
import type { ProfileData } from '../../types/profile';
import type { TimelineEntry } from '../../types/timeline';
import type { CaseSummary, CaseNote } from '../../types/case';
import type { EvidencePack } from '../../types/evidence';

import mockGraph from './mockGraph.json';
import mockProfile from './mockProfile.json';
import mockTimeline from './mockTimeline.json';
import mockCaseList from './mockCaseList.json';

// simulate realistic network latency so loading states get exercised even in mock mode
const FAKE_DELAY_MS = 350;

function delay<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), FAKE_DELAY_MS));
}

// in-memory mutable copy so notes/tags "persist" for the session without a backend
let notesStore: CaseNote[] = [];

export function getMockCaseList(): Promise<CaseSummary[]> {
  return delay(mockCaseList as CaseSummary[]);
}

export function getMockCase(caseId: string): Promise<CaseSummary | undefined> {
  const found = (mockCaseList as CaseSummary[]).find(c => c.caseId === caseId);
  return delay(found);
}

export function getMockGraph(_caseId: string, _entityId: string): Promise<GraphData> {
  return delay(mockGraph as unknown as GraphData);
}

export function getMockProfile(_caseId: string, _entityId: string): Promise<ProfileData> {
  return delay(mockProfile as ProfileData);
}

export function getMockTimeline(_caseId: string, _entityId: string): Promise<TimelineEntry[]> {
  return delay(mockTimeline as TimelineEntry[]);
}

export function submitMockIdentifiers(_caseId: string, identifiers: unknown[]) {
  // simulate the "ambiguous name" branch from the intake flowchart roughly 1 in 3 submissions,
  // so DisambiguationModal has something real to trigger against during dev
  const looksLikeNameSubmission = Array.isArray(identifiers) && identifiers.some(
    (i: any) => i?.type === 'name'
  );
  const isAmbiguous = looksLikeNameSubmission && Math.random() < 0.34;

  return delay({
    ok: true,
    jobId: 'mock-job-1',
    ambiguous: isAmbiguous,
    ambiguousFieldsNeeded: isAmbiguous ? ['city', 'age', 'employer'] : [],
  });
}

export function getMockNotes(caseId: string): Promise<CaseNote[]> {
  return delay(notesStore.filter(n => n.caseId === caseId));
}

export function addMockNote(caseId: string, authorId: string, text: string): Promise<CaseNote> {
  const note: CaseNote = {
    id: `note-${Date.now()}`,
    caseId,
    authorId,
    text,
    createdAt: new Date().toISOString(),
  };
  notesStore.push(note);
  return delay(note);
}

export function getMockEvidencePack(caseId: string): Promise<EvidencePack> {
  const mockPack: EvidencePack = {
    case: {
      id: caseId,
      title: "Dossier #1 — Mock Investigation",
      status: "active",
      createdAt: "2026-06-01T08:00:00Z"
    },
    identifiers: [
      {
        id: "n1",
        type: "email",
        rawValue: "suspect@example.com",
        normalizedValue: "suspect@example.com",
        confidence: 1.0,
        source: "manual",
        findings: [
          {
            id: "f1",
            connector: "whois",
            type: "registrant_email",
            value: "suspect@example.com",
            confidence: 1.0,
            discoveredAt: "2026-06-02T09:14:00Z",
            rawPayload: { label: "Domain example-domain.com registered" }
          },
          {
            id: "f2",
            connector: "whois",
            type: "registrant_organization",
            value: "Not disclosed (privacy proxy)",
            confidence: 0.6,
            discoveredAt: "2026-06-02T09:14:00Z",
            rawPayload: { label: "Whois record privacy settings updated" }
          },
          {
            id: "f3",
            connector: "whois",
            type: "domain_registered",
            value: "example-domain.com",
            confidence: 1.0,
            discoveredAt: "2023-11-18T10:30:00Z",
            rawPayload: { label: "Domain example-domain.com registered" }
          },
          {
            id: "f4",
            connector: "wayback",
            type: "archived_snapshot",
            value: "https://web.archive.org/web/20240112/example-domain.com",
            confidence: 1.0,
            discoveredAt: "2024-01-12T12:00:00Z",
            rawPayload: { label: "First archived snapshot of example-domain.com captured" }
          },
          {
            id: "f5",
            connector: "crt.sh",
            type: "subdomain_found",
            value: "mail.example-domain.com",
            confidence: 0.9,
            discoveredAt: "2024-06-30T15:20:00Z",
            rawPayload: { label: "SSL certificate issued for mail.example-domain.com" }
          },
          {
            id: "f6",
            connector: "crt.sh",
            type: "subdomain_found",
            value: "dev.example-domain.com",
            confidence: 0.85,
            discoveredAt: "2024-09-14T11:45:00Z",
            rawPayload: { label: "SSL certificate issued for dev.example-domain.com" }
          },
          {
            id: "f7",
            connector: "sherlock",
            type: "username_match",
            value: "suspectuser99",
            confidence: 0.82,
            discoveredAt: "2025-02-08T16:10:00Z",
            rawPayload: { label: "Username suspectuser99 first observed on GitHub" }
          },
          {
            id: "f8",
            connector: "sherlock",
            type: "platform_hit",
            value: "Reddit",
            confidence: 0.7,
            discoveredAt: "2025-03-22T19:30:00Z",
            rawPayload: { label: "Username suspectuser99 observed on Reddit" }
          },
          {
            id: "f9",
            connector: "breach_demo",
            type: "phone_number",
            value: "+91-98XXXXXXX",
            confidence: 0.65,
            discoveredAt: "2025-08-01T14:05:00Z",
            rawPayload: { label: "Phone number surfaced in demo breach dataset" }
          },
          {
            id: "f10",
            connector: "breach_demo",
            type: "co_registered_email",
            value: "backup.suspect@example.com",
            confidence: 0.55,
            discoveredAt: "2025-08-01T14:15:00Z",
            rawPayload: { label: "Co-registered backup email backup.suspect@example.com surfaced" }
          }
        ]
      }
    ]
  };
  return delay(mockPack);
}

export function triggerMockModelRetrain(): Promise<{ message: string }> {
  return delay({ message: "Model retraining triggered in the background." });
}