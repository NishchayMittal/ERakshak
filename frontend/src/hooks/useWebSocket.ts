import { useEffect, useRef } from 'react';
import { useGraphStore } from '../state/graphStore';

export function useWebSocket(
  caseId: string | undefined,
  /** Whether graph reloads are allowed — derived from window open/minimize state */
  graphReloadActive?: boolean
) {
  const ws = useRef<WebSocket | null>(null);
  const loadEntityGraph = useGraphStore((state) => state.loadEntityGraph);

  // Keep a ref so the WebSocket handler always reads the latest value
  // without needing to re-create the effect every time graphReloadActive changes.
  const graphReloadActiveRef = useRef(graphReloadActive);
  useEffect(() => {
    graphReloadActiveRef.current = graphReloadActive;
  });

  useEffect(() => {
    if (!caseId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Base URL or fallback to host
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    const wsUrl = apiBase
      ? `${apiBase.replace(/^http/, 'ws')}/ws/cases/${caseId}`
      : `${protocol}//${host}/ws/cases/${caseId}`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log(`WebSocket connected for case ${caseId}`);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket update received:', data);
        if (data.action === 'pipeline_completed') {
          // Only reload the graph if a case workspace window is actually open and not minimized.
          // Uses a ref to avoid stale closures — reads the latest value every time.
          if (!graphReloadActiveRef.current) {
            console.log('Skipping graph reload: no case workspace window is open');
            return;
          }

          const latestEntityId = useGraphStore.getState().selectedEntityId;
          loadEntityGraph(caseId, latestEntityId || 'n1');
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
  }, [caseId, loadEntityGraph]);
}