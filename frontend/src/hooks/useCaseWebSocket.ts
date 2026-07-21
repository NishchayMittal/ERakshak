import { useEffect, useRef } from 'react';
import { useDashboardContext } from '../pages/DashboardContext';

export function useCaseWebSocket(caseId: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const { setCaseIngestLogs, setCaseIngestProgress, loadGraphForCase } = useDashboardContext();

  useEffect(() => {
    if (!caseId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/cases/${caseId}`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log(`[WS] Connected to case ${caseId}`);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.action === 'findings_discovered') {
          const count = data.detail.count;
          setCaseIngestLogs((prev: Record<string, string[]>) => ({
            ...prev,
            [caseId]: [...(prev[caseId] || []), `> Discovered ${count} new findings. Updating matrix...`],
          }));
        } else if (data.action === 'pipeline_completed') {
          setCaseIngestLogs((prev: Record<string, string[]>) => ({
            ...prev,
            [caseId]: [...(prev[caseId] || []), `> Pipeline completed for identifier ${data.detail.identifier_id}.`],
          }));
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
      console.log(`[WS] Disconnected from case ${caseId}`);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [caseId, setCaseIngestLogs, setCaseIngestProgress, loadGraphForCase]);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { sendMessage };
}
