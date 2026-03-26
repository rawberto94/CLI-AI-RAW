/**
 * useAgentSSE Hook
 * 
 * Provides real-time updates from agents via Server-Sent Events
 * Replaces polling with true real-time communication
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';

export type AgentSSEEventType =
  | 'approval_required'
  | 'goal_approved'
  | 'goal_completed'
  | 'goal_failed'
  | 'approval_escalated'
  | 'activity'
  | 'opportunity'
  | 'heartbeat';

interface UseAgentSSEOptions {
  onEvent?: (eventType: AgentSSEEventType, data: Record<string, unknown>) => void;
  onReconnectExhausted?: () => void;
}

interface SSEState {
  connected: boolean;
  lastMessage: any | null;
  activities: any[];
  pendingApprovals: number;
  newOpportunities: number;
}

export interface UseAgentSSEReturn extends SSEState {
  isConnected: boolean;
  isReconnectExhausted: boolean;
  reconnect: () => void;
}

export function useAgentSSE(options?: UseAgentSSEOptions): UseAgentSSEReturn {
  const { data: session } = useSession();
  const [state, setState] = useState<SSEState>({
    connected: false,
    lastMessage: null,
    activities: [],
    pendingApprovals: 0,
    newOpportunities: 0,
  });
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const MAX_RECONNECT_ATTEMPTS = 10;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

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
      setReconnectAttempts(0);
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
      optionsRef.current?.onEvent?.('activity', data);
    });

    es.addEventListener('approval', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState(prev => ({
        ...prev,
        pendingApprovals: prev.pendingApprovals + 1,
      }));
      optionsRef.current?.onEvent?.('approval_required', data);
    });

    es.addEventListener('opportunity', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setState(prev => ({
        ...prev,
        newOpportunities: prev.newOpportunities + 1,
      }));
      optionsRef.current?.onEvent?.('opportunity', data);
    });

    es.addEventListener('heartbeat', () => {
      // Connection is alive
    });

    es.onerror = (error) => {
      console.error('[SSE] Error:', error);
      setState(prev => ({ ...prev, connected: false }));
      
      // Close the erroring connection
      es.close();
      eventSourceRef.current = null;
      
      setReconnectAttempts(prev => {
        const next = prev + 1;
        if (next >= MAX_RECONNECT_ATTEMPTS) {
          optionsRef.current?.onReconnectExhausted?.();
          return next;
        }
        // Before reconnecting, verify session is still valid.
        // EventSource cannot report HTTP status codes, so a 401 looks
        // identical to a network error.  A quick session check avoids
        // noisy retry loops when the user is simply not authenticated.
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(async () => {
          try {
            const res = await fetch('/api/auth/session');
            const sess = await res.json();
            if (!sess?.user) {
              // Session expired — stop retrying
              console.log('[SSE] Session expired, stopping reconnect');
              optionsRef.current?.onReconnectExhausted?.();
              return;
            }
          } catch {
            // Can't check session — try reconnect anyway
          }
          console.log('[SSE] Reconnecting...');
          connect();
        }, Math.min(1000 * Math.pow(2, next), 30000));
        return next;
      });
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
    isConnected: state.connected,
    isReconnectExhausted: reconnectAttempts >= MAX_RECONNECT_ATTEMPTS,
    reconnect,
  };
}
