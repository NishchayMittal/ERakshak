import type { GraphData } from '../../types/graph';
import type { ProfileData } from '../../types/profile';
import type { TimelineEntry } from '../../types/timeline';
import type { CaseSummary, CaseNote } from '../../types/case';

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