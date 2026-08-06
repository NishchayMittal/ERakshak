import React, { createContext, useContext } from 'react';
import type { GraphData } from '../types/graph';
import type { CaseSummary } from '../types/case';
import type { PendingApproval } from './CaseDashboardPage';
import type { Investigator } from '../hooks/useAuth';

export interface DashboardContextType {
  activeEntityPerCase: Record<string, string>;
  setActiveEntityPerCase: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  
  nodePositionsPerCase: Record<string, Record<string, { x: number; y: number }>>;
  setNodePositionsPerCase: React.Dispatch<React.SetStateAction<Record<string, Record<string, { x: number; y: number }>>>>;
  
  caseSeedsInput: Record<string, { type: string; value: string }>;
  setCaseSeedsInput: React.Dispatch<React.SetStateAction<Record<string, { type: string; value: string }>>>;
  
  casePendingSeeds: Record<string, Array<{ type: string; value: string }>>;
  setCasePendingSeeds: React.Dispatch<React.SetStateAction<Record<string, Array<{ type: string; value: string }>>>>;
  
  caseIngestProgress: Record<string, number | null>;
  setCaseIngestProgress: React.Dispatch<React.SetStateAction<Record<string, number | null>>>;
  
  caseIngestLogs: Record<string, string[]>;
  setCaseIngestLogs: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  
  caseReportNarrative: Record<string, string>;
  
  caseZoom: Record<string, number>;
  setCaseZoom: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  
  casePan: Record<string, { x: number; y: number }>;
  setCasePan: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  
  graphDataPerCase: Record<string, GraphData>;
  graphData: GraphData | null;
  dossierSearchQuery: Record<string, string>;
  setDossierSearchQuery: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  
  explorerSearchQuery: string;
  setExplorerSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  
  lastAccessedCaseId: string | null;
  
  retrainLogs: string[];
  retrainProgress: number | null;
  
  profileName: string;
  setProfileName: React.Dispatch<React.SetStateAction<string>>;
  profilePass: string;
  setProfilePass: React.Dispatch<React.SetStateAction<string>>;
  profileUpdating: boolean;
  showProfilePassInput: boolean;
  setShowProfilePassInput: React.Dispatch<React.SetStateAction<boolean>>;
  
  pendingApprovals: PendingApproval[];
  loadingPending: boolean;
  
  // User/Cases
  cases: CaseSummary[];
  user: Investigator | null;

  // Actions
  handleNodeDrag: (e: React.MouseEvent, caseId: string, nodeId: string) => void;
  handleZoom: (e: React.WheelEvent, caseId: string) => void;
  handleSvgMouseDown: (e: React.MouseEvent, caseId: string) => void;
  addCaseSeed: (caseId: string) => void;
  removeCaseSeed: (caseId: string, idx: number) => void;
  runIngestPipeline: (caseId: string, overrideSeeds?: Array<{ type: string; value: string }>) => void;
  fetchNarrativeReport: (caseId: string, forceRegenerate?: boolean) => void;
  triggerExport: (caseId: string, format: 'json' | 'csv' | 'pdf') => void;
  handleGoToNode: (caseId: string, nodeId: string) => void;
  loadGraphForCase: (caseId: string, entityId: string) => void;
  getNodeAbbreviation: (caseId: string, nodeId: string) => string;
  
  handleRetrain: () => void;
  handleProfileSubmit: (e: React.FormEvent) => void;
  handleApprove: (id: string, name: string) => void;
  handleReject: (id: string, name: string) => void;
  handleCreateCase: () => void;
  handleDeleteCase: (e: React.MouseEvent, caseId: string, title: string) => void;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setWindows: React.Dispatch<React.SetStateAction<any[]>>;
  closeWindow: (id: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openWindow: (id: string, title: string, type: any, extraProps?: any) => void;
}

export const DashboardContext = createContext<DashboardContextType | null>(null);

export const useDashboardContext = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardContext must be used within DashboardContextProvider');
  }
  return context;
};
