import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useCaseStore } from '../state/caseStore';
import type { GraphData, GraphNode } from '../types/graph';
import { useUIStore } from '../state/uiStore';
import { useAuth } from '../hooks/useAuth';
import { useGraphStore } from '../state/graphStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { Plus, X, Maximize2, Minimize2, Terminal, Shield, Folder, Network, Search, Filter, History, Share2, Compass, Edit, FileText, Download, User, Menu, Globe, LogOut, RefreshCw, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Transliterate, useTransliterate } from '../components/ui/Transliterate';

import { DashboardContext } from './DashboardContext';
import { CaseWindow } from '../components/cases/CaseWindow';
import { ProfileWindow } from '../components/cases/ProfileWindow';
import { ExplorerWindow } from '../components/cases/ExplorerWindow';
import { CrossCorrelationWindow } from '../components/cases/CrossCorrelationWindow';
import { GeoMapWindow } from '../components/ui/GeoMapWindow';
import { NotificationPanel } from '../components/ui/NotificationPanel';
import { useTutorialStore } from '../state/tutorialStore';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { DemoTour } from '../components/tutorial/DemoTour';

import {
  triggerModelRetrain,
  updateInvestigatorProfile,
  submitIdentifiers,
  getNarrative,
  exportCaseJSON,
  exportCaseCSV,
  exportCasePDF,
  getPendingApprovals,
  approveInvestigator,
  rejectInvestigator,
  getAuditLogs
} from '../api/endpoints';

interface WindowState {
  id: string;
  title: string;
  type: 'case_workspace' | 'profile' | 'cases_explorer' | 'cross_correlate' | 'geo_map';
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

import { LanguageSwitcher } from '../components/ui/LanguageSwitcher';

export interface PendingApproval {
  id: string;
  badge_id: string;
  full_name: string;
  created_at: string;
}

export default function CaseDashboardPage() {
  const transliterate = useTransliterate();
  const { t } = useTranslation();
  const { cases, loadCases, initializeNewCase, deleteCase, renameCase } = useCaseStore();
  const { showToast } = useUIStore();
  const { user, logout } = useAuth();
  const { loadEntityGraph, graphData } = useGraphStore();
  const { startTutorial, startDemo } = useTutorialStore();

  const handleStartDemo = () => {
    startDemo();
  };

  // --- STATE DECLARATIONS ---
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [wallpaperIdx, setWallpaperIdx] = useState(0);
  const [customWallpaper, setCustomWallpaper] = useState<string | null>(null);
  const [showWallpaperMenu, setShowWallpaperMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; caseId: string; title: string } | null>(null);
  const [dockContextMenu, setDockContextMenu] = useState<{ x: number; y: number; windowId: string; title: string } | null>(null);
  const [renameCaseState, setRenameCaseState] = useState<{ id: string; title: string; newTitle: string } | null>(null);
  const [deleteConfirmCase, setDeleteConfirmCase] = useState<{ id: string; title: string } | null>(null);

  const [hudLogs, setHudLogs] = useState<string[]>(MOCK_HUD_LOGS);

  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePass, setProfilePass] = useState('');
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const [retrainLogs, setRetrainLogs] = useState<string[]>([]);
  const [retrainProgress, setRetrainProgress] = useState<number | null>(null);

  const [caseCreating, setCaseCreating] = useState(false);
  const [approvingIds, setApprovingIds] = useState<Record<string, 'approve' | 'reject' | null>>({});
  const [reportLoadingPerCase, setReportLoadingPerCase] = useState<Record<string, boolean>>({});
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [focusedCaseId, setFocusedCaseId] = useState<string | null>(null);

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

  const windowsRef = useRef(windows);
  useEffect(() => {
    windowsRef.current = windows;
  }, [windows]);

  const handlePipelineCompleted = useCallback((caseId: string) => {
    setCaseIngestProgress(prev => {
      if (prev[caseId] !== undefined && prev[caseId] !== null) {
        return { ...prev, [caseId]: 100 };
      }
      return prev;
    });

    setTimeout(() => {
      setCaseIngestProgress(prev => {
        if (prev[caseId] !== undefined && prev[caseId] !== null) {
          showToast('Correlation mesh constructed successfully', 'success');
          return { ...prev, [caseId]: null };
        }
        return prev;
      });
    }, 500);
  }, [showToast]);

  const activeCaseId = windows.find(w => w.id === activeWindowId && w.type === 'case_workspace')?.caseId;
  const hasOpenCaseWindow = windows.some(w => w.type === 'case_workspace' && !w.isMinimized);
  useWebSocket(activeCaseId, hasOpenCaseWindow, handlePipelineCompleted);

