import React, { useEffect, useState, useRef } from 'react';
import { useCaseStore } from '../state/caseStore';
import type { GraphData } from '../types/graph';
import { useUIStore } from '../state/uiStore';
import { useAuth } from '../hooks/useAuth';
import { useGraphStore } from '../state/graphStore';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  Folder,
  Database,
  Network,
  Settings,
  User,
  X,
  Minimize2,
  Maximize2,
  Monitor,
  LogOut,
  Plus,
  Compass,
  FileText,
  Activity,
  Shield,
  Zap,
  Play,
  Search,
  Terminal,
  Sliders,
  Download,
  Lock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Link,
  ThumbsUp,
  ThumbsDown,
  Edit
} from 'lucide-react';
import {
  triggerModelRetrain,
  updateInvestigatorProfile,
  submitIdentifiers,
  getNotes,
  addNote,
  submitLinkFeedback,
  getNarrative,
  exportCaseJSON,
  exportCaseCSV,
  exportCasePDF,
  getEvidencePack,
  getPendingApprovals,
  approveInvestigator,
  rejectInvestigator,
  getAuditLogs
} from '../api/endpoints';

interface WindowState {
  id: string;
  title: string;
  type: 'case_workspace' | 'settings' | 'profile' | 'cases_explorer';
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  caseId?: string;
  activeTab?: 'intake' | 'graph' | 'dossier' | 'report';
}

const WALLPAPERS = [
  {
    name: 'Cyber Mesh',
    value: 'linear-gradient(135deg, #090e17 0%, #03060c 60%, #010204 100%)',
    gridColor: 'rgba(57, 255, 20, 0.03)',
    accentGlow: 'rgba(57, 255, 20, 0.12)',
    accentColor: '#39FF14'
  },
  {
    name: 'Techno Void',
    value: 'radial-gradient(circle at center, #18052b 0%, #080112 50%, #000000 100%)',
    gridColor: 'rgba(168, 85, 247, 0.03)',
    accentGlow: 'rgba(168, 85, 247, 0.15)',
    accentColor: '#A855F7'
  },
  {
    name: 'Deep Hazard',
    value: 'radial-gradient(circle at 30% 30%, #29080e 0%, #0b0103 70%, #000000 100%)',
    gridColor: 'rgba(239, 68, 68, 0.03)',
    accentGlow: 'rgba(239, 68, 68, 0.12)',
    accentColor: '#EF4444'
  }
];

const MOCK_HUD_LOGS = [
  'OSINT: Awaiting seed injection vector...',
  'AUDIT: Ledger checked for active badges.',
  'Booster: Jaro-Winkler calibrator ready.',
  'RESOLVER: Active SPF records indexed.',
  'SECURE: Session token encrypted on active badge.'
];

const detectSeedType = (val: string): string => {
  const trimmed = val.trim();
  if (!trimmed) return 'email';

  if (trimmed.includes('@')) {
    return 'email';
  } else if (/^\+?\d[\d-\s()]{7,}\d$/.test(trimmed)) {
    return 'phone';
  } else if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(trimmed)) {
    return 'ip';
  } else if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(trimmed) || (trimmed.includes('.') && !trimmed.includes(' '))) {
    return 'domain';
  } else if (/^(0x)?[0-9a-fA-F]{40}$/.test(trimmed) || /^[139][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(trimmed)) {
    return 'wallet';
  } else if (trimmed.includes(' ') && trimmed.length > 3) {
    return 'name';
  } else if (trimmed.length > 2) {
    return 'username';
  }
  return 'email';
};

