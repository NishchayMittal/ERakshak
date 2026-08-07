import { useEffect, useRef } from 'react';
import { useGraphStore } from '../state/graphStore';

export function useWebSocket(
  caseId: string | undefined,
  /** Whether graph reloads are allowed — derived from window open/minimize state */
  graphReloadActive?: boolean,
  /** Callback fired when pipeline completes */
  onPipelineCompleted?: (caseId: string) => void
) {
  const ws = useRef<WebSocket | null>(null);
  const loadEntityGraph = useGraphStore((state) => state.loadEntityGraph);

  // Keep a ref so the WebSocket handler always reads the latest value
  // without needing to re-create the effect every time graphReloadActive changes.
  const graphReloadActiveRef = useRef(graphReloadActive);
  const onPipelineCompletedRef = useRef(onPipelineCompleted);
  useEffect(() => {
    graphReloadActiveRef.current = graphReloadActive;
    onPipelineCompletedRef.current = onPipelineCompleted;
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
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === 'pipeline_completed') {
          // Only reload the graph if a case workspace window is actually open and not minimized.
          // Uses a ref to avoid stale closures — reads the latest value every time.
          if (!graphReloadActiveRef.current) {
            return;
          }

          const latestEntityId = useGraphStore.getState().selectedEntityId;
          loadEntityGraph(caseId, latestEntityId || 'n1');
          
          if (onPipelineCompletedRef.current) {
            onPipelineCompletedRef.current(caseId);
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    };

    ws.current.onclose = () => {
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [caseId, loadEntityGraph]);
}