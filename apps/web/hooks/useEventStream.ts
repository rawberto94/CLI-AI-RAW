/**
 * useEventStream Hook
 * Connects to SSE endpoint and provides real-time event updates with automatic reconnection
 */

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

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

// Simple reconnection manager
class SimpleReconnectionManager {
  private attempts = 0;
  private maxAttempts: number;
  private baseDelay: number;
  private maxDelay: number;
  private timeoutId: NodeJS.Timeout | null = null;
  private isCancelled = false;

  constructor(
    options: {
      maxAttempts: number;
      baseDelay: number;
      maxDelay?: number;
    },
    callbacks: {
      onReconnect: () => void;
      onMaxAttemptsReached: () => void;
    }
  ) {
    this.maxAttempts = options.maxAttempts;
    this.baseDelay = options.baseDelay;
    this.maxDelay = options.maxDelay || 30000;
    this.onReconnect = callbacks.onReconnect;
    this.onMaxAttemptsReached = callbacks.onMaxAttemptsReached;
  }

  private onReconnect: () => void;
  private onMaxAttemptsReached: () => void;

  shouldReconnect(): boolean {
    return !this.isCancelled && this.attempts < this.maxAttempts;
  }

  scheduleReconnect(): void {
    if (!this.shouldReconnect()) {
      this.onMaxAttemptsReached();
      return;
    }

    this.attempts++;
    const delay = Math.min(this.baseDelay * Math.pow(2, this.attempts - 1), this.maxDelay);
    
    this.timeoutId = setTimeout(() => {
      if (!this.isCancelled) {
        this.onReconnect();
      }
    }, delay);
  }

  onSuccess(): void {
    this.attempts = 0;
    this.cancel();
  }

  onFailure(): void {
    if (this.shouldReconnect()) {
      this.scheduleReconnect();
    } else {
      this.onMaxAttemptsReached();
    }
  }

  cancel(): void {
    this.isCancelled = true;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  reset(): void {
    this.attempts = 0;
    this.isCancelled = false;
    this.cancel();
  }

  getState() {
    return {
      attempts: this.attempts,
      totalReconnections: this.attempts,
    };
  }

  getTimeUntilNextAttempt(): number | null {
    return null; // Simplified - we won't track exact time
  }
}

export function useEventStream(options: UseEventStreamOptions = {}) {
  const {
    tenantId = 'demo',
    userId,
    autoReconnect = true,
    maxReconnectAttempts = 5, // Reduced for better UX
    baseReconnectDelay = 2000, // Increased base delay
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
  const reconnectionManagerRef = useRef<SimpleReconnectionManager | null>(null);
  const connectFnRef = useRef<(() => void) | null>(null);
  const isConnectingRef = useRef(false);

  // Memoize callbacks to prevent them from changing on every render
  const stableOnEvent = useMemo(() => onEvent, [onEvent]);
  const stableOnError = useMemo(() => onError, [onError]);
  const stableOnConnect = useMemo(() => onConnect, [onConnect]);
  const stableOnDisconnect = useMemo(() => onDisconnect, [onDisconnect]);
  const stableOnReconnecting = useMemo(() => onReconnecting, [onReconnecting]);
  const stableOnMaxReconnectAttemptsReached = useMemo(() => onMaxReconnectAttemptsReached, [onMaxReconnectAttemptsReached]);

  // Initialize reconnection manager
  useEffect(() => {
    reconnectionManagerRef.current = new SimpleReconnectionManager(
      {
        maxAttempts: maxReconnectAttempts,
        baseDelay: baseReconnectDelay,
        maxDelay: 30000,
      },
      {
        onReconnect: () => {
          const state = reconnectionManagerRef.current?.getState();
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
          setConnectionState(prev => ({
            ...prev,
            status: 'error',
          }));
          stableOnMaxReconnectAttemptsReached?.();
        },
      }
    );

    return () => {
      reconnectionManagerRef.current?.cancel();
    };
  }, [maxReconnectAttempts, baseReconnectDelay, stableOnReconnecting, stableOnMaxReconnectAttemptsReached]);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (eventSourceRef.current || isConnectingRef.current) {
      return;
    }

    try {
      isConnectingRef.current = true;
      setConnectionState(prev => ({
        ...prev,
        status: 'connecting',
      }));

      const params = new URLSearchParams({ tenantId });
      if (userId) params.append('userId', userId);

      // Prefer the Redis-backed SSE endpoint, which receives worker-published events.
      const url = `/api/events/redis-sse?${params.toString()}`;
      
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        isConnectingRef.current = false;
        setIsConnected(true);
        setError(null);
        
        // Reset reconnection manager on successful connection
        reconnectionManagerRef.current?.onSuccess();
        
        const state = reconnectionManagerRef.current?.getState();
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
        } catch {
          // Error parsing event
        }
      };

      eventSource.onerror = () => {
        isConnectingRef.current = false;
        setIsConnected(false);
        
        const error = new Error('EventStream connection failed - feature disabled');
        setError(error);
        
        // Only log detailed errors in development
        if (process.env.NODE_ENV === 'development') {
          stableOnError?.(error);
        }
        
        stableOnDisconnect?.();

        // Close the connection
        eventSource.close();
        eventSourceRef.current = null;

        // Don't auto-reconnect for optional SSE feature
        // The app works perfectly without real-time updates
        setConnectionState(prev => ({
          ...prev,
          status: 'disconnected',
        }));
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      isConnectingRef.current = false;
      
      const error = err instanceof Error ? err : new Error('Failed to create EventStream');
      setError(error);
      
      if (process.env.NODE_ENV === 'development') {
        stableOnError?.(error);
      }
      
      setConnectionState(prev => ({
        ...prev,
        status: 'disconnected',
      }));
    }
  }, [tenantId, userId, stableOnEvent, stableOnError, stableOnConnect, stableOnDisconnect]);

  // Store connect function in ref for reconnection manager
  connectFnRef.current = connect;

  const disconnect = useCallback(() => {
    // Cancel any pending reconnection
    reconnectionManagerRef.current?.cancel();

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
    
    isConnectingRef.current = false;
  }, [stableOnDisconnect]);

  const reconnect = useCallback(() => {
    // Reset reconnection manager
    reconnectionManagerRef.current?.reset();
    
    // Disconnect first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
    
    isConnectingRef.current = false;

    // Then connect
    connect();
  }, [connect]);

  useEffect(() => {
    // Only try to connect in development or if explicitly enabled
    if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENABLE_SSE === 'true') {
      connect();
    }

    return () => {
      // Cleanup
      reconnectionManagerRef.current?.cancel();
      
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
      
      isConnectingRef.current = false;
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
