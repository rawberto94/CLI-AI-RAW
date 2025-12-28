/**
 * RealTimeContext
 * Provides global real-time event broadcasting and connection state management
 */

'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useEventStream, StreamEvent } from '@/hooks/useEventStream';
import { useToast } from '@/hooks/useToast';
import { getTenantId } from '@/lib/tenant';

export interface RealTimeContextValue {
  isConnected: boolean;
  lastEvent: StreamEvent | null;
  error: Error | null;
  reconnect: () => void;
  disconnect: () => void;
  connectionAttempts: number;
  subscribe: (eventType: string, handler: (data: any) => void) => () => void;
  broadcast: (eventType: string, data: any) => void;
}

const RealTimeContext = createContext<RealTimeContextValue | undefined>(undefined);

export interface RealTimeProviderProps {
  children: React.ReactNode;
  tenantId?: string;
  userId?: string;
  showConnectionToasts?: boolean;
  autoReconnect?: boolean;
}

export function RealTimeProvider({
  children,
  tenantId,
  userId,
  showConnectionToasts = false, // Disabled by default since SSE is optional
  autoReconnect = false, // Disabled by default to reduce noise
}: RealTimeProviderProps) {
  const toast = useToast();
  const resolvedTenantId = tenantId ?? getTenantId();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [subscribers, setSubscribers] = useState<Map<string, Set<(data: any) => void>>>(
    new Map()
  );

  // Bridge server-sent events into the app-wide real-time event bus
  // that React Query cache sync listens to.
  const dispatchRealTimeEvent = useCallback((type: string, data: any) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('realtime-event', {
        detail: { type, data },
      })
    );
  }, []);

  const normalizeEventTypes = useCallback((type: string): string[] => {
    switch (type) {
      // Align SSE contract completion to the processing events that the cache sync expects.
      case 'contract:completed':
        return ['processing:completed', 'contract:updated'];

      // Artifacts/jobs map to processing progress for broad invalidation.
      case 'artifact:generated':
      case 'artifact:updated':
      case 'artifact:created':
      case 'job:progress':
      case 'job:status':
      case 'job:status:changed':
      case 'job:created':
      case 'job:completed':
        return ['processing:progress', 'contract:updated'];

      case 'job:failed':
      case 'job:error':
        return ['processing:failed', 'contract:updated'];

      // Cache sync currently keys off ratecard updated/imported/deleted.
      case 'ratecard:created':
        return ['ratecard:updated'];

      // Cache sync expects notification:new.
      case 'notification':
        return ['notification:new'];

      // Benchmarks affect dashboards/analytics broadly.
      case 'benchmark:calculated':
      case 'benchmark:invalidated':
        return ['data:refresh'];

      default:
        return [type];
    }
  }, []);

  // Handle incoming events
  const handleEvent = useCallback((event: StreamEvent) => {
    // Fan out to the global query-cache sync layer.
    if (event?.type && event.type !== 'connected') {
      const eventTypes = normalizeEventTypes(event.type);
      eventTypes.forEach((t) => dispatchRealTimeEvent(t, event.data));
    }

    // Broadcast to all subscribers of this event type
    const handlers = subscribers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event.data);
        } catch (error) {
          console.error(`[RealTimeProvider] Error in event handler for ${event.type}:`, error);
        }
      });
    }

    // Also broadcast to wildcard subscribers
    const wildcardHandlers = subscribers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler({ type: event.type, data: event.data });
        } catch (error) {
          console.error('[RealTimeProvider] Error in wildcard handler:', error);
        }
      });
    }
  }, [dispatchRealTimeEvent, normalizeEventTypes, subscribers]);

  // Handle connection errors
  const handleError = useCallback((error: Error) => {
    // Only log errors in development, don't show toasts for optional SSE feature
    if (process.env.NODE_ENV === 'development') {
      // SSE connection error - optional feature
    }
    setConnectionAttempts(prev => prev + 1);
    
    // Don't show toast notifications for SSE errors since it's an optional feature
    // The app works perfectly without real-time updates
  }, []);

  // Handle successful connection
  const handleConnect = useCallback(() => {
    // Connected to real-time updates
    setConnectionAttempts(0);
    
    // Only show success toast if explicitly enabled and we had previous failures
    if (showConnectionToasts && connectionAttempts > 2) {
      toast.success('Real-time updates are now active');
    }
  }, [showConnectionToasts, toast, connectionAttempts]);

  // Handle disconnection
  const handleDisconnect = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      // Disconnected from real-time updates
    }
    
    // Don't show disconnect warnings for optional SSE feature
  }, []);

  // Use the event stream hook
  const { isConnected, lastEvent, error, reconnect, disconnect } = useEventStream({
    tenantId: resolvedTenantId,
    userId,
    autoReconnect,
    onEvent: handleEvent,
    onError: handleError,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
  } as any);

  // Subscribe to specific event types
  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    setSubscribers(prev => {
      const newSubscribers = new Map(prev);
      const handlers = newSubscribers.get(eventType) || new Set();
      handlers.add(handler);
      newSubscribers.set(eventType, handlers);
      return newSubscribers;
    });

    // Return unsubscribe function
    return () => {
      setSubscribers(prev => {
        const newSubscribers = new Map(prev);
        const handlers = newSubscribers.get(eventType);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            newSubscribers.delete(eventType);
          } else {
            newSubscribers.set(eventType, handlers);
          }
        }
        return newSubscribers;
      });
    };
  }, []);

  // Broadcast events locally (for client-side coordination)
  const broadcast = useCallback((eventType: string, data: any) => {
    const handlers = subscribers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[RealTimeProvider] Error in broadcast handler for ${eventType}:`, error);
        }
      });
    }
  }, [subscribers]);

  const contextValue: RealTimeContextValue = {
    isConnected,
    lastEvent,
    error,
    reconnect,
    disconnect,
    connectionAttempts,
    subscribe,
    broadcast,
  };

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  );
}

/**
 * Hook to access real-time context
 */
export function useRealTime() {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
}

/**
 * Hook to subscribe to specific event types
 */
export function useRealTimeEvent(eventType: string, handler: (data: any) => void) {
  const { subscribe } = useRealTime();

  useEffect(() => {
    const unsubscribe = subscribe(eventType, handler);
    return unsubscribe;
  }, [eventType, handler, subscribe]);
}

/**
 * Hook to subscribe to multiple event types
 */
export function useRealTimeEvents(
  eventHandlers: Record<string, (data: any) => void>
) {
  const { subscribe } = useRealTime();

  useEffect(() => {
    const unsubscribers = Object.entries(eventHandlers).map(([eventType, handler]) =>
      subscribe(eventType, handler)
    );

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [eventHandlers, subscribe]);
}
