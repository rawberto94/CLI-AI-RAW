/**
 * useEventStream Hook
 * Connects to SSE endpoint and provides real-time event updates with automatic reconnection
 */

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { SSEReconnectionService } from '@/../../packages/data-orchestration/src/services/sse-reconnection.service';

export interface StreamEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  reconnectAttempts: number;
  totalReconnections: number;
  nextReconnectIn?: number;
}

export interface UseEventStreamOptions {
  tenantId?: string;
  userId?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  baseReconnectDelay?: number;
  onEvent?: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnecting?: (attempt: number, maxAttempts: number) => void;
  onMaxReconnectAttemptsReached?: () => void;
}

export function useEventStream(options: UseEventStreamOptions = {}) {
  const {
    tenantId = 'demo',
    userId,
    autoReconnect = true,
    maxReconnectAttempts = 10,
    baseReconnectDelay = 1000,
    onEvent,
    onError,
    onConnect,
    onDisconnect,
    onReconnecting,
    onMaxReconnectAttemptsReached,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    totalReconnections: 0,
  });
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectionServiceRef = useRef<SSEReconnectionService | null>(null);
  const stateUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectFnRef = useRef<(() => void) | null>(null);

  // Memoize callbacks to prevent them from changing on every render
  const stableOnEvent = useMemo(() => onEvent, [onEvent]);
  const stableOnError = useMemo(() => onError, [onError]);
  const stableOnConnect = useMemo(() => onConnect, [onConnect]);
  const stableOnDisconnect = useMemo(() => onDisconnect, [onDisconnect]);
  const stableOnReconnecting = useMemo(() => onReconnecting, [onReconnecting]);
  const stableOnMaxReconnectAttemptsReached = useMemo(() => onMaxReconnectAttemptsReached, [onMaxReconnectAttemptsReached]);

  // Initialize reconnection service
  useEffect(() => {
    reconnectionServiceRef.current = new SSEReconnectionService(
      {
        maxAttempts: maxReconnectAttempts,
        baseDelay: baseReconnectDelay,
        maxDelay: 30000,
        jitterRange: 1000,
        backoffMultiplier: 2,
      },
      {
        onReconnect: () => {
          const state = reconnectionServiceRef.current?.getState();
          if (state) {
            stableOnReconnecting?.(state.attempts, maxReconnectAttempts);
            setConnectionState(prev => ({
              ...prev,
              status: 'reconnecting',
              reconnectAttempts: state.attempts,
            }));
          }
          // Use ref to call connect
          connectFnRef.current?.();
        },
        onMaxAttemptsReached: () => {
          console.log('[EventStream] Max reconnection attempts reached');
          setConnectionState(prev => ({
            ...prev,
            status: 'error',
          }));
          stableOnMaxReconnectAttemptsReached?.();
        },
      }
    );

    return () => {
      reconnectionServiceRef.current?.cancel();
    };
  }, [maxReconnectAttempts, baseReconnectDelay, stableOnReconnecting, stableOnMaxReconnectAttemptsReached]);

  // Update connection state periodically
  useEffect(() => {
    if (connectionState.status === 'reconnecting') {
      stateUpdateIntervalRef.current = setInterval(() => {
        const timeUntil = reconnectionServiceRef.current?.getTimeUntilNextAttempt();
        if (timeUntil !== null && timeUntil !== undefined) {
          setConnectionState(prev => ({
            ...prev,
            nextReconnectIn: Math.ceil(timeUntil / 1000), // Convert to seconds
          }));
        }
      }, 100);
    } else {
      if (stateUpdateIntervalRef.current) {
        clearInterval(stateUpdateIntervalRef.current);
        stateUpdateIntervalRef.current = null;
      }
    }

    return () => {
      if (stateUpdateIntervalRef.current) {
        clearInterval(stateUpdateIntervalRef.current);
      }
    };
  }, [connectionState.status]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return; // Already connected
    }

    try {
      setConnectionState(prev => ({
        ...prev,
        status: 'connecting',
      }));

      const params = new URLSearchParams({ tenantId });
      if (userId) params.append('userId', userId);

      const url = `/api/events?${params.toString()}`;
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log('[EventStream] Connected');
        setIsConnected(true);
        setError(null);
        
        // Reset reconnection service on successful connection
        reconnectionServiceRef.current?.onSuccess();
        
        const state = reconnectionServiceRef.current?.getState();
        setConnectionState({
          status: 'connected',
          reconnectAttempts: 0,
          totalReconnections: state?.totalReconnections || 0,
        });
        
        stableOnConnect?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const streamEvent: StreamEvent = {
            type: data.type,
            data: data.data,
            timestamp: data.timestamp,
          };

          setLastEvent(streamEvent);
          stableOnEvent?.(streamEvent);
        } catch (err) {
          console.error('[EventStream] Error parsing event:', err);
        }
      };

      eventSource.onerror = (err) => {
        // Silently handle SSE connection errors (feature is optional)
        setIsConnected(false);
        
        const error = new Error('EventStream connection error');
        setError(error);
        stableOnError?.(error);
        stableOnDisconnect?.();

        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Notify reconnection service of failure
        reconnectionServiceRef.current?.onFailure();

        // Don't auto-reconnect to avoid console spam
        // The app works fine without SSE
        setConnectionState(prev => ({
          ...prev,
          status: 'disconnected',
        }));
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('[EventStream] Error creating connection:', err);
      const error = err instanceof Error ? err : new Error('Failed to create EventStream');
      setError(error);
      stableOnError?.(error);
      
      setConnectionState(prev => ({
        ...prev,
        status: 'error',
      }));

      // Attempt to reconnect if enabled
      if (autoReconnect && reconnectionServiceRef.current?.shouldReconnect()) {
        reconnectionServiceRef.current?.scheduleReconnect();
      }
    }
  }, [tenantId, userId, autoReconnect, stableOnEvent, stableOnError, stableOnConnect, stableOnDisconnect]);

  // Store connect function in ref for reconnection service
  connectFnRef.current = connect;

  const disconnect = useCallback(() => {
    // Cancel any pending reconnection
    reconnectionServiceRef.current?.cancel();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      setConnectionState(prev => ({
        status: 'disconnected',
        reconnectAttempts: 0,
        totalReconnections: prev.totalReconnections,
      }));
      stableOnDisconnect?.();
    }
  }, [stableOnDisconnect]);

  const reconnect = useCallback(() => {
    // Reset reconnection service
    reconnectionServiceRef.current?.reset();
    
    // Disconnect first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }

    // Then connect
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      // Inline cleanup to avoid dependency issues
      reconnectionServiceRef.current?.cancel();
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
        setConnectionState(prev => ({
          status: 'disconnected',
          reconnectAttempts: 0,
          totalReconnections: prev.totalReconnections,
        }));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return {
    isConnected,
    lastEvent,
    error,
    connectionState,
    reconnect,
    disconnect,
  };
}
