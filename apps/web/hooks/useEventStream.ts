/**
 * useEventStream Hook
 * Connects to SSE endpoint and provides real-time event updates with automatic reconnection
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
            onReconnecting?.(state.attempts, maxReconnectAttempts);
            setConnectionState(prev => ({
              ...prev,
              status: 'reconnecting',
              reconnectAttempts: state.attempts,
            }));
          }
          connect();
        },
        onMaxAttemptsReached: () => {
          console.log('[EventStream] Max reconnection attempts reached');
          setConnectionState(prev => ({
            ...prev,
            status: 'error',
          }));
          onMaxReconnectAttemptsReached?.();
        },
      }
    );

    return () => {
      reconnectionServiceRef.current?.cancel();
    };
  }, [maxReconnectAttempts, baseReconnectDelay, onReconnecting, onMaxReconnectAttemptsReached]);

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
        
        onConnect?.();
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
          onEvent?.(streamEvent);
        } catch (err) {
          console.error('[EventStream] Error parsing event:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('[EventStream] Connection error:', err);
        setIsConnected(false);
        
        const error = new Error('EventStream connection error');
        setError(error);
        onError?.(error);
        onDisconnect?.();

        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Notify reconnection service of failure
        reconnectionServiceRef.current?.onFailure();

        // Attempt to reconnect if enabled
        if (autoReconnect && reconnectionServiceRef.current?.shouldReconnect()) {
          reconnectionServiceRef.current.scheduleReconnect();
        } else {
          setConnectionState(prev => ({
            ...prev,
            status: 'error',
          }));
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('[EventStream] Error creating connection:', err);
      const error = err instanceof Error ? err : new Error('Failed to create EventStream');
      setError(error);
      onError?.(error);
      
      setConnectionState(prev => ({
        ...prev,
        status: 'error',
      }));

      // Attempt to reconnect if enabled
      if (autoReconnect && reconnectionServiceRef.current?.shouldReconnect()) {
        reconnectionServiceRef.current?.scheduleReconnect();
      }
    }
  }, [tenantId, userId, autoReconnect, onEvent, onError, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    // Cancel any pending reconnection
    reconnectionServiceRef.current?.cancel();

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      setConnectionState({
        status: 'disconnected',
        reconnectAttempts: 0,
        totalReconnections: connectionState.totalReconnections,
      });
      onDisconnect?.();
    }
  }, [onDisconnect, connectionState.totalReconnections]);

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
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    error,
    connectionState,
    reconnect,
    disconnect,
  };
}
