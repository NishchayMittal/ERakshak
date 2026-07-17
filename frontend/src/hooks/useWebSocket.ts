import { useEffect, useRef } from 'react';
import { useGraphStore } from '../state/graphStore';

export function useWebSocket(caseId: string | undefined) {
  const ws = useRef<WebSocket | null>(null);
  const loadEntityGraph = useGraphStore((state) => state.loadEntityGraph);
  const selectedEntityId = useGraphStore((state) => state.selectedEntityId);

  useEffect(() => {
    if (!caseId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Base URL or fallback to host
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    let wsUrl = '';
    
    if (apiBase) {
      wsUrl = `${apiBase.replace(/^http/, 'ws')}/ws/cases/${caseId}`;
    } else {
      wsUrl = `${protocol}//${host}/ws/cases/${caseId}`;
    }

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log(`WebSocket connected for case ${caseId}`);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket update received:', data);
        if (data.action === 'findings_discovered') {
          // If we have an entity selected, reload the graph to fetch new findings
          if (selectedEntityId) {
            loadEntityGraph(caseId, selectedEntityId);
          } else {
            // If the user is just viewing the case graph, we'll reload using a case graph load function
            // (assuming one exists, but for now we reload the entity graph if one is selected)
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    ws.current.onclose = () => {
      console.log(`WebSocket disconnected for case ${caseId}`);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [caseId, selectedEntityId, loadEntityGraph]);

  return ws.current;
}