export default function CaseDashboardPage() {
  const { cases, loading, loadCases, selectCase, initializeNewCase, deleteCase, renameCase } = useCaseStore();
  const { showToast } = useUIStore();
  const { user, logout } = useAuth();
  const { loadEntityGraph, graphData, clearGraph } = useGraphStore();

  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [wallpaperIdx, setWallpaperIdx] = useState(0);
  const [customWallpaper, setCustomWallpaper] = useState<string | null>(null);
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);

  const activeCaseId = windows.find(w => w.id === activeWindowId && w.type === 'case_workspace')?.caseId;
  useWebSocket(activeCaseId);

  useEffect(() => {
    if (graphData && activeCaseId) {
      setGraphDataPerCase(prev => ({
        ...prev,
        [activeCaseId]: graphData
      }));

      if (graphData.nodes) {
        const cx = 350;
        const cy = 200;
        const radius = 130;
        setNodePositionsPerCase(prev => {
          const existing = prev[activeCaseId] || {};
          const nextPos = { ...existing };
          graphData.nodes.forEach((n, idx) => {
            if (!nextPos[n.id]) {
              const angle = (idx / graphData.nodes.length) * 2 * Math.PI;
              nextPos[n.id] = {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle)
              };
            }
          });
          return {
            ...prev,
            [activeCaseId]: nextPos
          };
        });
      }
    }
  }, [graphData, activeCaseId]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; caseId: string; title: string } | null>(null);
  const [renameCaseState, setRenameCaseState] = useState<{ id: string; title: string; newTitle: string } | null>(null);
  const [deleteConfirmCase, setDeleteConfirmCase] = useState<{ id: string; title: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, caseId: string, title: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      caseId,
      title
    });
  };

  const handleTriggerRename = (caseId: string, title: string) => {
    setRenameCaseState({
      id: caseId,
      title,
      newTitle: title
    });
  };

  const handleSaveRename = async () => {
    if (!renameCaseState || !renameCaseState.newTitle.trim()) return;
    try {
      await renameCase(renameCaseState.id, renameCaseState.newTitle.trim());
      showToast('CASE RENAMED', 'success');
      setRenameCaseState(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to rename case', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmCase) return;
    try {
      await deleteCase(deleteConfirmCase.id);
      closeWindow(`workspace-${deleteConfirmCase.id}`);
      showToast(`Case ${deleteConfirmCase.id} deleted`, 'success');
      setDeleteConfirmCase(null);
    } catch (err) {
      showToast('Failed to delete case', 'error');
    }
  };

  // System statistics widgets
  const [cpuUsage, setCpuUsage] = useState(28);
  const [ramUsage, setRamUsage] = useState(45);
  const [hudLogs, setHudLogs] = useState<string[]>(MOCK_HUD_LOGS);

  // Profile Form state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePass, setProfilePass] = useState('');
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Settings Trainer state
  const [retrainLogs, setRetrainLogs] = useState<string[]>([]);
  const [retrainProgress, setRetrainProgress] = useState<number | null>(null);

  // Active Case Window Custom States
  // Tracks active selected entity/nodes per caseId to dynamically populate dossiers
  const [activeEntityPerCase, setActiveEntityPerCase] = useState<Record<string, string>>({});
  const [nodePositionsPerCase, setNodePositionsPerCase] = useState<Record<string, Record<string, { x: number; y: number }>>>({});
  const [caseSeedsInput, setCaseSeedsInput] = useState<Record<string, { type: string; value: string }>>({});
  const [casePendingSeeds, setCasePendingSeeds] = useState<Record<string, Array<{ type: string; value: string }>>>({});
  const [caseIngestProgress, setCaseIngestProgress] = useState<Record<string, number | null>>({});
  const [caseIngestLogs, setCaseIngestLogs] = useState<Record<string, string[]>>({});
  const [caseReportNarrative, setCaseReportNarrative] = useState<Record<string, string>>({});
  const [caseZoom, setCaseZoom] = useState<Record<string, number>>({});
  const [casePan, setCasePan] = useState<Record<string, { x: number; y: number }>>({});
  const [graphDataPerCase, setGraphDataPerCase] = useState<Record<string, GraphData>>({});
  const [dossierSearchQuery, setDossierSearchQuery] = useState<Record<string, string>>({});
  const [caseOrder, setCaseOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('erakshak_case_order');
    return saved ? JSON.parse(saved) : [];
  });
  const [draggedCaseId, setDraggedCaseId] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfilePassInput, setShowProfilePassInput] = useState(false);
  const [lastAccessedCaseId, setLastAccessedCaseId] = useState<string | null>(() => {
    return localStorage.getItem('er_last_accessed_case') || null;
  });
  const [explorerSearchQuery, setExplorerSearchQuery] = useState('');
  const desktopRef = useRef<HTMLDivElement>(null);

  const handleZoom = (e: React.WheelEvent, caseId: string) => {
    // Zoom around center point of canvas (350, 200) with increased speed
    const zoomIntensity = 0.15;
    const currentZoom = caseZoom[caseId] || 1.0;
    const nextZoom = e.deltaY < 0
      ? Math.min(3.0, currentZoom + zoomIntensity)
      : Math.max(0.3, currentZoom - zoomIntensity);

    setCaseZoom(prev => ({
      ...prev,
      [caseId]: nextZoom
    }));
  };

  const handleSvgMouseDown = (e: React.MouseEvent, caseId: string) => {
    // Pan only on right click (button 2)
    if (e.button !== 2) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initPan = casePan[caseId] || { x: 0, y: 0 };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setCasePan(prev => ({
        ...prev,
        [caseId]: {
          x: initPan.x + dx,
          y: initPan.y + dy
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const sortedCases = [...cases].sort((a, b) => {
    const indexA = caseOrder.indexOf(a.caseId);
    const indexB = caseOrder.indexOf(b.caseId);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const handleDragStartCase = (e: React.DragEvent, caseId: string) => {
    setDraggedCaseId(caseId);
    e.dataTransfer.setData('text/plain', caseId);
  };

  const handleDropCase = (e: React.DragEvent, targetCaseId: string) => {
    e.preventDefault();
    const sourceCaseId = draggedCaseId || e.dataTransfer.getData('text/plain');
    if (!sourceCaseId || sourceCaseId === targetCaseId) return;

    const currentOrder = sortedCases.map(c => c.caseId);
    const sourceIndex = currentOrder.indexOf(sourceCaseId);
    const targetIndex = currentOrder.indexOf(targetCaseId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const nextOrder = [...currentOrder];
      nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, sourceCaseId);

      setCaseOrder(nextOrder);
      localStorage.setItem('erakshak_case_order', JSON.stringify(nextOrder));
    }
    setDraggedCaseId(null);
  };

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (cases.length > 0) {
      setCaseOrder(prev => {
        const caseIds = cases.map(c => c.caseId);
        let next = prev.filter(id => caseIds.includes(id));
        const missing = caseIds.filter(id => !next.includes(id));
        if (missing.length > 0 || next.length !== prev.length) {
          const updated = [...next, ...missing];
          localStorage.setItem('erakshak_case_order', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    }
  }, [cases]);

  // Fetch real backend audit logs periodically
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await getAuditLogs();
        if (data && Array.isArray(data)) {
          const formatted = data.map((log: any) => {
            const date = new Date(log.timestamp);
            const time = date.toTimeString().split(' ')[0];
            const action = log.action.toLowerCase();
            const meta = log.detail || {};

            let message = log.action.toUpperCase();

            if (action === 'investigator.login') {
              message = `INVESTIGATOR LOGIN // AGENT: ${meta.badge_id || 'UNKNOWN'}`;
            } else if (action === 'investigator.signup') {
              message = `SIGNUP REQUEST SUBMITTED // BADGE: ${meta.badge_id || 'UNKNOWN'}`;
            } else if (action === 'investigator.approve') {
              message = `REGISTRATION APPROVED // TARGET: ${meta.badge_id || 'UNKNOWN'}`;
            } else if (action === 'investigator.reject') {
              message = `REGISTRATION REJECTED // TARGET: ${meta.badge_id || 'UNKNOWN'}`;
            } else if (action === 'investigator.update_profile') {
              message = `SECURITY PROFILE UPDATED // AGENT: ${meta.badge_id || 'UNKNOWN'}`;
            } else if (action === 'case.create') {
              message = `CASE INITIALIZED // TITLE: ${meta.title || 'UNTITLED'}`;
            } else if (action === 'case.delete') {
              message = `CASE REMOVED // ID: ${meta.case_id || 'UNKNOWN'}`;
            } else if (action === 'case.rename') {
              message = `CASE RECLASSIFIED // TITLE: ${meta.title || 'UNTITLED'}`;
            } else if (action === 'identifier.create') {
              message = `IDENTIFIER INGESTED // TYPE: ${(meta.type || 'unknown').toUpperCase()} // VALUE: ${meta.value || ''}`;
            } else if (action === 'connector.run') {
              message = `CONNECTOR EXECUTING // ATTACHED ID: ${meta.identifier_id || ''}`;
            } else if (action === 'feedback.submit' || action === 'feedback') {
              message = `RELATION FEEDBACK SUBMITTED // STATUS: ${(meta.status || 'unknown').toUpperCase()}`;
            } else if (action === 'model.retrain') {
              message = `NEURAL CLASSIFIER WEIGHTS RETRAINED`;
            }

            return `[${time}] AUDIT: ${message}`;
          });
          setHudLogs(formatted);
        }
      } catch (err) {
        console.error('Failed to fetch audit logs', err);
      }
    };
    fetchLogs();
    const timer = setInterval(fetchLogs, 5000);
    return () => clearInterval(timer);
  }, []);

  const currentWallpaper = WALLPAPERS[wallpaperIdx];

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCustomWallpaper(`url(${event.target.result})`);
          showToast('Custom wallpaper loaded', 'success');
          setShowWallpaperMenu(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWallpaperUrlKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const url = (e.target as HTMLInputElement).value.trim();
      if (url) {
        setCustomWallpaper(`url(${url})`);
        showToast('Custom URL wallpaper loaded', 'success');
        setShowWallpaperMenu(false);
      }
    }
  };

  // Window operations
  const focusWindow = (id: string) => {
    setActiveWindowId(id);
    setWindows(prev =>
      prev.map(w => {
        if (w.id === id) {
          const nextZ = maxZIndex + 1;
          setMaxZIndex(nextZ);
          if (w.type === 'case_workspace' && w.caseId) {
            setLastAccessedCaseId(w.caseId);
            localStorage.setItem('er_last_accessed_case', w.caseId);
          }
          return { ...w, zIndex: nextZ, isMinimized: false };
        }
        return w;
      })
    );
  };

  const openWindow = (id: string, title: string, type: WindowState['type'], extraProps: Partial<WindowState> = {}) => {
    const exists = windows.find(w => w.id === id);
    if (exists) {
      focusWindow(id);
      return;
    }

    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    const offset = (windows.length * 25) % 150;

    const newWin: WindowState = {
      id,
      title,
      type,
      x: 100 + offset,
      y: 60 + offset,
      width: type === 'case_workspace' ? 1000 : 650,
      height: type === 'case_workspace' ? 660 : 480,
      isMinimized: false,
      isMaximized: false,
      zIndex: nextZ,
      activeTab: 'intake',
      ...extraProps
    };

    setWindows(prev => [...prev, newWin]);
    setActiveWindowId(id);
    if (type === 'case_workspace' && extraProps.caseId) {
      setLastAccessedCaseId(extraProps.caseId);
      localStorage.setItem('er_last_accessed_case', extraProps.caseId);
    }

    // If opening a case workspace, fetch its graph immediately
    if (type === 'case_workspace' && extraProps.caseId) {
      loadGraphForCase(extraProps.caseId, 'n1');
    }
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  };

  const toggleMinimize = (id: string) => {
    setWindows(prev =>
      prev.map(w => (w.id === id ? { ...w, isMinimized: !w.isMinimized } : w))
    );
    if (activeWindowId === id) {
      setActiveWindowId(null);
    } else {
      focusWindow(id);
    }
  };

  const toggleMaximize = (id: string) => {
    setWindows(prev =>
      prev.map(w => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  };

  const handleDragStart = (e: React.MouseEvent, id: string) => {
    const win = windows.find(w => w.id === id);
    if (!win || win.isMaximized) return;

    focusWindow(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = win.x;
    const initY = win.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setWindows(prev =>
        prev.map(w => {
          if (w.id === id) {
            return {
              ...w,
              x: Math.max(0, initX + dx),
              y: Math.max(0, initY + dy)
            };
          }
          return w;
        })
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getNodeAbbreviation = (caseId: string, nodeId: string) => {
    const graph = graphDataPerCase[caseId];
    if (!graph || !graph.nodes) return nodeId;
    const idx = graph.nodes.findIndex((n: any) => n.id === nodeId);
    return idx !== -1 ? `N${idx + 1}` : nodeId;
  };

  const handleGoToNode = (caseId: string, nodeId: string) => {
    setActiveEntityPerCase(prev => ({
      ...prev,
      [caseId]: nodeId
    }));

    setWindows(prev => prev.map(w => w.id === `workspace-${caseId}` ? { ...w, activeTab: 'graph' } : w));

    const nodePos = nodePositionsPerCase[caseId]?.[nodeId];
    if (nodePos) {
      setCasePan(prev => ({
        ...prev,
        [caseId]: {
          x: 350 - nodePos.x,
          y: 200 - nodePos.y
        }
      }));
    }
  };

  const loadGraphForCase = async (caseId: string, entityId: string) => {
    try {
      await loadEntityGraph(caseId, entityId);
      // Auto positions nodes in a circle mapping
      const currentGraph = useGraphStore.getState().graphData;
      if (currentGraph) {
        setGraphDataPerCase(prev => ({
          ...prev,
          [caseId]: currentGraph
        }));

        if (currentGraph.nodes) {
          const cx = 350;
          const cy = 200;
          const radius = 130;
          setNodePositionsPerCase(prev => {
            const existing = prev[caseId] || {};
            const nextPos = { ...existing };
            currentGraph.nodes.forEach((n, idx) => {
              if (!nextPos[n.id]) {
                const angle = (idx / currentGraph.nodes.length) * 2 * Math.PI;
                nextPos[n.id] = {
                  x: cx + radius * Math.cos(angle),
                  y: cy + radius * Math.sin(angle)
                };
              }
            });
            return {
              ...prev,
              [caseId]: nextPos
            };
          });
        }
      }

      setActiveEntityPerCase(prev => ({
        ...prev,
        [caseId]: entityId
      }));
    } catch (err) {
      console.error('Failed to load case graph:', err);
    }
  };

  useEffect(() => {
    if (cases.length === 0) return;

    const validCase = cases.find(c => c.caseId === lastAccessedCaseId);
    const targetId = validCase ? validCase.caseId : cases[0].caseId;

    if (!validCase) {
      setLastAccessedCaseId(targetId);
      localStorage.setItem('er_last_accessed_case', targetId);
    }

    loadGraphForCase(targetId, 'n1').catch(err => {
      console.warn("Failed to prefetch graph for case:", err);
    });
  }, [lastAccessedCaseId, cases.length]);

  const handleMatrixWheel = (e: React.WheelEvent) => {
    if (!lastAccessedCaseId) return;
    const zoomIntensity = 0.15;
    const currentZoom = caseZoom[lastAccessedCaseId] || 1.0;
    const nextZoom = e.deltaY < 0
      ? Math.min(3.0, currentZoom + zoomIntensity)
      : Math.max(0.3, currentZoom - zoomIntensity);

    setCaseZoom(prev => ({
      ...prev,
      [lastAccessedCaseId]: nextZoom
    }));
  };

  const handleMatrixMouseDown = (e: React.MouseEvent) => {
    if (!lastAccessedCaseId) return;
    if (e.button !== 2) return; // Right click only
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initPan = casePan[lastAccessedCaseId] || { x: 0, y: 0 };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setCasePan(prev => ({
        ...prev,
        [lastAccessedCaseId]: {
          x: initPan.x + dx,
          y: initPan.y + dy
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const renderMatrixGraph = () => {
    if (!lastAccessedCaseId || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return (
        <svg className="w-full h-full" viewBox="0 0 380 120">
          <text x="190" y="65" fill="#39ff14" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)" className="animate-pulse">
            AWAITING CASE MATRIX...
          </text>
        </svg>
      );
    }

    const casePositions = nodePositionsPerCase[lastAccessedCaseId] || {};
    const nodes = graphData.nodes;
    const edges = graphData.edges || [];
    const zoom = caseZoom[lastAccessedCaseId] || 1.0;
    const pan = casePan[lastAccessedCaseId] || { x: 0, y: 0 };

    return (
      <svg
        className="w-full h-full cursor-grab active:cursor-grabbing pointer-events-auto"
        viewBox="0 0 380 120"
        onWheel={handleMatrixWheel}
        onMouseDown={handleMatrixMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <g transform={`translate(190, 60) translate(${pan.x}, ${pan.y}) scale(${zoom}) translate(-350, -200)`}>
          {/* Draw Edges */}
          {edges.map((e, idx) => {
            const fromNode = nodes.find(n => n.id === e.source);
            const toNode = nodes.find(n => n.id === e.target);
            if (!fromNode || !toNode) return null;
            const fromPos = casePositions[fromNode.id] || { x: 350, y: 200 };
            const toPos = casePositions[toNode.id] || { x: 350, y: 200 };

            return (
              <line
                key={idx}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="rgba(57,255,20,0.2)"
                strokeWidth="1.2"
                strokeDasharray={idx % 2 === 0 ? "2 2" : "none"}
              />
            );
          })}

          {/* Draw Nodes */}
          {nodes.map((n, idx) => {
            const pos = casePositions[n.id] || { x: 350, y: 200 };
            const isSeed = n.type === 'email' || n.type === 'phone' || n.type === 'username';

            return (
              <g
                key={n.id}
                onMouseDown={(e) => handleNodeDrag(e, lastAccessedCaseId, n.id)}
                className="cursor-pointer select-none"
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSeed ? 6 : 4}
                  fill={isSeed ? '#39ff14' : '#a855f7'}
                  stroke={isSeed ? '#ffffff' : '#39ff14'}
                  strokeWidth={0.8}
                />
                {n.label && (
                  <text
                    x={pos.x}
                    y={pos.y + 12}
                    fill="#88f255"
                    fontSize="8"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none' }}
                  >
                    {n.label.substring(0, 10).toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    );
  };

  const handleCreateCase = async () => {
    try {
      let caseNumber = cases.length + 1;
      let title = `Investigation #${caseNumber} — AD HOC`;
      while (cases.some(c => c.title.toLowerCase() === title.toLowerCase())) {
        caseNumber++;
        title = `Investigation #${caseNumber} — AD HOC`;
      }
      const newCase = await initializeNewCase(title, 'Ad-hoc initialized case file');
      showToast(`${newCase.caseId} INITIALIZED`, 'success');
      openWindow(
        `workspace-${newCase.caseId}`,
        `Case Workspace: ${newCase.title}`,
        'case_workspace',
        { caseId: newCase.caseId, activeTab: 'intake' }
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to initialize case', 'error');
    }
  };

  const handleDeleteCase = (e: React.MouseEvent, caseId: string, title: string) => {
    e.stopPropagation();
    setDeleteConfirmCase({ id: caseId, title });
  };

  // Node Dragging inside active link analysis tab
  const handleNodeDrag = (e: React.MouseEvent, caseId: string, nodeId: string) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initPos = nodePositionsPerCase[caseId]?.[nodeId] || { x: 350, y: 200 };
    const zoom = caseZoom[caseId] || 1.0;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Scale mouse movement by the zoom level to match target cursor position precisely
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;

      setNodePositionsPerCase(prev => ({
        ...prev,
        [caseId]: {
          ...(prev[caseId] || {}),
          [nodeId]: {
            x: initPos.x + dx,
            y: initPos.y + dy
          }
        }
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Add identifier seed to temporary pipeline list
  const addCaseSeed = (caseId: string) => {
    const input = caseSeedsInput[caseId] || { type: 'email', value: '' };
    if (!input.value.trim()) return;

    const existing = casePendingSeeds[caseId] || [];
    if (existing.some(s => s.type === input.type && s.value.toLowerCase() === input.value.toLowerCase())) {
      showToast('Identifier already added', 'info');
      return;
    }

    setCasePendingSeeds(prev => ({
      ...prev,
      [caseId]: [...existing, { type: input.type, value: input.value.trim() }]
    }));
    setCaseSeedsInput(prev => ({
      ...prev,
      [caseId]: { ...input, value: '' }
    }));
    showToast('Seed added to ingestion queue', 'success');
  };

  const removeCaseSeed = (caseId: string, idx: number) => {
    const existing = casePendingSeeds[caseId] || [];
    setCasePendingSeeds(prev => ({
      ...prev,
      [caseId]: existing.filter((_, i) => i !== idx)
    }));
  };

  // Run Ingestion Pipeline
  const runIngestPipeline = async (caseId: string) => {
    const seeds = casePendingSeeds[caseId] || [];
    if (seeds.length === 0) {
      showToast('Please add at least one seed first', 'error');
      return;
    }

    setCaseIngestProgress(prev => ({ ...prev, [caseId]: 0 }));
    setCaseIngestLogs(prev => ({ ...prev, [caseId]: ['INGEST: Initiating search correlation scan...'] }));

    // Prepare API call
    const apiPromise = submitIdentifiers(caseId, seeds.map(s => ({ type: s.type, rawValue: s.value })));

    let progress = 0;
    const stages = [
      'INGEST: Translating native scripts...',
      'WHOIS: Extracting historic registrar contact names...',
      'CRT.SH: Scanned PostgreSQL certificate transparency logs.',
      'SHERLOCK: Fetching handles across 280+ active endpoints...',
      'XGBOOST: Calculating correlation weights.',
      'MATRIX: Audit entry signed. Jaro-Winkler map completed.'
    ];

    const timer = setInterval(async () => {
      progress += 10;
      setCaseIngestProgress(prev => ({ ...prev, [caseId]: progress }));

      const stageIdx = Math.floor(progress / 20);
      if (stages[stageIdx]) {
        setCaseIngestLogs(prev => {
          const current = prev[caseId] || [];
          if (!current.includes(stages[stageIdx])) {
            return { ...prev, [caseId]: [...current, stages[stageIdx]] };
          }
          return prev;
        });
      }

      if (progress >= 100) {
        clearInterval(timer);
        try {
          await apiPromise;
          setCaseIngestProgress(prev => ({ ...prev, [caseId]: null }));
          setCasePendingSeeds(prev => ({ ...prev, [caseId]: [] }));
          showToast('Correlation mesh constructed successfully', 'success');
          // Switch to Graph tab and load
          setWindows(prev =>
            prev.map(w => (w.caseId === caseId ? { ...w, activeTab: 'graph' } : w))
          );
          loadGraphForCase(caseId, seeds[0].value.trim().toLowerCase());
        } catch (err) {
          showToast('Backend ingestion pipeline failed', 'error');
          setCaseIngestProgress(prev => ({ ...prev, [caseId]: null }));
        }
      }
    }, 400);
  };

  // Submit confirms/reject link feedback
  const handleFeedback = async (caseId: string, sourceId: string, targetId: string, status: 'confirmed' | 'rejected') => {
    try {
      await submitLinkFeedback(caseId, { case_id: caseId, source_id: sourceId, target_id: targetId, status });
      showToast(`Link feedback logged: ${status.toUpperCase()}`, 'success');
      loadGraphForCase(caseId, activeEntityPerCase[caseId] || 'n1');
    } catch (err) {
      showToast('Failed to record link feedback', 'error');
    }
  };

  // Fetch and display narrative AI report
  const fetchNarrativeReport = async (caseId: string) => {
    try {
      showToast('Generating AI narrative synthesis...', 'info');
      const res = await getNarrative(caseId);
      setCaseReportNarrative(prev => ({
        ...prev,
        [caseId]: res.narrative
      }));
    } catch (err) {
      showToast('Failed to generate report narrative', 'error');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileUpdating(true);
    try {
      await updateInvestigatorProfile(profileName, profilePass || undefined);
      showToast('Credentials updated successfully', 'success');
      setProfilePass('');
    } catch (err) {
      showToast('Failed to update credentials', 'error');
    } finally {
      setProfileUpdating(false);
    }
  };

  const fetchPendingApprovals = async () => {
    if (user?.badgeNumber !== 'INV-001') return;
    setLoadingPending(true);
    try {
      const res = await getPendingApprovals();
      setPendingApprovals(res);
    } catch (err) {
      console.error('Failed to fetch pending approvals', err);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleApprove = async (id: string, name: string) => {
    try {
      await approveInvestigator(id);
      showToast(`APPROVED REGISTRATION FOR ${name.toUpperCase()}`, 'success');
      fetchPendingApprovals();
    } catch (err) {
      showToast('FAILED TO APPROVE INVESTIGATOR', 'error');
    }
  };

  const handleReject = async (id: string, name: string) => {
    try {
      await rejectInvestigator(id);
      showToast(`DENIED REGISTRATION FOR ${name.toUpperCase()}`, 'success');
      fetchPendingApprovals();
    } catch (err) {
      showToast('FAILED TO DENY INVESTIGATOR', 'error');
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, [user]);

  const handleRetrain = async () => {
    setRetrainProgress(0);
    setRetrainLogs(['BOOTSTRAP: Accessing database transaction nodes...']);

    const apiPromise = triggerModelRetrain();

    let p = 0;
    const stages = [
      'VECTORS: Constructing comparison vectors for labeled pairs...',
      'XGBOOST: Training model iteration 01/05...',
      'XGBOOST: Training model iteration 03/05...',
      'SHAP: Extracting trees explainability attributes...',
      'SYSTEM: Neural model weights re-loaded in memory.'
    ];

    const timer = setInterval(async () => {
      p += 20;
      setRetrainProgress(p);
      const idx = Math.floor(p / 25);
      if (stages[idx]) {
        setRetrainLogs(prev => [...prev, stages[idx]]);
      }
      if (p >= 100) {
        clearInterval(timer);
        try {
          await apiPromise;
          setRetrainProgress(null);
          showToast('Neural retrainer completed', 'success');
        } catch (err) {
          showToast('Model retraining failed', 'error');
          setRetrainProgress(null);
        }
      }
    }, 600);
  };

  const triggerExport = async (caseId: string, format: 'json' | 'csv' | 'pdf') => {
    try {
      showToast(`Compiling ${format.toUpperCase()} archive...`, 'info');
      let blob;
      let name = `Dossier_Export_${caseId}.${format}`;
      if (format === 'json') {
        blob = await exportCaseJSON(caseId);
      } else if (format === 'csv') {
        blob = await exportCaseCSV(caseId);
      } else {
        blob = await exportCasePDF(caseId);
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Download initialized', 'success');
    } catch (err) {
      showToast('Failed to export data', 'error');
    }
  };

  return (
    <div
      ref={desktopRef}
      className="relative w-full h-full overflow-hidden select-none bg-black text-gray-300"
      style={{
        background: customWallpaper || currentWallpaper.value,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'background 0.5s ease',
        fontFamily: 'var(--font-mono)'
      }}
    >
      {/* Background grid scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${currentWallpaper.gridColor} 1.5px, transparent 1.5px), linear-gradient(90deg, ${currentWallpaper.gridColor} 1.5px, transparent 1.5px)`,
          backgroundSize: '40px 40px'
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] rounded-full filter blur-[150px] pointer-events-none opacity-20"
        style={{
          background: currentWallpaper.accentGlow,
          transition: 'background 0.5s ease'
        }}
      />

      {/* Retro scanline screen flicker overlay */}
      <div className="absolute inset-0 pointer-events-none bg-radial-vignette mix-blend-overlay opacity-30 z-50" />

      {/* Top Menu Bar */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-black/60 backdrop-blur-md border-b border-[#39ff14]/15 flex items-center justify-between px-4 z-[999] text-[10px]">
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-wider text-[#39ff14] flex items-center gap-1.5 animate-pulse">
            <Shield size={12} /> ORION HOLOGRAPHIC CONSOLE
          </span>
          <div className="h-3 w-[1px] bg-white/10" />
          <button
            onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
            className="text-[9px] text-gray-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            Wallpaper
          </button>
        </div>
        <div className="flex items-center gap-4 text-[9px] text-gray-400 font-medium">
          <span>INVESTIGATOR BADGE: <span className="text-[#39ff14] font-bold">{user?.badgeNumber}</span></span>
          <div className="h-3 w-[1px] bg-white/10" />
          <span className="flex items-center gap-1 text-[#39ff14]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-ping" /> CORE READY
          </span>
        </div>
      </div>

      {/* Wallpaper backdrop click catcher */}
      {showWallpaperMenu && (
        <div
          className="fixed inset-0 z-[999]"
          onClick={() => setShowWallpaperMenu(false)}
        />
      )}

      {/* Wallpaper dropdown */}
      {showWallpaperMenu && (
        <div className="absolute top-9 left-40 bg-[#080d16]/95 border border-[#39ff14]/20 backdrop-blur-xl p-2 rounded shadow-2xl z-[1000] flex flex-col gap-1 w-44">
          {WALLPAPERS.map((wp, idx) => (
            <button
              key={wp.name}
              onClick={() => {
                setCustomWallpaper(null);
                setWallpaperIdx(idx);
                setShowWallpaperMenu(false);
              }}
              className={`w-full text-left text-[10px] px-2 py-1.5 hover:bg-[#39ff14]/10 transition flex items-center justify-between ${wallpaperIdx === idx && !customWallpaper ? 'text-[#39ff14]' : 'text-gray-300'}`}
            >
              <span>{wp.name}</span>
              {wallpaperIdx === idx && !customWallpaper && <div className="w-1.5 h-1.5 rounded-full bg-[#39ff14]" />}
            </button>
          ))}
          {/* File Upload Input */}
          <div className="border-t border-white/10 mt-1 pt-1">
            <label className="w-full text-left text-[9px] px-2 py-1.5 text-gray-400 hover:text-white cursor-pointer transition flex items-center gap-1.5 uppercase font-bold">
              <span>↑ Custom File</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleWallpaperUpload}
                className="hidden"
              />
            </label>
          </div>
          {/* Custom URL Input */}
          <div className="border-t border-[#39ff14]/10 mt-1 pt-1 flex flex-col gap-1 px-2">
            <span className="text-[7.5px] text-gray-500 font-mono">OR PASTE URL:</span>
            <input
              type="text"
              placeholder="https://..."
              onKeyDown={handleWallpaperUrlKeyDown}
              className="w-full bg-black border border-white/10 text-gray-300 text-[8px] px-1 py-0.5 focus:border-[#39ff14] outline-none"
            />
          </div>
        </div>
      )}

      {/* Scrollable Desktop Area for Folders */}
      <div
        className="absolute top-12 bottom-20 left-6 right-[460px] overflow-y-auto pointer-events-auto z-10 pr-2 custom-desktop-scrollbar"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="grid grid-cols-8 gap-3 pb-6">
          {/* Initialize Case Icon */}
          <div
            onClick={handleCreateCase}
            className="flex flex-col items-center justify-center p-2 rounded border border-dashed border-[#39ff14]/30 bg-[#39ff14]/5 hover:bg-[#39ff14]/15 hover:border-[#39ff14] group transition-all duration-150 cursor-pointer pointer-events-auto text-center h-[110px] w-full max-w-[120px] mx-auto flex-shrink-0"
          >
            <div className="w-10 h-10 flex items-center justify-center text-[#39ff14]">
              <Plus size={32} className="group-hover:scale-110 transition-transform" />
            </div>
            <span className="mt-1 text-[11px] font-bold text-gray-300 tracking-wider group-hover:text-white uppercase line-clamp-2 leading-tight">
              INITIALIZE
            </span>
          </div>

          {/* Dynamic Case Folders */}
          {sortedCases.map(c => {
            const isAnalysisOpen = windows.some(w => w.id === `workspace-${c.caseId}`);

            return (
              <div
                key={c.caseId}
                draggable={true}
                onDragStart={(e) => handleDragStartCase(e, c.caseId)}
                onDragEnd={() => setDraggedCaseId(null)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => handleDropCase(e, c.caseId)}
                onClick={() =>
                  openWindow(
                    `workspace-${c.caseId}`,
                    `Case Workspace: ${c.title}`,
                    'case_workspace',
                    { caseId: c.caseId }
                  )
                }
                onContextMenu={(e) => handleContextMenu(e, c.caseId, c.title)}
                className={`flex flex-col items-center justify-center p-2 rounded border group transition-all duration-150 cursor-grab active:cursor-grabbing pointer-events-auto relative text-center select-none h-[110px] w-full max-w-[120px] mx-auto flex-shrink-0 ${isAnalysisOpen ? 'bg-[#39ff14]/10 border-[#39ff14]/40' : 'bg-black/25 border-white/5 hover:bg-[#39ff14]/5 hover:border-[#39ff14]/20'}`}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCase(e, c.caseId, c.title);
                  }}
                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity p-0.5"
                  title="Archive case file"
                >
                  <X size={10} />
                </button>

                <div className={`w-10 h-10 flex items-center justify-center ${isAnalysisOpen ? 'text-[#39ff14]' : 'text-[#a855f7] group-hover:text-[#39ff14]'} transition-colors`}>
                  <Folder size={36} className="group-hover:scale-105 transition-transform" />
                </div>
                <span className="mt-1 text-[11px] font-semibold text-gray-300 group-hover:text-white tracking-wider line-clamp-2 uppercase leading-tight">
                  {c.title.replace('Investigation', 'FILE')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT SIDE WIDGETS HUD (Custom panels) */}
      <div className="absolute top-12 right-6 bottom-20 w-[420px] flex flex-col gap-4 pointer-events-none z-10 select-none">

        {/* Animated Cyber Link graph */}
        <div className="w-full bg-black/40 border border-white/5 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-white/5 pb-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Network size={12} className="text-[#39ff14]" /> Cyber Link Matrix
            </span>
            <span className="text-[7.5px] text-[#39ff14] font-semibold uppercase tracking-wider">
              {(() => {
                const lastAccessedCase = cases.find(c => c.caseId === lastAccessedCaseId);
                return lastAccessedCase ? lastAccessedCase.title.replace('Investigation', 'FILE').toUpperCase() : 'NO ACTIVE MESH';
              })()}
            </span>
          </div>
          <div className="w-full h-64 flex items-center justify-center relative overflow-hidden bg-black/20 rounded">
            {renderMatrixGraph()}
          </div>
        </div>

        {/* Live log Terminal */}
        <div className="w-full flex-1 bg-black/40 border border-white/5 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 pointer-events-auto overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 pb-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Terminal size={12} className="text-[#a855f7]" /> Application Audit Stream
            </span>
          </div>
          <div className="flex-1 overflow-auto font-mono text-[8px] text-gray-400 flex flex-col gap-1 select-text scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {hudLogs.map((log, idx) => (
              <div key={idx} className="whitespace-nowrap flex items-start gap-1">
                <span className="text-[#39ff14]">&gt;</span>
                <span className={log.includes('AUDIT') ? 'text-[#39ff14]' : 'text-gray-300'}>{log}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* DRAGGABLE WINDOWS RENDERER */}
      {windows.map(win => {
        if (win.isMinimized) return null;

        const isFocused = activeWindowId === win.id;

        return (
          <div
            key={win.id}
            onClick={() => focusWindow(win.id)}
            className={`absolute flex flex-col border shadow-2xl transition-all duration-100 bg-[#04080e]/95 backdrop-blur-xl ${isFocused ? 'border-[#39ff14] shadow-[#39ff14]/5' : 'border-white/10 shadow-black/80'}`}
            style={{
              left: win.isMaximized ? 0 : win.x,
              top: win.isMaximized ? '2rem' : win.y,
              width: win.isMaximized ? '100vw' : win.width,
              height: win.isMaximized ? 'calc(100vh - 2rem)' : win.height,
              zIndex: win.zIndex
            }}
          >
            {/* Window Header / Title Bar */}
            <div
              onMouseDown={(e) => handleDragStart(e, win.id)}
              onDoubleClick={() => toggleMaximize(win.id)}
              className={`h-7 px-3 flex items-center justify-between cursor-move select-none border-b ${isFocused ? 'bg-[#39ff14]/5 border-[#39ff14]/20 text-[#39ff14]' : 'bg-[#04080e]/40 border-white/5 text-gray-400'}`}
            >
              <div className="flex items-center gap-2 pointer-events-auto">
                <Folder size={12} className="flex-shrink-0" />
                <span className="text-[9px] font-bold tracking-wider uppercase truncate max-w-[400px]">
                  {(() => {
                    if (win.type === 'case_workspace' && win.caseId) {
                      const targetCase = cases.find(c => c.caseId === win.caseId);
                      return targetCase ? `Case Workspace: ${targetCase.title}` : win.title;
                    }
                    return win.title;
                  })()}
                </span>
                {win.type === 'case_workspace' && win.caseId && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetCase = cases.find(c => c.caseId === win.caseId);
                      const title = targetCase ? targetCase.title : win.title.replace('Case Workspace: ', '');
                      handleTriggerRename(win.caseId!, title);
                    }}
                    className="p-1 text-gray-400 hover:text-[#39ff14] hover:bg-white/5 transition rounded flex items-center justify-center"
                    title="Rename Dossier"
                  >
                    <Edit size={10} />
                  </button>
                )}
              </div>

              {/* Window controls */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMaximize(win.id); }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-white/5 transition"
                  title={win.isMaximized ? "Restore Window" : "Maximize Window"}
                >
                  {win.isMaximized ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                  title="Close Window"
                >
                  <X size={10} />
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div className="flex-1 overflow-hidden relative flex flex-col p-4">

              {/* 1. CASE WORKSPACE WINDOW (COMPLETE REVAMP) */}
              {win.type === 'case_workspace' && win.caseId && (() => {
                const caseId = win.caseId;
                const tab = win.activeTab || 'intake';
                const activeEntity = activeEntityPerCase[caseId] || 'n1';
                const zoom = caseZoom[caseId] || 1.0;
                const pan = casePan[caseId] || { x: 0, y: 0 };

                // Fetch graph data
                const currentGraph = graphData;

                return (
                  <div className="flex flex-col flex-1 min-height-0 overflow-hidden">
                    {/* Retro workspace tab headers */}
                    <div className="flex gap-2 border-b border-white/10 pb-2 mb-3 flex-shrink-0 text-[9px] font-bold">
                      {[
                        { id: 'intake', label: '[01 CMD_INTAKE]' },
                        { id: 'graph', label: '[02 NET_MATRIX]' },
                        { id: 'dossier', label: '[03 TEL_DOSSIER]' },
                        { id: 'report', label: '[04 AI_REPORT]' }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setWindows(prev => prev.map(w => w.id === win.id ? { ...w, activeTab: t.id as any } : w));
                            if (t.id === 'report') fetchNarrativeReport(caseId);
                          }}
                          className={`px-3 py-1.5 border transition ${tab === t.id ? 'bg-[#39ff14]/15 border-[#39ff14] text-[#39ff14]' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab contents */}
                    <div className="flex-1 overflow-hidden min-h-0 flex flex-col">

                      {/* Intake Tab */}
                      {tab === 'intake' && (
                        <div className="flex flex-col gap-4 flex-grow overflow-y-auto pr-1">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Input Form */}
                            <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                              <h4 className="text-[10px] font-bold text-[#39ff14] border-b border-white/5 pb-1">INJECT SEARCH SEEDS</h4>

                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-gray-500 font-bold">IDENTIFIER VECTOR TYPE</span>
                                <select
                                  value={caseSeedsInput[caseId]?.type || 'email'}
                                  onChange={(e) => setCaseSeedsInput(prev => ({
                                    ...prev,
                                    [caseId]: { ...(prev[caseId] || { value: '' }), type: e.target.value }
                                  }))}
                                  className="bg-black border border-white/10 text-gray-300 text-[9px] p-1.5 focus:border-[#39ff14] outline-none"
                                >
                                  <option value="email">EMAIL ADDRESS</option>
                                  <option value="phone">PHONE NUMBER</option>
                                  <option value="name">INDIVIDUAL NAME</option>
                                  <option value="username">SOCIAL USERNAME</option>
                                  <option value="domain">DOMAINS</option>
                                  <option value="ip">IP ADDRESS</option>
                                  <option value="wallet">CRYPTO WALLET</option>
                                  <option value="photo">PHOTO / FACE URL</option>
                                  <option value="other">OTHER / FALLBACK</option>
                                </select>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] text-gray-500 font-bold font-mono">VECTOR VALUE</span>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Enter target detail..."
                                    value={caseSeedsInput[caseId]?.value || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const autoType = detectSeedType(val);
                                      setCaseSeedsInput(prev => ({
                                        ...prev,
                                        [caseId]: {
                                          type: autoType,
                                          value: val
                                        }
                                      }));
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && addCaseSeed(caseId)}
                                    className="flex-1 bg-black border border-white/10 text-gray-200 text-[9px] px-2.5 py-1.5 focus:border-[#39ff14] outline-none"
                                  />
                                  <button
                                    onClick={() => addCaseSeed(caseId)}
                                    className="bg-[#39ff14] hover:bg-[#39ff14]/80 text-black text-[9px] font-bold px-3 py-1.5"
                                  >
                                    ADD SEED
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Ingest queue */}
                            <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                              <h4 className="text-[10px] font-bold text-gray-300 border-b border-white/5 pb-1">INGEST QUEUE LIST</h4>
                              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-32 min-h-24">
                                {(casePendingSeeds[caseId] || []).length === 0 ? (
                                  <span className="text-[8px] text-gray-600 font-mono italic">No pending vector seeds...</span>
                                ) : (
                                  (casePendingSeeds[caseId] || []).map((s, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-white/5 border border-white/5 px-2.5 py-1 rounded">
                                      <span className="text-[8px] uppercase font-bold text-gray-300">
                                        <span className="text-[#a855f7] mr-1.5">[{s.type}]</span> {s.value}
                                      </span>
                                      <button onClick={() => removeCaseSeed(caseId, idx)} className="text-gray-500 hover:text-red-400 text-[8px] font-bold">X</button>
                                    </div>
                                  ))
                                )}
                              </div>
                              <button
                                onClick={() => runIngestPipeline(caseId)}
                                disabled={(casePendingSeeds[caseId] || []).length === 0 || caseIngestProgress[caseId] !== undefined}
                                className="w-full bg-[#a855f7] hover:bg-[#a855f7]/85 disabled:bg-white/5 disabled:text-gray-600 text-black text-[9px] font-bold py-2 tracking-widest text-center uppercase"
                              >
                                RUN CORRELATION SCAN
                              </button>
                            </div>
                          </div>

                          {/* Scanner loader console */}
                          {caseIngestProgress[caseId] !== undefined && caseIngestProgress[caseId] !== null && (
                            <div className="w-full bg-black/45 border border-[#39ff14]/30 p-4 rounded-xl flex flex-col gap-2">
                              <div className="flex justify-between text-[9px] font-bold text-[#39ff14]">
                                <span className="animate-pulse">CRAWLER PIPELINE CARRYING SCAN...</span>
                                <span>{caseIngestProgress[caseId]}%</span>
                              </div>
                              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden relative">
                                <div className="h-full bg-[#39ff14]" style={{ width: `${caseIngestProgress[caseId]}%` }} />
                                {/* Cyber scanning line */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#39ff14]/30 to-transparent w-20 animate-loading-scan" />
                              </div>
                              <div className="flex-1 max-h-24 overflow-y-auto font-mono text-[7.5px] text-gray-500 flex flex-col gap-0.5 mt-2">
                                {(caseIngestLogs[caseId] || []).map((l, i) => (
                                  <div key={i} className="truncate"><span className="text-[#39ff14] mr-1.5">&gt;</span>{l}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Network Matrix drag and drop tab */}
                      {tab === 'graph' && (
                        <div className="flex flex-1 min-height-0 overflow-hidden relative">
                          <div className="flex-grow bg-[#0c1220] border border-[#39ff14]/30 rounded-xl relative overflow-hidden shadow-inner flex flex-col">

                            {/* Drag instructions overlay */}
                            <div className="absolute top-2 left-2 pointer-events-none text-[7px] text-[#39ff14] font-mono uppercase bg-black/85 px-2 py-1 border border-[#39ff14]/20 z-10 tracking-wider">
                              DRAG NODES TO REORGANIZE | DOUBLE-CLICK TO VIEW PROFILE DOSSIER | PAN NETWORK CANVAS BY DRAGGING WITH RIGHT CLICK
                            </div>

                            {/* Network Canvas */}
                            {(() => {
                              const caseGraph = graphDataPerCase[caseId] || graphData;
                              if (!caseGraph || !caseGraph.nodes || caseGraph.nodes.length === 0) {
                                return (
                                  <div className="flex-1 flex flex-col items-center justify-center text-[9px] text-[#39ff14]/60 font-mono tracking-widest gap-2">
                                    <span className="animate-pulse">AWAITING CORRELATION SEED INPUT IN CMD_INTAKE...</span>
                                  </div>
                                );
                              }
                              return (
                                <svg
                                  className="w-full h-full cursor-grab active:cursor-grabbing"
                                  onWheel={(e) => handleZoom(e, caseId)}
                                  onMouseDown={(e) => handleSvgMouseDown(e, caseId)}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  <defs>
                                    <filter id="glow-violet" x="-20%" y="-20%" width="140%" height="140%">
                                      <feGaussianBlur stdDeviation="4" result="blur" />
                                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                    <pattern id={`matrix-grid-${caseId}`} width="25" height="25" patternUnits="userSpaceOnUse">
                                      <path d="M 25 0 L 0 0 0 25" fill="none" stroke="rgba(57, 255, 20, 0.04)" strokeWidth="0.5" />
                                    </pattern>
                                  </defs>
                                  <rect width="100%" height="100%" fill={`url(#matrix-grid-${caseId})`} />
                                  <g transform={`translate(${350 * (1 - zoom) + pan.x}, ${200 * (1 - zoom) + pan.y}) scale(${zoom})`}>
                                    {/* Draw edges */}
                                    {caseGraph.edges && caseGraph.edges.map((e: any, idx: number) => {
                                      const posSource = nodePositionsPerCase[caseId]?.[e.source] || { x: 200, y: 150 };
                                      const posTarget = nodePositionsPerCase[caseId]?.[e.target] || { x: 400, y: 150 };

                                      return (
                                        <g key={idx}>
                                          <line
                                            x1={posSource.x}
                                            y1={posSource.y}
                                            x2={posTarget.x}
                                            y2={posTarget.y}
                                            stroke={activeEntity === e.source || activeEntity === e.target ? '#39ff14' : '#a855f7'}
                                            strokeWidth={e.confidence * 2 + 1}
                                            opacity={0.35}
                                            strokeDasharray={e.confidence < 0.6 ? '4 4' : 'none'}
                                          />
                                          <text
                                            x={(posSource.x + posTarget.x) / 2}
                                            y={(posSource.y + posTarget.y) / 2 - 4}
                                            fill="#8295B4"
                                            fontSize="7"
                                            textAnchor="middle"
                                            fontFamily="monospace"
                                          >
                                            {e.relationType} ({(e.confidence * 100).toFixed(0)}%)
                                          </text>
                                        </g>
                                      );
                                    })}

                                    {/* Draw nodes */}
                                    {caseGraph.nodes && caseGraph.nodes.map((n: any) => {
                                      const pos = nodePositionsPerCase[caseId]?.[n.id] || { x: 300, y: 180 };
                                      const isActive = activeEntity === n.id;
                                      const isSeed = n.type === 'email' || n.type === 'phone' || n.type === 'username';
                                      const nodeNumber = getNodeAbbreviation(caseId, n.id);

                                      return (
                                        <g
                                          key={n.id}
                                          onMouseDown={(e) => handleNodeDrag(e, caseId, n.id)}
                                          onClick={() => {
                                            setActiveEntityPerCase(prev => ({
                                              ...prev,
                                              [caseId]: n.id
                                            }));
                                          }}
                                          onDoubleClick={() => {
                                            // Open dossier tab and load node info
                                            loadGraphForCase(caseId, n.id);
                                            setWindows(prev => prev.map(w => w.id === `workspace-${caseId}` ? { ...w, activeTab: 'dossier' } : w));
                                          }}
                                          className="cursor-pointer select-none"
                                        >
                                          <circle
                                            cx={pos.x}
                                            cy={pos.y}
                                            r={isActive ? 14 : 11}
                                            fill={isActive ? '#39ff14' : isSeed ? '#a855f7' : '#09152b'}
                                            stroke={isActive ? '#ffffff' : '#39ff14'}
                                            strokeWidth={isActive ? 2 : 1.2}
                                            filter="none"
                                          />
                                          <text
                                            x={pos.x}
                                            y={pos.y + 3}
                                            fill={isActive ? '#000000' : '#ffffff'}
                                            fontSize="7.5"
                                            fontWeight="bold"
                                            textAnchor="middle"
                                            fontFamily="monospace"
                                          >
                                            {nodeNumber}
                                          </text>
                                        </g>
                                      );
                                    })}
                                  </g>
                                </svg>
                              );
                            })()}
                          </div>

                          {/* Mini side action node menu */}
                          <div className="w-64 bg-black/35 border border-white/5 rounded-xl ml-3 p-3 flex flex-col gap-3">
                            <span className="text-[8.5px] text-gray-500 font-bold border-b border-white/5 pb-1 uppercase tracking-wider">Node Details</span>
                            {(() => {
                              const caseGraph = graphDataPerCase[caseId] || graphData;
                              const nodeInfo = caseGraph?.nodes?.find((n: any) => n.id === activeEntity);
                              if (!nodeInfo) {
                                return (
                                  <div className="text-[8px] text-gray-500 italic">No node selected. Click a node in the graph matrix to explore its details.</div>
                                );
                              }
                              return (
                                <div className="flex flex-col gap-2.5 text-[8px] flex-1">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-mono font-semibold">NODE ID</span>
                                    <span className="text-[9px] font-bold text-[#39ff14] truncate font-mono uppercase bg-white/5 p-1">{getNodeAbbreviation(caseId, nodeInfo.id)}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-mono font-semibold">VALUE / DETAIL</span>
                                    <span className="text-gray-200 font-mono break-all bg-white/5 p-1 select-text">{nodeInfo.label}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-mono font-semibold">IDENTIFIER TYPE</span>
                                    <span className="text-gray-200 font-mono uppercase bg-white/5 p-1">{nodeInfo.type}</span>
                                  </div>
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-mono font-semibold">CONFIDENCE VALUE</span>
                                    <div className="flex items-center gap-2 bg-white/5 p-1">
                                      <span className="text-[#39ff14] font-bold">{(nodeInfo.confidence * 100).toFixed(0)}%</span>
                                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#39ff14]" style={{ width: `${nodeInfo.confidence * 100}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* Telemetry Dossier Tab */}
                      {tab === 'dossier' && (
                        <div className="flex flex-grow overflow-hidden relative min-h-0">
                          {/* Left column case summary profile feeds */}
                          <div className="w-64 bg-black/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2.5 overflow-y-auto pr-1 flex-shrink-0">
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 pb-1 flex-shrink-0">TRACE MATRICES</span>

                            {/* Search box */}
                            <div className="mb-2 flex-shrink-0">
                              <input
                                type="text"
                                placeholder="Filter nodes / details..."
                                value={dossierSearchQuery[caseId] || ''}
                                onChange={(e) => setDossierSearchQuery(prev => ({
                                  ...prev,
                                  [caseId]: e.target.value
                                }))}
                                className="w-full bg-black/60 border border-white/10 text-gray-200 text-[9px] px-2 py-1.5 focus:border-[#39ff14] outline-none font-mono"
                              />
                            </div>

                            {(() => {
                              const caseGraph = graphDataPerCase[caseId] || graphData;
                              const query = (dossierSearchQuery[caseId] || '').toLowerCase().trim();
                              const filteredNodes = caseGraph?.nodes?.filter((n: any) =>
                                n.label.toLowerCase().includes(query) ||
                                n.id.toLowerCase().includes(query) ||
                                n.type.toLowerCase().includes(query) ||
                                getNodeAbbreviation(caseId, n.id).toLowerCase().includes(query)
                              ) || [];

                              if (filteredNodes.length === 0) {
                                return <span className="text-[8px] text-gray-600 font-mono italic">No matching traces found.</span>;
                              }

                              return filteredNodes.map((n: any) => (
                                <div
                                  key={n.id}
                                  onClick={() => loadGraphForCase(caseId, n.id)}
                                  className={`p-2.5 rounded border transition-colors cursor-pointer flex flex-col gap-1.5 ${activeEntity === n.id ? 'bg-[#39ff14]/10 border-[#39ff14]/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
                                    <span className="text-[8px] font-bold text-white truncate font-mono uppercase">
                                      {getNodeAbbreviation(caseId, n.id)}: {n.label}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[7.5px] font-mono">
                                    <span className="text-gray-500 uppercase">{n.type}</span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleGoToNode(caseId, n.id);
                                      }}
                                      className="text-[#39ff14] hover:text-white px-1.5 py-0.5 border border-[#39ff14]/30 hover:border-[#39ff14] bg-[#39ff14]/5 transition uppercase font-bold"
                                    >
                                      Go to Node
                                    </button>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>

                          {/* Right column dossier detailed profile telemetry card */}
                          <div className="flex-1 bg-black/40 border border-white/5 rounded-xl ml-3 p-4 flex flex-col gap-3 overflow-y-auto pr-1">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <div className="flex flex-col">
                                <h3 className="text-[10px] font-bold text-white tracking-widest uppercase font-mono">OSINT TELEMETRY DOSSIER</h3>
                                <span className="text-[8px] text-gray-500 font-mono mt-0.5">IDENTIFIER CODE: {activeEntity}</span>
                              </div>
                              <span className="text-[9px] font-bold border border-[#39ff14]/40 bg-[#39ff14]/5 text-[#39ff14] px-2 py-0.5 rounded font-mono uppercase">VERIFIED SECURE</span>
                            </div>

                            {/* Dossier contents list */}
                            <div className="flex flex-col gap-3">
                              {/* Simple loop for findings/dossier attributes */}
                              {currentGraph && currentGraph.nodes && currentGraph.nodes.find(n => n.id === activeEntity) ? (
                                <div className="flex flex-col gap-3">
                                  <div className="grid grid-cols-2 gap-3 text-[8.5px]">
                                    <div className="bg-white/5 border border-white/5 p-2.5 rounded flex flex-col gap-1">
                                      <span className="text-gray-500 font-bold uppercase">CORRELATION PRIOR</span>
                                      <span className="text-white font-mono uppercase">0.9888 matching confidence</span>
                                    </div>
                                    <div className="bg-white/5 border border-white/5 p-2.5 rounded flex flex-col gap-1">
                                      <span className="text-gray-500 font-bold uppercase">LEAK EXPOSURES</span>
                                      <span className="text-red-400 font-mono uppercase">Canva, Wattpad Leaks flagged</span>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-1.5">
                                    <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-wide">INGESTED CRAWLER PAYLOADS</span>
                                    <div className="flex flex-col gap-1.5 font-mono text-[8px] text-gray-300">
                                      <div className="p-2 bg-black border border-white/5 rounded flex justify-between">
                                        <span>WHOIS Registrant: securehost@mail.com</span>
                                        <span className="text-[#39ff14]">100% CONFIDENCE</span>
                                      </div>
                                      <div className="p-2 bg-black border border-white/5 rounded flex justify-between">
                                        <span>Social footprints: target_dev handle detected</span>
                                        <span className="text-[#a855f7]">94% CONFIDENCE</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[9px] font-mono text-gray-500 italic">No dossiers compiled. Launch ingestion scan in Intake tab.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Syn Report Tab */}
                      {tab === 'report' && (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black/40 border border-white/5 rounded-xl p-4 gap-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1.5">
                              <FileText size={13} className="text-[#39ff14]" /> Dynamic AI Intelligence Summary
                            </span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => triggerExport(caseId, 'json')} className="border border-[#39ff14] hover:bg-[#39ff14]/10 text-[#39ff14] text-[8px] font-bold px-2 py-1 flex items-center gap-1 uppercase">
                                <Download size={9} /> JSON
                              </button>
                              <button onClick={() => triggerExport(caseId, 'csv')} className="border border-[#39ff14] hover:bg-[#39ff14]/10 text-[#39ff14] text-[8px] font-bold px-2 py-1 flex items-center gap-1 uppercase">
                                <Download size={9} /> CSV
                              </button>
                              <button onClick={() => triggerExport(caseId, 'pdf')} className="bg-[#39ff14] text-black text-[8px] font-bold px-2 py-1 flex items-center gap-1 uppercase">
                                <Download size={9} /> PDF Report
                              </button>
                            </div>
                          </div>

                          <div className="flex-grow overflow-y-auto font-mono text-[9px] text-gray-300 pr-1 select-text bg-black/25 p-3 border border-white/5 whitespace-pre-wrap leading-relaxed">
                            {caseReportNarrative[caseId] || 'Synthesizing report...'}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })()}

              {/* 2. CORE PARAMETERS SETTINGS (REVAMPED CONSOLE) */}
              {win.type === 'settings' && (
                <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-[10px] font-bold text-white tracking-widest uppercase">Booster Parameters Calibration</h3>
                    <p className="text-[8px] text-gray-500 font-mono mt-0.5">XGBoost & SHAP explainer matrix weights scheduler</p>
                  </div>

                  <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                    <h4 className="text-[9px] font-bold text-[#39ff14] uppercase">MODEL TRAINING LOGS</h4>

                    <div className="h-32 bg-black border border-white/5 rounded p-2.5 font-mono text-[8px] text-gray-400 overflow-y-auto flex flex-col gap-0.5">
                      {retrainLogs.length === 0 ? (
                        <span className="text-gray-600 italic">No retraining logs compiled.</span>
                      ) : (
                        retrainLogs.map((log, i) => (
                          <div key={i}><span className="text-[#39ff14] mr-1.5">&gt;</span>{log}</div>
                        ))
                      )}
                    </div>

                    {retrainProgress !== null && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[8px] font-bold text-[#39ff14]">
                          <span>CALIBRATING CORRELATION WEIGHTS...</span>
                          <span>{retrainProgress}%</span>
                        </div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#39ff14]" style={{ width: `${retrainProgress}%` }} />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleRetrain}
                      disabled={retrainProgress !== null}
                      className="w-full bg-[#39ff14] hover:bg-[#39ff14]/85 text-black disabled:bg-white/5 disabled:text-gray-600 text-[9px] font-bold py-2 uppercase text-center"
                    >
                      TRIGGER NEURAL RETRAIN
                    </button>
                  </div>
                </div>
              )}

              {/* 3. INVESTIGATOR CREDENTIALS (REVAMPED PROFILE) */}
              {win.type === 'profile' && (
                <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-[10px] font-bold text-white tracking-widest uppercase">Investigator Credentials</h3>
                    <p className="text-[8px] text-gray-500 font-mono mt-0.5">Edit active session security profile values</p>
                  </div>

                  <form onSubmit={handleProfileSubmit} className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] text-gray-500 font-bold font-mono">ASSIGNED POSITION / ROLE</label>
                      <input
                        type="text"
                        value={user?.role || 'Lead Investigator'}
                        disabled
                        className="bg-black/20 border border-white/5 text-gray-500 text-[9px] px-3 py-1.5 outline-none font-mono cursor-not-allowed uppercase"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] text-gray-500 font-bold font-mono">FULL CREDENTIAL NAME</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="bg-black border border-white/10 text-gray-200 text-[9px] px-3 py-1.5 focus:border-[#39ff14] outline-none"
                      />
                    </div>

                    {!showProfilePassInput ? (
                      <div className="flex justify-start">
                        <button
                          type="button"
                          onClick={() => setShowProfilePassInput(true)}
                          className="px-3 py-1.5 bg-[#39ff14]/15 border border-[#39ff14] hover:bg-[#39ff14]/25 text-[#39ff14] text-[9px] font-bold uppercase tracking-wider transition-all"
                        >
                          CHANGE PASSPHRASE
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[8px] text-gray-500 font-bold font-mono">NEW SESSION SECURITY KEY (PASSPHRASE)</label>
                          <input
                            type="password"
                            placeholder="Enter new security key..."
                            value={profilePass}
                            onChange={(e) => setProfilePass(e.target.value)}
                            className="bg-black border border-white/10 text-gray-200 text-[9px] px-3 py-1.5 focus:border-[#39ff14] outline-none w-full font-mono"
                            required
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfilePassInput(false);
                              setProfilePass('');
                            }}
                            className="text-[8px] text-gray-500 hover:text-white uppercase font-bold"
                          >
                            Cancel password change
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={profileUpdating}
                      className="w-full bg-[#a855f7] hover:bg-[#a855f7]/85 text-black disabled:bg-white/5 disabled:text-gray-600 text-[9px] font-bold py-2 uppercase text-center mt-2"
                    >
                      {profileUpdating ? 'UPDATING SECURE CONFIG...' : 'UPDATE CREDENTIAL CONFIG'}
                    </button>
                  </form>

                  {user?.badgeNumber === 'INV-001' && (
                    <div className="mt-6 border-t border-white/5 pt-4">
                      <div className="border-b border-white/5 pb-2 mb-3">
                        <h4 className="text-[9px] font-bold text-[#39ff14] tracking-widest uppercase">Pending Registrations</h4>
                        <p className="text-[8px] text-gray-500 font-mono mt-0.5">Approve or deny new investigator registration requests</p>
                      </div>

                      <div className="flex flex-col gap-2">
                        {loadingPending ? (
                          <span className="text-[8px] text-gray-500 font-mono animate-pulse">FETCHING PENDING REGISTRATIONS...</span>
                        ) : pendingApprovals.length === 0 ? (
                          <span className="text-[8px] text-gray-600 font-mono italic">No pending registration requests.</span>
                        ) : (
                          pendingApprovals.map((req) => (
                            <div key={req.id} className="bg-black/40 border border-white/5 rounded-xl p-3 flex items-center justify-between gap-3">
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="text-[9px] font-bold text-white truncate font-mono uppercase">{req.full_name}</span>
                                <span className="text-[8px] text-gray-500 font-mono">BADGE ID: {req.badge_id}</span>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleApprove(req.id, req.full_name)}
                                  className="px-2 py-1 bg-[#39ff14]/15 border border-[#39ff14] hover:bg-[#39ff14]/25 text-[#39ff14] text-[8px] font-bold uppercase transition-all"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(req.id, req.full_name)}
                                  className="px-2 py-1 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 text-[8px] font-bold uppercase transition-all"
                                >
                                  Deny
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. DOSSIER EXPLORER */}
              {win.type === 'cases_explorer' && (
                <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-[10px] font-bold text-gray-300 uppercase">File Path: C://cases/list</span>
                    <button
                      onClick={handleCreateCase}
                      className="text-[8px] font-bold border border-[#39ff14]/50 hover:bg-[#39ff14]/10 text-[#39ff14] px-2 py-1 uppercase"
                    >
                      + Initialize File
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-2.5 py-1 rounded focus-within:border-[#39ff14] transition-all w-full pointer-events-auto flex-shrink-0">
                    <Search size={10} className="text-gray-500" />
                    <input
                      type="text"
                      placeholder="SEARCH CASE FILES..."
                      value={explorerSearchQuery}
                      onChange={(e) => setExplorerSearchQuery(e.target.value)}
                      className="bg-transparent border-none text-gray-200 placeholder-gray-600 text-[9px] font-mono outline-none w-full uppercase"
                    />
                    {explorerSearchQuery && (
                      <button
                        onClick={() => setExplorerSearchQuery('')}
                        className="text-gray-500 hover:text-gray-350 text-[8px] font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {cases.filter(c => c.title.toLowerCase().includes(explorerSearchQuery.toLowerCase())).map(c => (
                      <div
                        key={c.caseId}
                        onClick={() => {
                          closeWindow(win.id);
                          openWindow(
                            `workspace-${c.caseId}`,
                            `Case Workspace: ${c.title}`,
                            'case_workspace',
                            { caseId: c.caseId }
                          );
                        }}
                        className="p-3 bg-white/5 border border-white/10 hover:border-[#39ff14]/50 cursor-pointer transition flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <Folder size={18} className="text-[#a855f7] group-hover:text-[#39ff14] transition-colors" />
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-gray-200">{c.title}</span>
                            <span className="text-[8px] text-gray-500 font-mono mt-0.5">{c.caseId}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCase(e, c.caseId, c.title);
                          }}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })}

      {/* Floating System Dock (Taskbar) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-14 bg-[#080d16]/75 border border-white/10 backdrop-blur-xl rounded-2xl flex items-center px-4 gap-3 z-[999] shadow-2xl">
        <button
          onClick={handleCreateCase}
          title="Create New Case File"
          className="w-10 h-10 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors flex items-center justify-center text-gray-300 hover:text-[#39ff14]"
        >
          <Plus size={20} />
        </button>

        <div className="h-6 w-[1px] bg-white/10" />

        {/* Launchers */}
        <button
          onClick={() => openWindow('cases_explorer', 'Case File Explorer', 'cases_explorer')}
          title="Dossier Files Explorer"
          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${windows.some(w => w.id === 'cases_explorer') ? 'text-[#39ff14] bg-white/5 border border-white/10' : 'text-gray-300 hover:text-[#39ff14] hover:bg-white/5'}`}
        >
          <Compass size={20} />
        </button>

        <button
          onClick={() => openWindow('profile_window', 'Investigator Credentials', 'profile')}
          title="Profile Panel"
          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${windows.some(w => w.id === 'profile_window') ? 'text-[#39ff14] bg-white/5 border border-white/10' : 'text-gray-300 hover:text-[#39ff14] hover:bg-white/5'}`}
        >
          <User size={20} />
        </button>

        <button
          onClick={() => openWindow('settings_window', 'Core Parameters Console', 'settings')}
          title="Neural config console"
          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${windows.some(w => w.id === 'settings_window') ? 'text-[#39ff14] bg-white/5 border border-white/10' : 'text-gray-300 hover:text-[#39ff14] hover:bg-white/5'}`}
        >
          <Settings size={20} />
        </button>

        <div className="h-6 w-[1px] bg-white/10" />

        {/* Minimized / Active Window Task list */}
        {windows.map(w => {
          const isOpen = !w.isMinimized;
          return (
            <button
              key={`task-${w.id}`}
              onClick={() => toggleMinimize(w.id)}
              className={`px-3 h-10 rounded-xl transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${isOpen ? 'bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]' : 'bg-white/5 border border-white/5 text-gray-500 hover:text-white'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-[#39ff14] animate-pulse' : 'bg-gray-600'}`} />
              <span className="max-w-[70px] truncate">{w.title.replace('Case Workspace: ', '').replace('Case Analysis: ', '')}</span>
            </button>
          );
        })}

        <div className="h-6 w-[1px] bg-white/10" />

        {/* Disconnect */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          title="Disconnect Investigator Session"
          className="w-10 h-10 rounded-xl hover:bg-red-500/10 active:bg-red-500/20 transition-colors flex items-center justify-center text-gray-500 hover:text-red-400"
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* Custom Context Menu, Rename Modal, and Delete Confirmation Modal */}
      {contextMenu && (
        <div
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          className="fixed inset-0 z-[100000]"
        >
          <div
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
            }}
            className="bg-[#04080e]/95 border border-white/10 p-1 flex flex-col min-w-[130px] shadow-2xl backdrop-blur-xl z-[100001]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setContextMenu(null);
                handleTriggerRename(contextMenu.caseId, contextMenu.title);
              }}
              className="text-left font-mono text-[9px] font-bold text-gray-300 hover:bg-[#39ff14]/10 hover:text-[#39ff14] px-3 py-2 w-full transition-colors uppercase tracking-wider"
            >
              RENAME DOSSIER
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                setDeleteConfirmCase({ id: contextMenu.caseId, title: contextMenu.title });
              }}
              className="text-left font-mono text-[9px] font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 px-3 py-2 w-full transition-colors uppercase tracking-wider"
            >
              DELETE DOSSIER
            </button>
          </div>
        </div>
      )}

      {renameCaseState && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-[#39ff14] p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-[#39ff14]/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-[#39ff14] tracking-widest uppercase pb-2 border-b border-white/5">
              RENAME CASE FILE
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[8px] text-gray-500 uppercase tracking-wider">NEW DOSSIER TITLE</span>
              <input
                type="text"
                value={renameCaseState.newTitle}
                onChange={(e) => setRenameCaseState({ ...renameCaseState, newTitle: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setRenameCaseState(null);
                }}
                className="bg-black/40 border border-white/10 text-gray-100 text-xs px-3 py-2 rounded focus:border-[#39ff14] outline-none font-mono w-full transition-all"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5 mt-2">
              <button
                onClick={() => setRenameCaseState(null)}
                className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveRename}
                className="px-3.5 py-1.5 bg-[#39ff14]/15 border border-[#39ff14] hover:bg-[#39ff14]/25 text-[#39ff14] rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
              >
                SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCase && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-red-500 p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-red-500/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-red-500 tracking-widest uppercase pb-2 border-b border-white/5">
              CONFIRM DOSSIER DELETION
            </div>
            <div className="font-mono text-[10px] text-gray-400 leading-relaxed">
              ARE YOU SURE YOU WANT TO PERMANENTLY DELETE CASE <span className="text-white font-bold">"{deleteConfirmCase.title}"</span>?
              <br /><br />
              THIS WILL IRREVERSIBLY ERASE ALL INGESTED IDENTIFIERS, CORRELATED SUSPECT PROFILES, AND NOTES.
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5 mt-2">
              <button
                onClick={() => setDeleteConfirmCase(null)}
                className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
              >
                DELETE DOSSIER
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-red-500 p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-red-500/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-red-500 tracking-widest uppercase pb-2 border-b border-white/5">
              CONFIRM DISCONNECT
            </div>
            <div className="font-mono text-[10px] text-gray-400 leading-relaxed">
              ARE YOU SURE YOU WANT TO TERMINATE THE ACTIVE INVESTIGATOR SESSION?
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5 mt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                  window.location.href = '/';
                }}
                className="px-3.5 py-1.5 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
              >
                DISCONNECT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
