/**
 * useEventStream — SSE (Server-Sent Events) hook for real-time updates
 *
 * Connects to the server-sent events endpoint and provides connection state,
 * incoming events, and reconnection controls.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface StreamEvent {
  type: string;
  data: Record<string, unknown>;
  id?: string;
  timestamp?: number;
}

export interface UseEventStreamOptions {
  tenantId?: string;
  userId?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onEvent?: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface UseEventStreamReturn {
  isConnected: boolean;
  lastEvent: StreamEvent | null;
  error: Error | null;
  reconnect: () => void;
  disconnect: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useEventStream(options: UseEventStreamOptions = {}): UseEventStreamReturn {
  const {
    tenantId,
    userId,
    autoReconnect = false,
    reconnectInterval = 5000,
    maxReconnectAttempts = 5,
    onEvent,
    onError,
    onConnect,
    onDisconnect,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldConnectRef = useRef(true);

  // Stable callback refs
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  onEventRef.current = onEvent;
  onErrorRef.current = onError;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!tenantId) return;

    cleanup();

    try {
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      if (userId) params.set('userId', userId);

      const url = `/api/events?${params.toString()}`;
      const es = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
        onConnectRef.current?.();
      };

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as StreamEvent;
          const streamEvent: StreamEvent = {
            type: parsed.type || 'message',
            data: parsed.data || parsed,
            id: event.lastEventId || undefined,
            timestamp: Date.now(),
          };
          setLastEvent(streamEvent);
          onEventRef.current?.(streamEvent);
        } catch {
          // Malformed event data — ignore
        }
      };

      es.onerror = () => {
        const err = new Error('SSE connection error');
        setError(err);
        setIsConnected(false);
        onDisconnectRef.current?.();

        es.close();
        eventSourceRef.current = null;

        // Auto-reconnect logic
        if (
          autoReconnect &&
          shouldConnectRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          reconnectAttemptsRef.current += 1;
          onErrorRef.current?.(err);
          reconnectTimerRef.current = setTimeout(() => {
            if (shouldConnectRef.current) {
              connect();
            }
          }, reconnectInterval * Math.min(reconnectAttemptsRef.current, 3));
        }
        // When autoReconnect is disabled, don't fire onError to avoid
        // incrementing connectionAttempts in the provider (which causes
        // the "Reconnecting..." UI even though nothing is reconnecting).
      };
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to connect to event stream');
      setError(err);
      onErrorRef.current?.(err);
    }
  }, [tenantId, userId, autoReconnect, reconnectInterval, maxReconnectAttempts, cleanup]);

  const reconnect = useCallback(() => {
    shouldConnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;
    cleanup();
    onDisconnectRef.current?.();
  }, [cleanup]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (tenantId) {
      shouldConnectRef.current = true;
      connect();
    }
    return () => {
      shouldConnectRef.current = false;
      cleanup();
    };
  }, [tenantId, userId, connect, cleanup]);

  return {
    isConnected,
    lastEvent,
    error,
    reconnect,
    disconnect,
  };
}
