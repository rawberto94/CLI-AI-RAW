/**
 * useAgentSSE — Auto-reconnecting SSE hook for the agent HITL event stream.
 *
 * Connects to /api/agents/sse and listens for named events
 * (approval_required, goal_approved, goal_rejected, goal_updated,
 *  goal_completed, goal_failed, pending_approvals).
 *
 * Features:
 *  - Exponential backoff reconnection (max 5 attempts, up to 30s delay)
 *  - Clean disconnect on unmount
 *  - Connection state exposed for UI indicators
 *  - Callbacks for each event type
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export type AgentSSEEventType =
  | 'connected'
  | 'approval_required'
  | 'approval_escalated'
  | 'goal_approved'
  | 'goal_rejected'
  | 'goal_updated'
  | 'goal_completed'
  | 'goal_failed'
  | 'pending_approvals';

export interface UseAgentSSEOptions {
  /** Called for any event — the primary hook for refreshing data */
  onEvent?: (eventType: AgentSSEEventType, data: Record<string, unknown>) => void;
  /** Called on successful connection */
  onConnect?: () => void;
  /** Called on disconnect */
  onDisconnect?: () => void;
  /** Called when all reconnect attempts are exhausted */
  onReconnectExhausted?: () => void;
  /** Enable the connection (default true) — set false to pause */
  enabled?: boolean;
}

export interface UseAgentSSEReturn {
  isConnected: boolean;
  /** True when all reconnect attempts have been exhausted */
  isReconnectExhausted: boolean;
  reconnect: () => void;
  disconnect: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const SSE_URL = '/api/agents/sse';
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 5000; // 5s
const MAX_RECONNECT_DELAY = 30000; // 30s

const AGENT_EVENT_TYPES: AgentSSEEventType[] = [
  'connected',
  'approval_required',
  'approval_escalated',
  'goal_approved',
  'goal_rejected',
  'goal_updated',
  'goal_completed',
  'goal_failed',
  'pending_approvals',
];

// ============================================================================
// Hook
// ============================================================================

export function useAgentSSE(options: UseAgentSSEOptions = {}): UseAgentSSEReturn {
  const { enabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnectExhausted, setIsReconnectExhausted] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldConnectRef = useRef(true);

  // Stable callback refs so we don't re-create the EventSource on prop changes
  const onEventRef = useRef(options.onEvent);
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onReconnectExhaustedRef = useRef(options.onReconnectExhausted);
  onEventRef.current = options.onEvent;
  onConnectRef.current = options.onConnect;
  onDisconnectRef.current = options.onDisconnect;
  onReconnectExhaustedRef.current = options.onReconnectExhausted;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    cleanup();

    try {
      const es = new EventSource(SSE_URL);
      esRef.current = es;

      // Listen for each named event type
      for (const eventType of AGENT_EVENT_TYPES) {
        es.addEventListener(eventType, (e) => {
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse((e as MessageEvent).data);
          } catch {
            // Malformed data — still fire the callback with empty data
          }

          if (eventType === 'connected') {
            setIsConnected(true);
            setIsReconnectExhausted(false);
            reconnectAttemptsRef.current = 0;
            onConnectRef.current?.();
          }

          onEventRef.current?.(eventType, data);
        });
      }

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setIsConnected(false);
        onDisconnectRef.current?.();

        // Auto-reconnect with exponential backoff
        if (shouldConnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(
            BASE_RECONNECT_DELAY * reconnectAttemptsRef.current,
            MAX_RECONNECT_DELAY,
          );
          reconnectTimerRef.current = setTimeout(() => {
            if (shouldConnectRef.current) connect();
          }, delay);
        } else if (shouldConnectRef.current) {
          setIsReconnectExhausted(true);
          onReconnectExhaustedRef.current?.();
        }
      };
    } catch {
      // EventSource not available (SSR, old browser)
    }
  }, [cleanup]);

  const reconnect = useCallback(() => {
    shouldConnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    setIsReconnectExhausted(false);
    connect();
  }, [connect]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;
    cleanup();
    onDisconnectRef.current?.();
  }, [cleanup]);

  useEffect(() => {
    if (enabled) {
      shouldConnectRef.current = true;
      connect();
    } else {
      shouldConnectRef.current = false;
      cleanup();
    }
    return () => {
      shouldConnectRef.current = false;
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  return { isConnected, isReconnectExhausted, reconnect, disconnect };
}