  useEffect(() => {
    if (graphData && activeCaseId) {
      Promise.resolve().then(() => {
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
      });
    }
  }, [graphData, activeCaseId]);


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
      if (deleteConfirmCase.id === 'multiple') {
        const ids = [...selectedCaseIds];
        let successCount = 0;
        for (const id of ids) {
          try {
            await deleteCase(id);
            closeWindow(`workspace-${id}`);
            successCount++;
          } catch (e) {
            console.error(`Failed to delete case ${id}`, e);
          }
        }
        showToast(`${successCount} cases archived successfully`, 'success');
        setSelectedCaseIds([]);
      } else {
        await deleteCase(deleteConfirmCase.id);
        closeWindow(`workspace-${deleteConfirmCase.id}`);
        showToast(`Case ${deleteConfirmCase.id} deleted`, 'success');
        setSelectedCaseIds(prev => prev.filter(id => id !== deleteConfirmCase.id));
      }
      setDeleteConfirmCase(null);
    } catch {
      showToast('Failed to delete case(s)', 'error');
    }
  };


  const handleZoom = (e: any, caseId: string) => {
    const currentZoom = caseZoom[caseId] || 1.0;
    
    // Differentiate between pinch-to-zoom (ctrlKey) and normal mouse scrolls
    let factor = 0.002;
    if (e.ctrlKey) {
      factor = 0.02; // Boost sensitivity for pinch gestures
    }
    
    const delta = e.deltaY;
    // Suppress tiny trackpad drift scrolling to minimize event flooding
    if (Math.abs(delta) < 1.5 && !e.ctrlKey) return;
    
    const scaleFactor = Math.exp(-delta * factor);
    const nextZoom = Math.min(3.0, Math.max(0.3, currentZoom * scaleFactor));
    
    // Avoid triggering heavy DOM updates for negligible scale changes
    if (Math.abs(currentZoom - nextZoom) < 0.01) return;

    setCaseZoom(prev => {
      const prevVal = prev[caseId] || 1.0;
      if (Math.abs(prevVal - nextZoom) < 0.01) return prev;
      return {
        ...prev,
        [caseId]: nextZoom
      };
    });
  };

  const handleSvgMouseDown = (e: React.MouseEvent, caseId: string) => {
    // Pan on left click (button 0) or right click (button 2)
    if (e.button !== 0 && e.button !== 2) return;

    // For left-click, only pan if clicked directly on background
    const target = e.target as SVGElement;
    if (e.button === 0 && target.tagName !== 'svg' && target.tagName !== 'rect') {
      return;
    }

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
    const isMultiple = selectedCaseIds.includes(sourceCaseId);
    const idsToMove = isMultiple ? selectedCaseIds.filter(id => currentOrder.includes(id)) : [sourceCaseId];

    if (idsToMove.includes(targetCaseId)) {
      setDraggedCaseId(null);
      return;
    }

    const filteredOrder = currentOrder.filter(id => !idsToMove.includes(id));
    const targetIndex = filteredOrder.indexOf(targetCaseId);

    if (targetIndex !== -1) {
      const nextOrder = [...filteredOrder];
      nextOrder.splice(targetIndex, 0, ...idsToMove);

      setCaseOrder(nextOrder);
      localStorage.setItem('erakshak_case_order', JSON.stringify(nextOrder));
      showToast(`Reordered ${idsToMove.length} case(s)`, 'success');
    }
    setDraggedCaseId(null);
  };

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  // Auto-trigger demo tour on first visit
  useEffect(() => {
    const seen = localStorage.getItem('er_demo_seen');
    if (!seen) {
      // Small delay to let the dashboard fully render
      const t = setTimeout(() => startDemo(), 900);
      return () => clearTimeout(t);
    }
  }, [startDemo]);

  useEffect(() => {
    if (cases.length > 0) {
      const caseIds = cases.map(c => c.caseId);
      const next = caseOrder.filter(id => id.includes('c-') || caseIds.includes(id));
      const missing = caseIds.filter(id => !next.includes(id));
      if (missing.length > 0 || next.length !== caseOrder.length) {
        const updated = [...next, ...missing];
        localStorage.setItem('erakshak_case_order', JSON.stringify(updated));
        const timer = setTimeout(() => {
          setCaseOrder(updated);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [cases, caseOrder]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.getAttribute('contenteditable') === 'true'
      )) {
        return;
      }

      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Space', ' '];
      if (!keys.includes(e.key)) return;

      if (sortedCases.length === 0) return;

      e.preventDefault();

      let nextIndex = 0;
      if (focusedCaseId) {
        const currentIndex = sortedCases.findIndex(c => c.caseId === focusedCaseId);
        if (currentIndex !== -1) {
          nextIndex = currentIndex;
          
          let columns = 4;
          const grid = document.querySelector('.desktop-grid-container');
          if (grid) {
            const items = grid.querySelectorAll('.case-folder-item');
            if (items.length > 0) {
              const firstTop = items[0].getBoundingClientRect().top;
              let colCount = 0;
              for (let i = 0; i < items.length; i++) {
                if (Math.abs(items[i].getBoundingClientRect().top - firstTop) < 5) {
                  colCount++;
                } else {
                  break;
                }
              }
              if (colCount > 0) columns = colCount;
            }
          }

          if (e.key === 'ArrowLeft') {
            nextIndex = Math.max(0, currentIndex - 1);
          } else if (e.key === 'ArrowRight') {
            nextIndex = Math.min(sortedCases.length - 1, currentIndex + 1);
          } else if (e.key === 'ArrowUp') {
            nextIndex = Math.max(0, currentIndex - columns);
          } else if (e.key === 'ArrowDown') {
            nextIndex = Math.min(sortedCases.length - 1, currentIndex + columns);
          }
        }
      }

      const targetCase = sortedCases[nextIndex];
      if (!targetCase) return;

      if (e.key === 'Enter') {
        openWindow(
          `workspace-${targetCase.caseId}`,
          t('dashboard.case_workspace', { title: targetCase.title }),
          'case_workspace',
          { caseId: targetCase.caseId }
        );
      } else if (e.key === 'Space' || e.key === ' ') {
        setSelectedCaseIds(prev => {
          if (prev.includes(targetCase.caseId)) {
            return prev.filter(id => id !== targetCase.caseId);
          } else {
            return [...prev, targetCase.caseId];
          }
        });
      } else {
        setFocusedCaseId(targetCase.caseId);
        if (e.shiftKey) {
          setSelectedCaseIds(prev => {
            if (prev.includes(targetCase.caseId)) {
              return prev;
            } else {
              return [...prev, targetCase.caseId];
            }
          });
        } else {
          setSelectedCaseIds([targetCase.caseId]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCaseId, sortedCases, selectedCaseIds, openWindow, t]);

  // Fetch real backend audit logs periodically
  useEffect(() => {
    const fetchLogs = async () => {
      const hasActiveWindows = windowsRef.current.length > 0 && windowsRef.current.some(w => !w.isMinimized);
      if (!hasActiveWindows) return;
      try {
        const data = await getAuditLogs();
        if (data && Array.isArray(data)) {
          const formatted = (data as Array<{ timestamp: string; action: string; detail?: Record<string, string> }>).map((log) => {
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

    const timer = setInterval(fetchLogs, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024); // 1024px represents tailwind 'lg' boundary where right HUD + folders collide
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  function openWindow(id: string, title: string, type: WindowState['type'], extraProps: Partial<WindowState> = {}) {
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
    if (e.button !== 0) return;

    const win = windows.find(w => w.id === id);
    if (!win || win.isMaximized) return;

    focusWindow(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = win.x;
    const initY = win.y;

    // Minimum Y offset to prevent window top bar from going higher than the top dashboard bar (h-8 = 32px / 2rem)
    const TOP_BAR_HEIGHT = 32;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setWindows(prev =>
        prev.map(w => {
          if (w.id === id) {
            return {
              ...w,
              x: Math.max(0, initX + dx),
              y: Math.max(TOP_BAR_HEIGHT, initY + dy)
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

  const handleResizeStart = (e: React.MouseEvent, id: string, direction: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    const win = windows.find(w => w.id === id);
    if (!win || win.isMaximized) return;

    focusWindow(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = win.x;
    const initY = win.y;
    const initW = win.width;
    const initH = win.height;

    const MIN_WIDTH = 400;
    const MIN_HEIGHT = 300;
    const TOP_BAR_HEIGHT = 32;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setWindows(prev =>
        prev.map(w => {
          if (w.id === id) {
            let newX = initX;
            let newY = initY;
            let newW = initW;
            let newH = initH;

            // Horizontal resizing
            if (direction.includes('e')) {
              newW = Math.max(MIN_WIDTH, initW + dx);
            } else if (direction.includes('w')) {
              const maxPossibleDx = initW - MIN_WIDTH;
              const actualDx = Math.min(dx, maxPossibleDx);
              newX = initX + actualDx;
              newW = initW - actualDx;
            }

            // Vertical resizing
            if (direction.includes('s')) {
              newH = Math.max(MIN_HEIGHT, initH + dy);
            } else if (direction.includes('n')) {
              const maxPossibleDy = initH - MIN_HEIGHT;
              const requestedY = initY + dy;
              const clampedY = Math.max(TOP_BAR_HEIGHT, requestedY);
              const actualDy = clampedY - initY;
              if (actualDy <= maxPossibleDy) {
                newY = initY + actualDy;
                newH = initH - actualDy;
              }
            }

            return {
              ...w,
              x: newX,
              y: newY,
              width: newW,
              height: newH
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
    const idx = graph.nodes.findIndex((n: GraphNode) => n.id === nodeId);
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

  const loadGraphForCase = useCallback(async (caseId: string, entityId: string) => {
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
  }, [loadEntityGraph]);

  useEffect(() => {
    if (cases.length === 0) return;
    if (!hasOpenCaseWindow) return;

    const validCase = cases.find(c => c.caseId === lastAccessedCaseId);
    const targetId = validCase ? validCase.caseId : cases[0].caseId;

    if (!validCase) {
      localStorage.setItem('er_last_accessed_case', targetId);
      Promise.resolve().then(() => {
        setLastAccessedCaseId(targetId);
      });
    }

    loadGraphForCase(targetId, 'n1').catch(err => {
      console.warn("Failed to prefetch graph for case:", err);
    });
  }, [lastAccessedCaseId, cases, hasOpenCaseWindow, loadGraphForCase]);

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
          {nodes.map((n) => {
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
                    {transliterate(n.label.substring(0, 10).toUpperCase())}
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
    setCaseCreating(true);
    try {
      let caseNumber = cases.length + 1;
      let title = `Investigation #${caseNumber} — AD HOC`;
      while (cases.some(c => c.title.toLowerCase() === title.toLowerCase())) {
        caseNumber++;
        title = `Investigation #${caseNumber} — AD HOC`;
      }
      const newCase = await initializeNewCase(title, 'Ad-hoc initialized case file');
      showToast(`${title.toUpperCase()} INITIALIZED`, 'success');
      openWindow(
        `workspace-${newCase.caseId}`,
        `Case Workspace: ${newCase.title}`,
        'case_workspace',
        { caseId: newCase.caseId, activeTab: 'intake' }
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to initialize case', 'error');
    } finally {
      setCaseCreating(false);
    }
  };

  const handleDeleteCase = (e: React.MouseEvent, caseId: string, title: string) => {
    e.stopPropagation();
    if (selectedCaseIds.includes(caseId)) {
      setDeleteConfirmCase({ id: 'multiple', title: `${selectedCaseIds.length} selected cases` });
    } else {
      setDeleteConfirmCase({ id: caseId, title });
    }
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
  const runIngestPipeline = async (caseId: string, overrideSeeds?: Array<{ type: string; value: string }>) => {
    const seeds = overrideSeeds || casePendingSeeds[caseId] || [];
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

    const timer = setInterval(() => {
      setCaseIngestProgress(prev => {
        const currentProgress = prev[caseId] || 0;
        if (currentProgress < 90) {
          const nextProgress = currentProgress + 10;
          
          const stageIdx = Math.floor(nextProgress / 20);
          if (stages[stageIdx]) {
            setCaseIngestLogs(logsPrev => {
              const current = logsPrev[caseId] || [];
              if (!current.includes(stages[stageIdx])) {
                return { ...logsPrev, [caseId]: [...current, stages[stageIdx]] };
              }
              return logsPrev;
            });
          }

          return { ...prev, [caseId]: nextProgress };
        } else {
          clearInterval(timer);
          return prev;
        }
      });
    }, 400);

    try {
      await apiPromise;
      
      setCasePendingSeeds(prev => ({ ...prev, [caseId]: [] }));
      
      // Switch to Graph tab
      setWindows(prev =>
        prev.map(w => (w.caseId === caseId ? { ...w, activeTab: 'graph' } : w))
      );
      
      // We do NOT clear the loading bar here. The WebSocket handlePipelineCompleted callback will do it!
    } catch {
      clearInterval(timer);
      showToast('Backend ingestion pipeline failed', 'error');
      setCaseIngestProgress(prev => ({ ...prev, [caseId]: null }));
    }
  };


  // Fetch and display narrative AI report (caches existing report unless forceRegenerate is true)
  const fetchNarrativeReport = async (caseId: string, forceRegenerate = false) => {
    if (!forceRegenerate && caseReportNarrative[caseId] && caseReportNarrative[caseId].trim().length > 0) {
      return;
    }
    setReportLoadingPerCase(prev => ({ ...prev, [caseId]: true }));
    try {
      showToast('Generating AI narrative synthesis...', 'info');
      const res = await getNarrative(caseId);
      setCaseReportNarrative(prev => ({
        ...prev,
        [caseId]: res.narrative
      }));
    } catch {
      showToast('Failed to generate report narrative', 'error');
    } finally {
      setReportLoadingPerCase(prev => ({ ...prev, [caseId]: false }));
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileUpdating(true);
    try {
      await updateInvestigatorProfile(profileName, profilePass || undefined);
      showToast('Credentials updated successfully', 'success');
      setProfilePass('');
    } catch {
      showToast('Failed to update credentials', 'error');
    } finally {
      setProfileUpdating(false);
    }
  };

  const fetchPendingApprovals = useCallback(async () => {
    if (user?.badgeNumber !== 'INV-001') return;
    Promise.resolve().then(() => setLoadingPending(true));
    try {
      const res = await getPendingApprovals();
      setPendingApprovals(res as PendingApproval[]);
    } catch (err) {
      console.error('Failed to fetch pending approvals', err);
    } finally {
      setLoadingPending(false);
    }
  }, [user]);

  const handleApprove = async (id: string, name: string) => {
    setApprovingIds(prev => ({ ...prev, [id]: 'approve' }));
    try {
      await approveInvestigator(id);
      showToast(`APPROVED REGISTRATION FOR ${name.toUpperCase()}`, 'success');
      fetchPendingApprovals();
    } catch {
      showToast('FAILED TO APPROVE INVESTIGATOR', 'error');
    } finally {
      setApprovingIds(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleReject = async (id: string, name: string) => {
    setApprovingIds(prev => ({ ...prev, [id]: 'reject' }));
    try {
      await rejectInvestigator(id);
      showToast(`DENIED REGISTRATION FOR ${name.toUpperCase()}`, 'success');
      fetchPendingApprovals();
    } catch {
      showToast('FAILED TO DENY INVESTIGATOR', 'error');
    } finally {
      setApprovingIds(prev => ({ ...prev, [id]: null }));
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchPendingApprovals();
    });
  }, [fetchPendingApprovals]);

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
        } catch {
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
      const name = `Dossier_Export_${caseId}.${format}`;
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
    } catch {
      showToast('Failed to export data', 'error');
    }
  };


  const contextValue = {
    activeEntityPerCase, setActiveEntityPerCase,
    nodePositionsPerCase, setNodePositionsPerCase,
    caseSeedsInput, setCaseSeedsInput,
    casePendingSeeds, setCasePendingSeeds,
    caseIngestProgress, setCaseIngestProgress,
    caseIngestLogs, setCaseIngestLogs,
    caseReportNarrative,
    caseZoom, setCaseZoom,
    casePan, setCasePan,
    graphDataPerCase,
    graphData,
    dossierSearchQuery, setDossierSearchQuery,
    explorerSearchQuery, setExplorerSearchQuery,
    lastAccessedCaseId,
    retrainLogs, retrainProgress,
    profileName, setProfileName,
    profilePass, setProfilePass,
    profileUpdating,
    showProfilePassInput, setShowProfilePassInput,
    pendingApprovals, loadingPending,
    caseCreating, approvingIds, reportLoadingPerCase,
    cases, user,
    handleNodeDrag, handleZoom, handleSvgMouseDown,
    addCaseSeed, removeCaseSeed, runIngestPipeline,
    fetchNarrativeReport, triggerExport, handleGoToNode,
    loadGraphForCase, getNodeAbbreviation,
    handleRetrain, handleProfileSubmit, handleApprove, handleReject,
    handleCreateCase, handleDeleteCase,
    setWindows, closeWindow, openWindow
  };
  return (
    <DashboardContext.Provider value={contextValue}>
    <div
      ref={desktopRef}
      className="relative w-full h-full overflow-hidden select-none bg-black text-gray-300"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setWindows(prev => prev.map(w => w.type === 'case_workspace' ? { ...w, isMinimized: true } : w));
          setActiveWindowId(null);
        }
      }}
      style={{
        backgroundImage: customWallpaper || currentWallpaper.value,
        backgroundColor: 'black',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'background-image 0.5s ease',
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
      <div className="absolute top-0 left-0 right-0 h-8 bg-black/60 backdrop-blur-md border-b border-[#39ff14]/15 flex items-center justify-between px-2 sm:px-4 z-[999] text-[10px]">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink-0">
          <span className="font-bold tracking-wider text-[#39ff14] flex items-center gap-1.5 animate-pulse whitespace-nowrap">
            <Shield size={12} />
            <span className="hidden sm:inline">{t('dashboard.console_title')}</span>
            <span className="sm:hidden">ORION</span>
          </span>
          {!isMobile && (
            <>
              <div className="h-3 w-[1px] bg-white/10" />
              <button
                onClick={handleStartDemo}
                className="text-[9px] text-[#39FF14] hover:text-white uppercase tracking-wider transition-colors whitespace-nowrap animate-pulse"
              >
                START DEMO
              </button>
              <div className="h-3 w-[1px] bg-white/10" />
              <button
                onClick={() => setShowWallpaperMenu(!showWallpaperMenu)}
                className="text-[9px] text-gray-400 hover:text-white uppercase tracking-wider transition-colors whitespace-nowrap"
              >
                {t('dashboard.wallpaper')}
              </button>
            </>
          )}
          {isMobile && (
            <button
              onClick={() => setShowSidebarOnMobile(!showSidebarOnMobile)}
              className={`text-[9px] uppercase tracking-wider transition-colors flex items-center gap-1 flex-shrink-0 ${showSidebarOnMobile ? 'text-[#39ff14] font-bold' : 'text-gray-400 hover:text-white'}`}
            >
              <Terminal size={10} /> {showSidebarOnMobile ? 'HUD ✕' : 'HUD'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-[9px] text-gray-400 font-medium pointer-events-auto flex-shrink-0">
          <LanguageSwitcher />
          {!isMobile && (
            <>
              <div className="h-3 w-[1px] bg-white/10" />
              <span data-tutorial="profile-menu" className="whitespace-nowrap">{t('dashboard.badge_label')} <span className="text-[#39ff14] font-bold">{user?.badgeNumber}</span></span>
              <div className="h-3 w-[1px] bg-white/10" />
              <span className="flex items-center gap-1 text-[#39ff14] whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-ping" /> {t('dashboard.core_ready')}
              </span>
            </>
          )}
          {isMobile && (
            <span className="flex items-center gap-1 text-[#39ff14]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-ping" />
            </span>
          )}
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
              <span>{t('dashboard.custom_file')}</span>
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
            <span className="text-[7.5px] text-gray-500 font-mono">{t('dashboard.paste_url')}</span>
            <input
              type="text"
              placeholder={t('dashboard.url_placeholder')}
              onKeyDown={handleWallpaperUrlKeyDown}
              className="w-full bg-black border border-white/10 text-gray-300 text-[8px] px-1 py-0.5 focus:border-[#39ff14] outline-none"
            />
          </div>
        </div>
      )}

      {/* Shift-Click Multi-Select Action Bar HUD */}
      {selectedCaseIds.length > 0 && (
        <div 
          className="absolute top-14 left-1/2 -translate-x-1/2 bg-[#080d16]/95 border border-indigo-500/50 rounded-xl px-4 py-2 flex items-center gap-4 z-[99] shadow-2xl shadow-indigo-500/10 backdrop-blur-xl pointer-events-auto"
        >
          <span className="font-mono text-[9px] font-bold text-indigo-400 tracking-wider uppercase">
            {selectedCaseIds.length} {selectedCaseIds.length === 1 ? t('dashboard.case_selected') : t('dashboard.cases_selected')}
          </span>
          <div className="h-3 w-[1px] bg-white/10" />
          <button
            onClick={() => setDeleteConfirmCase({ id: 'multiple', title: `${selectedCaseIds.length} selected cases` })}
            className="bg-red-500/15 border border-red-500 hover:bg-red-500/25 text-red-400 text-[9px] font-bold font-mono px-2 py-1 uppercase rounded transition-all flex items-center gap-1.5"
          >
            <X size={10} />
            {t('dashboard.archive_selected')}
          </button>
          <button
            onClick={() => setSelectedCaseIds([])}
            className="text-gray-400 hover:text-white font-mono text-[9px] font-bold uppercase transition-colors"
          >
            {t('dashboard.clear_selection')}
          </button>
        </div>
      )}

      {/* Scrollable Desktop Area for Folders */}
      <div
        className={`absolute top-12 bottom-20 left-6 ${isMobile ? 'right-6' : 'right-[440px]'} overflow-y-auto pointer-events-auto z-10 pr-2 custom-desktop-scrollbar`}
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 pb-6 desktop-grid-container">
          {/* Initialize Case Icon */}
          <div
            data-tutorial="init-case"
            onClick={caseCreating ? undefined : handleCreateCase}
            className={`flex flex-col items-center justify-center p-2 rounded border border-dashed border-[#39ff14]/30 bg-[#39ff14]/5 hover:bg-[#39ff14]/15 hover:border-[#39ff14] group transition-all duration-150 cursor-pointer pointer-events-auto text-center h-[110px] w-full max-w-[120px] mx-auto flex-shrink-0 ${caseCreating ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <div className="w-10 h-10 flex items-center justify-center text-[#39ff14]">
              {caseCreating ? (
                <RefreshCw size={28} className="animate-spin" />
              ) : (
                <Plus size={32} className="group-hover:scale-110 transition-transform" />
              )}
            </div>
            <span className="mt-1 text-[11px] font-bold text-gray-300 tracking-wider group-hover:text-white uppercase line-clamp-2 leading-tight">
              {t('dashboard.initialize')}
            </span>
          </div>

          {/* Dynamic Case Folders */}
          {sortedCases.map(c => {
            const isAnalysisOpen = windows.some(w => w.id === `workspace-${c.caseId}`);
            const isSelected = selectedCaseIds.includes(c.caseId);

            return (
              <div
                key={c.caseId}
                draggable={true}
                onDragStart={(e) => handleDragStartCase(e, c.caseId)}
                onDragEnd={() => setDraggedCaseId(null)}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => handleDropCase(e, c.caseId)}
                onClick={(e) => {
                  setFocusedCaseId(c.caseId);
                  if (e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedCaseIds(prev => {
                      if (prev.includes(c.caseId)) {
                        return prev.filter(id => id !== c.caseId);
                      } else {
                        return [...prev, c.caseId];
                      }
                    });
                  } else {
                    openWindow(
                      `workspace-${c.caseId}`,
                      t('dashboard.case_workspace', { title: c.title }),
                      'case_workspace',
                      { caseId: c.caseId }
                    );
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, c.caseId, c.title)}
                className={`case-folder-item flex flex-col items-center justify-center p-2 rounded border group transition-all duration-150 cursor-grab active:cursor-grabbing pointer-events-auto relative text-center select-none h-[110px] w-full max-w-[120px] mx-auto flex-shrink-0 ${focusedCaseId === c.caseId ? 'ring-1 ring-indigo-400/50' : ''} ${isSelected ? 'bg-indigo-500/20 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.35)]' : isAnalysisOpen ? 'bg-[#39ff14]/10 border-[#39ff14]/40' : 'bg-black/25 border-white/5 hover:bg-[#39ff14]/5 hover:border-[#39ff14]/20'}`}
              >
                {/* Selection Checkbox bubble */}
                {(selectedCaseIds.length > 0 || isSelected) && (
                  <div className="absolute top-1 left-1.5 flex items-center justify-center pointer-events-none">
                    <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-white/30 bg-black/50'}`}>
                      {isSelected && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCase(e, c.caseId, c.title);
                  }}
                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity p-0.5"
                  title={t('dashboard.archive_tooltip')}
                >
                  <X size={10} />
                </button>

                <div className={`w-10 h-10 flex items-center justify-center ${isSelected ? 'text-indigo-400' : isAnalysisOpen ? 'text-[#39ff14]' : 'text-[#a855f7] group-hover:text-[#39ff14]'} transition-colors`}>
                  <Folder size={36} className="group-hover:scale-105 transition-transform" />
                </div>
                <span className={`mt-1 text-[11px] font-semibold tracking-wider line-clamp-2 uppercase leading-tight transition-colors ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                  {transliterate(c.title.replace('Investigation', 'FILE'))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Backdrop overlay for mobile sidebar */}
      {isMobile && showSidebarOnMobile && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[990] pointer-events-auto"
          onClick={() => setShowSidebarOnMobile(false)}
        />
      )}

      {/* RIGHT SIDE WIDGETS HUD (Custom panels / Mobile Drawer) */}
      <div
        className={
          isMobile
            ? `fixed top-12 right-0 bottom-20 w-full max-w-[420px] bg-[#050b14]/95 border-l border-[#39ff14]/20 p-4 flex flex-col gap-4 z-[991] transition-transform duration-300 pointer-events-auto select-none overflow-y-auto ${showSidebarOnMobile ? 'translate-x-0 shadow-[0_0_50px_rgba(57,255,20,0.15)]' : 'translate-x-full'}`
            : "absolute top-12 right-6 bottom-20 w-[420px] flex flex-col gap-4 pointer-events-none z-10 select-none"
        }
      >

        {/* Animated Cyber Link graph */}
        <div className="w-full bg-black/40 border border-white/5 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-white/5 pb-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Network size={12} className="text-[#39ff14]" /> {t('dashboard.cyber_link')}
            </span>
            <span className="text-[7.5px] text-[#39ff14] font-semibold uppercase tracking-wider">
              {(() => {
                const lastAccessedCase = cases.find(c => c.caseId === lastAccessedCaseId);
                return lastAccessedCase ? transliterate(lastAccessedCase.title.replace('Investigation', 'FILE').toUpperCase()) : t('dashboard.no_active_mesh');
              })()}
            </span>
          </div>
          <div className="w-full h-64 flex items-center justify-center relative overflow-hidden bg-black/20 rounded">
            {renderMatrixGraph()}
          </div>
        </div>

        {/* Live log Terminal */}
        <div data-tutorial="hud-terminal" className="w-full flex-1 bg-black/40 border border-white/5 backdrop-blur-md rounded-xl p-3 flex flex-col gap-2 pointer-events-auto overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 pb-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Terminal size={12} className="text-[#a855f7]" /> {t('dashboard.audit_stream')}
            </span>
          </div>
          <div className="flex flex-col gap-1 pb-2 border-b border-white/5">
            <span className="text-[8px] text-gray-500 font-mono">EXECUTE COMMAND:</span>
            <input 
              data-tutorial="command-input"
              type="text" 
              placeholder='e.g. ORION-ALPHA'
              className="w-full bg-black/50 border border-white/10 text-[#39FF14] text-[10px] px-2 py-1 rounded focus:outline-none focus:border-[#39FF14] transition-colors"
            />
          </div>
          <div className="flex-1 overflow-auto font-mono text-[8px] text-gray-400 flex flex-col gap-1 select-text scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {hudLogs.map((log, idx) => (
              <div key={idx} className="whitespace-nowrap flex items-start gap-1">
                <span className="text-[#39ff14]">&gt;</span>
                <span className={log.includes('AUDIT') ? 'text-[#39ff14]' : 'text-gray-300'}>{transliterate(log)}</span>
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
              left: (win.isMaximized || isMobile) ? 0 : win.x,
              top: (win.isMaximized || isMobile) ? '2rem' : win.y,
              width: (win.isMaximized || isMobile) ? '100%' : win.width,
              height: (win.isMaximized || isMobile) ? (isMobile ? 'calc(100% - 2rem - 120px)' : 'calc(100% - 2rem)') : win.height,
              zIndex: win.zIndex
            }}
          >
            {/* Window Header / Title Bar */}
            <div
              onMouseDown={(e) => handleDragStart(e, win.id)}
              onDoubleClick={() => toggleMaximize(win.id)}
              className={`h-7 px-3 flex items-center justify-between cursor-move select-none border-b window-drag-surface ${isFocused ? 'bg-[#39ff14]/5 border-[#39ff14]/20 text-[#39ff14]' : 'bg-[#04080e]/40 border-white/5 text-gray-400'}`}
            >
              <div className="flex items-center gap-2 pointer-events-auto">
                <Folder size={12} className="flex-shrink-0" />
                <span className="text-[9px] font-bold tracking-wider uppercase truncate max-w-[400px]">
                  {(() => {
                    if (win.type === 'case_workspace' && win.caseId) {
                      const targetCase = cases.find(c => c.caseId === win.caseId);
                      return targetCase ? t('dashboard.case_workspace', { title: transliterate(targetCase.title) }) : transliterate(win.title);
                    }
                    return transliterate(win.title);
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
                    title={t('dashboard.rename_dossier')}
                  >
                    <Edit size={10} />
                  </button>
                )}
              </div>

              {/* Window controls */}
              <div className="flex items-center gap-1.5 pointer-events-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMinimize(win.id); }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-white/5 transition"
                  title={t('dashboard.minimize_window', 'MINIMIZE')}
                >
                  <Minus size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMaximize(win.id); }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-white/5 transition"
                  title={win.isMaximized ? t('dashboard.restore_window') : t('dashboard.maximize_window')}
                >
                  {win.isMaximized ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); closeWindow(win.id); }}
                  className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition"
                  title={t('dashboard.close_window')}
                >
                  <X size={10} />
                </button>
              </div>
            </div>

            {/* Window Content */}
            <div className="flex-1 overflow-hidden relative flex flex-col p-4">


              {win.type === 'case_workspace' && <CaseWindow win={win as { id: string; type: string; caseId: string; activeTab?: 'intake' | 'graph' | 'dossier' | 'report' }} />}
              {win.type === 'profile' && <ProfileWindow />}
              {win.type === 'cases_explorer' && <ExplorerWindow win={win} />}
              {win.type === 'cross_correlate' && <CrossCorrelationWindow win={win} />}

              {win.type === 'geo_map' && (
                <div className="flex-1 relative w-full h-full min-h-0">
                  <GeoMapWindow caseId={win.caseId || 'global'} />
                </div>
              )}
            </div>

            {/* Directional Resize Handles (4 edges + 4 corners) */}
            {!win.isMaximized && (
              <>
                {/* Top edge */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, win.id, 'n')}
                  className="absolute top-0 left-3 right-3 h-1.5 cursor-ns-resize hover:bg-[#39ff14]/30 z-30"
                />
                {/* Bottom edge */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, win.id, 's')}
                  className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize hover:bg-[#39ff14]/30 z-30"
                />
                {/* Left edge */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, win.id, 'w')}
                  className="absolute top-3 bottom-3 left-0 w-1.5 cursor-ew-resize hover:bg-[#39ff14]/30 z-30"
                />
                {/* Right edge */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, win.id, 'e')}
                  className="absolute top-3 bottom-3 right-0 w-1.5 cursor-ew-resize hover:bg-[#39ff14]/30 z-30"
                />

                {/* Top-Left corner */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, win.id, 'nw')}
                  className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize hover:bg-[#39ff14]/50 z-30"
                />
                {/* Top-Right corner */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, win.id, 'ne')}
                  className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize hover:bg-[#39ff14]/50 z-30"
                />
                {/* Bottom-Left corner */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, win.id, 'sw')}
                  className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize hover:bg-[#39ff14]/50 z-30"
                />
                {/* Bottom-Right corner */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, win.id, 'se')}
                  className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize hover:bg-[#39ff14]/50 z-30"
                />
              </>
            )}
          </div>
        );
      })}

      {/* On mobile: open window task buttons float ABOVE the dock in their own row */}
      {isMobile && windows.length > 0 && (
        <div className="absolute bottom-20 left-0 right-0 flex items-center justify-center px-3 z-[998]">
          <div className="flex gap-2 overflow-x-auto max-w-full pb-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {windows.map(w => {
              const isOpen = !w.isMinimized;
              return (
                <button
                  key={`task-mobile-${w.id}`}
                  onClick={() => toggleMinimize(w.id)}
                  className={`flex-shrink-0 px-3 h-8 rounded-xl transition-all flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider ${isOpen ? 'bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]' : 'bg-white/5 border border-white/5 text-gray-500'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-[#39ff14] animate-pulse' : 'bg-gray-600'}`} />
                  <span className="max-w-[80px] truncate"><Transliterate>{w.title.replace('Case Workspace: ', '').replace('Case Analysis: ', '')}</Transliterate></span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating System Dock (Taskbar) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-14 bg-[#080d16]/75 border border-white/10 backdrop-blur-xl rounded-2xl flex items-center px-2 sm:px-4 gap-2 sm:gap-3 z-[999] shadow-2xl max-w-[calc(100vw-2rem)]">
        <button
          onClick={handleCreateCase}
          disabled={caseCreating}
          title={t('dashboard.create_case')}
          className="w-10 h-10 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors flex items-center justify-center text-gray-300 hover:text-[#39ff14] disabled:opacity-50 disabled:pointer-events-none"
        >
          {caseCreating ? <RefreshCw size={20} className="animate-spin" /> : <Plus size={20} />}
        </button>

        <div className="h-6 w-[1px] bg-white/10" />

        {/* Launchers */}
        <button
          onClick={() => openWindow('cases_explorer', t('dashboard.explorer_title'), 'cases_explorer')}
          title={t('dashboard.explorer_tooltip')}
          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${windows.some(w => w.id === 'cases_explorer') ? 'text-[#39ff14] bg-white/5 border border-white/10' : 'text-gray-300 hover:text-[#39ff14] hover:bg-white/5'}`}
        >
          <Compass size={20} />
        </button>

        <button
          onClick={() => openWindow('cross_correlate_window', t('dashboard.correlator_title'), 'cross_correlate')}
          title={t('dashboard.correlator_tooltip')}
          data-tutorial="cross-correlate"
          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${windows.some(w => w.id === 'cross_correlate_window') ? 'text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/30' : 'text-gray-300 hover:text-[#a855f7] hover:bg-white/5'}`}
        >
          <Network size={20} />
        </button>

        <button
          onClick={() => openWindow('profile_window', t('dashboard.profile_title'), 'profile')}
          title={t('dashboard.profile_tooltip')}
          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${windows.some(w => w.id === 'profile_window') ? 'text-[#39ff14] bg-white/5 border border-white/10' : 'text-gray-300 hover:text-[#39ff14] hover:bg-white/5'}`}
        >
          <User size={20} />
        </button>

        <NotificationPanel />

        {/* On desktop: window task buttons stay inline in the dock */}
        {!isMobile && windows.length > 0 && <div className="h-6 w-[1px] bg-white/10" />}

        {!isMobile && windows.map(w => {
          const isOpen = !w.isMinimized;
          return (
            <button
              key={`task-${w.id}`}
              onClick={() => toggleMinimize(w.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setDockContextMenu({ x: e.clientX, y: e.clientY - 50, windowId: w.id, title: w.title });
              }}
              title={w.title}
              className={`px-3 h-10 rounded-xl transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider ${isOpen ? 'bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14]' : 'bg-white/5 border border-white/5 text-gray-500 hover:text-white'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-[#39ff14] animate-pulse' : 'bg-gray-600'}`} />
              <span className="max-w-[70px] truncate"><Transliterate>{w.title.replace('Case Workspace: ', '').replace('Case Analysis: ', '')}</Transliterate></span>
            </button>
          );
        })}

        {!isMobile && windows.length > 0 && <div className="h-6 w-[1px] bg-white/10" />}

        {/* Disconnect */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          title={t('dashboard.logout_tooltip')}
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
              {t('modals.rename_dossier_ctx')}
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                if (selectedCaseIds.includes(contextMenu.caseId)) {
                  setDeleteConfirmCase({ id: 'multiple', title: `${selectedCaseIds.length} selected cases` });
                } else {
                  setDeleteConfirmCase({ id: contextMenu.caseId, title: contextMenu.title });
                }
              }}
              className="text-left font-mono text-[9px] font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 px-3 py-2 w-full transition-colors uppercase tracking-wider"
            >
              {selectedCaseIds.includes(contextMenu.caseId) ? t('modals.archive_selected_ctx', 'Archive Selected Cases') : t('modals.delete_dossier_ctx')}
            </button>
          </div>
        </div>
      )}

      {/* Dock Window Context Menu */}
      {dockContextMenu && (
        <div
          onClick={() => setDockContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setDockContextMenu(null); }}
          className="fixed inset-0 z-[100000]"
        >
          <div
            style={{
              position: 'fixed',
              left: dockContextMenu.x,
              top: dockContextMenu.y,
            }}
            className="bg-[#04080e]/95 border border-white/10 p-1 flex flex-col min-w-[130px] shadow-2xl backdrop-blur-xl z-[100001]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setDockContextMenu(null);
                closeWindow(dockContextMenu.windowId);
              }}
              className="text-left font-mono text-[9px] font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 px-3 py-2 w-full transition-colors uppercase tracking-wider"
            >
              {t('modals.close_window', 'CLOSE WINDOW')}
            </button>
          </div>
        </div>
      )}

      {renameCaseState && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-[#39ff14] p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-[#39ff14]/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-[#39ff14] tracking-widest uppercase pb-2 border-b border-white/5">
              {t('modals.rename_title')}
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[8px] text-gray-500 uppercase tracking-wider">{t('modals.new_title_label')}</span>
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
                {t('modals.cancel')}
              </button>
              <button
                onClick={handleSaveRename}
                className="px-3.5 py-1.5 bg-[#39ff14]/15 border border-[#39ff14] hover:bg-[#39ff14]/25 text-[#39ff14] rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
              >
                {t('modals.save_changes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmCase && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-red-500 p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-red-500/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-red-500 tracking-widest uppercase pb-2 border-b border-white/5">
              {deleteConfirmCase.id === 'multiple' ? t('modals.confirm_delete_multiple_title', 'ARCHIVE MULTIPLE DOSSIERS') : t('modals.confirm_delete_title')}
            </div>
            <div className="font-mono text-[10px] text-gray-400 leading-relaxed">
              {deleteConfirmCase.id === 'multiple' ? t('modals.confirm_delete_multiple_body', 'Are you sure you want to permanently archive the selected dossiers?') : (
                <>
                  {t('modals.confirm_delete_body')} <span className="text-white font-bold">"{deleteConfirmCase.title}"</span>?
                </>
              )}
              <br /><br />
              {t('modals.confirm_delete_warning')}
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5 mt-2">
              <button
                onClick={() => setDeleteConfirmCase(null)}
                className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent"
              >
                {t('modals.cancel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
              >
                {deleteConfirmCase.id === 'multiple' ? t('modals.archive_selected') : t('modals.delete_dossier')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[99999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-[#04080e]/95 border border-red-500 p-6 w-[360px] flex flex-col gap-4 shadow-2xl shadow-red-500/5 backdrop-blur-xl">
            <div className="font-mono text-[10px] font-bold text-red-500 tracking-widest uppercase pb-2 border-b border-white/5">
              {t('modals.confirm_disconnect_title')}
            </div>
            <div className="font-mono text-[10px] text-gray-400 leading-relaxed">
              {t('modals.confirm_disconnect_body')}
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5 mt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-3.5 py-1.5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase bg-transparent"
              >
                {t('modals.cancel')}
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                  window.location.href = '/';
                }}
                className="px-3.5 py-1.5 bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded text-[9px] font-bold font-mono tracking-wider transition-all uppercase"
              >
                {t('modals.disconnect')}
              </button>
            </div>
          </div>
        </div>
      )}
      <TutorialOverlay />
      <DemoTour />
    </div>
    </DashboardContext.Provider>
  );
}
