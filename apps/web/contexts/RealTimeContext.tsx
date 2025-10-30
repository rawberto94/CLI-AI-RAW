/**
 * RealTimeContext
 * Provides global real-time event broadcasting and connection state management
 */

'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { useEventStream, StreamEvent } from '@/hooks/useEventStream';
import { useToast } from '@/hooks/useToast';

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
  tenantId = 'demo',
  userId,
  showConnectionToasts = true,
  autoReconnect = true,
}: RealTimeProviderProps) {
  const toast = useToast();
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [subscribers, setSubscribers] = useState<Map<string, Set<(data: any) => void>>>(
    new Map()
  );

  // Handle incoming events
  const handleEvent = useCallback((event: StreamEvent) => {
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
  }, [subscribers]);

  // Handle connection errors
  const handleError = useCallback((error: Error) => {
    console.error('[RealTimeProvider] Connection error:', error);
    setConnectionAttempts(prev => prev + 1);
    
    if (showConnectionToasts) {
      toast.warning('Attempting to reconnect to real-time updates...');
    }
  }, [showConnectionToasts, toast]);

  // Handle successful connection
  const handleConnect = useCallback(() => {
    console.log('[RealTimeProvider] Connected to real-time updates');
    setConnectionAttempts(0);
    
    if (showConnectionToasts) {
      toast.success('Real-time updates are now active');
    }
  }, [showConnectionToasts, toast]);

  // Handle disconnection
  const handleDisconnect = useCallback(() => {
    console.log('[RealTimeProvider] Disconnected from real-time updates');
    
    if (showConnectionToasts && connectionAttempts > 0) {
      toast.warning('Real-time updates are temporarily unavailable');
    }
  }, [showConnectionToasts, toast, connectionAttempts]);

  // Use the event stream hook
  const { isConnected, lastEvent, error, reconnect, disconnect } = useEventStream({
    tenantId,
    userId,
    autoReconnect,
    reconnectInterval: 3000,
    onEvent: handleEvent,
    onError: handleError,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
  });

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
