import { useEffect, useRef } from 'react';
import { useDashboardContext } from '../pages/DashboardContext';

export function useCaseWebSocket(caseId: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const { setCaseIngestLogs, setCaseIngestProgress, loadGraphForCase, setWindows } = useDashboardContext();

  const handlersRef = useRef({ setCaseIngestLogs, setCaseIngestProgress, loadGraphForCase, setWindows });
  
  useEffect(() => {
    handlersRef.current = { setCaseIngestLogs, setCaseIngestProgress, loadGraphForCase, setWindows };
  });

  useEffect(() => {
    if (!caseId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    const wsUrl = apiBase
      ? `${apiBase.replace(/^http/, 'ws')}/ws/cases/${caseId}`
      : `${protocol}//${host}/ws/cases/${caseId}`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { setCaseIngestLogs, setCaseIngestProgress, loadGraphForCase, setWindows } = handlersRef.current;
        
        if (data.action === 'findings_discovered') {
          const count = data.detail.count;
          setCaseIngestLogs((prev: Record<string, string[]>) => ({
            ...prev,
            [caseId]: [...(prev[caseId] || []), `> Discovered ${count} new findings. Updating matrix...`],
          }));
          
          // Reload graph so it updates in real time while the pipeline runs
          if (loadGraphForCase) {
            loadGraphForCase(caseId, '');
          }
        } else if (data.action === 'pipeline_completed') {
          setCaseIngestLogs((prev: Record<string, string[]>) => ({
            ...prev,
            [caseId]: [...(prev[caseId] || []), `> Pipeline completed for identifier ${data.detail.identifier_id}.`],
          }));

          // Finish loading bar at 100%
          setCaseIngestProgress((prev: Record<string, number | null>) => {
            if (prev[caseId] !== undefined && prev[caseId] !== null) {
              return { ...prev, [caseId]: 100 };
            }
            return prev;
          });

          // After a short celebration delay, clear progress and switch to graph tab
          setTimeout(() => {
            setCaseIngestProgress((prev: Record<string, number | null>) => {
              if (prev[caseId] !== undefined && prev[caseId] !== null) {
                return { ...prev, [caseId]: null };
              }
              return prev;
            });
            if (setWindows) {
              setWindows((prev: any[]) => prev.map(w => (w.caseId === caseId ? { ...w, activeTab: 'graph' } : w)));
            }
          }, 600);

          // Reload graph since pipeline finished
          if (loadGraphForCase) {
            loadGraphForCase(caseId, '');
          }
        }
      } catch (err) {
        console.error('[WS] Failed to parse message', err);
      }
    };

    ws.current.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    ws.current.onclose = () => {
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [caseId]);

  const sendMessage = (message: unknown) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { sendMessage };
}
