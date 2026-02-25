/**
 * useAgentSSE Hook
 * 
 * Provides real-time updates from agents via Server-Sent Events
 * Replaces polling with true real-time communication
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';

interface SSEState {
  connected: boolean;
  lastMessage: any | null;
  activities: any[];
  pendingApprovals: number;
  newOpportunities: number;
}

interface UseAgentSSEReturn extends SSEState {
  reconnect: () => void;
}

export function useAgentSSE(): UseAgentSSEReturn {
  const { data: session } = useSession();
  const [state, setState] = useState<SSEState>({
    connected: false,
    lastMessage: null,
    activities: [],
    pendingApprovals: 0,
    newOpportunities: 0,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!session?.user?.tenantId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const tenantId = session.user.tenantId;
    const userId = session.user.id;
    const url = `/api/agents/sse?tenantId=${tenantId}&userId=${userId}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState(prev => ({ ...prev, connected: true }));
      console.log('[SSE] Connected to agent updates');
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(prev => ({ ...prev, lastMessage: data }));
      } catch (error) {
        console.error('[SSE] Error parsing message:', error);
      }
    };

    es.addEventListener('connected', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      console.log('[SSE] Connected:', data.clientId);
      setState(prev => ({ ...prev, connected: true }));
    });

    es.addEventListener('initial', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState(prev => ({
        ...prev,
        activities: data.activities || [],
        pendingApprovals: data.pendingApprovals || 0,
        newOpportunities: data.newOpportunities || 0,
      }));
    });

    es.addEventListener('activity', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState(prev => ({
        ...prev,
        activities: [data, ...prev.activities].slice(0, 50),
      }));
    });

    es.addEventListener('approval', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState(prev => ({
        ...prev,
        pendingApprovals: prev.pendingApprovals + 1,
      }));
    });

    es.addEventListener('opportunity', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState(prev => ({
        ...prev,
        newOpportunities: prev.newOpportunities + 1,
      }));
    });

    es.addEventListener('heartbeat', () => {
      // Connection is alive
    });

    es.onerror = (error) => {
      console.error('[SSE] Error:', error);
      setState(prev => ({ ...prev, connected: false }));
      
      // Auto-reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[SSE] Reconnecting...');
        connect();
      }, 5000);
    };
  }, [session]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    ...state,
    reconnect,
  };
}
