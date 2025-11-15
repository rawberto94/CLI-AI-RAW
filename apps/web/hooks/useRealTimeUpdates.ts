/**
 * useRealTimeUpdates Hook
 * High-level hook for handling real-time data updates
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { useEventStream, StreamEvent } from './useEventStream';
import { useToast } from './useToast';

export interface RealTimeUpdateHandlers {
  onContractCreated?: (data: any) => void;
  onContractUpdated?: (data: any) => void;
  onContractCompleted?: (data: any) => void;
  onArtifactGenerated?: (data: any) => void;
  onArtifactUpdated?: (data: any) => void;
  onRateCardCreated?: (data: any) => void;
  onRateCardUpdated?: (data: any) => void;
  onRateCardImported?: (data: any) => void;
  onBenchmarkCalculated?: (data: any) => void;
  onBenchmarkInvalidated?: (data: any) => void;
  onJobProgress?: (data: any) => void;
  onJobStatus?: (data: any) => void;
  onNotification?: (data: any) => void;
}

export interface UseRealTimeUpdatesOptions extends RealTimeUpdateHandlers {
  tenantId?: string;
  userId?: string;
  showToasts?: boolean;
  autoRefresh?: boolean;
}

export function useRealTimeUpdates(options: UseRealTimeUpdatesOptions = {}) {
  const {
    tenantId,
    userId,
    showToasts = true,
    autoRefresh = true,
    ...handlers
  } = options;

  // Note: showToast not available in current useToast implementation
  // const { showToast } = useToast();
  const [updates, setUpdates] = useState<StreamEvent[]>([]);

  const handleEvent = useCallback((event: StreamEvent) => {
    // Add to updates list
    setUpdates(prev => [...prev.slice(-99), event]); // Keep last 100 events

    // Route to specific handlers
    switch (event.type) {
      case 'contract:created':
        handlers.onContractCreated?.(event.data);
        // Toast notification removed - showToast not available
        break;

      case 'contract:updated':
        handlers.onContractUpdated?.(event.data);
        if (autoRefresh) {
          // Trigger a refresh of contract data
          window.dispatchEvent(new CustomEvent('contract:refresh', { 
            detail: { contractId: event.data.contractId }
          }));
        }
        break;

      case 'contract:completed':
        handlers.onContractCompleted?.(event.data);
        if (showToasts) {
        }
        if (autoRefresh) {
          window.dispatchEvent(new CustomEvent('contract:refresh', { 
            detail: { contractId: event.data.contractId }
          }));
        }
        break;

      case 'artifact:generated':
        handlers.onArtifactGenerated?.(event.data);
        if (autoRefresh) {
          window.dispatchEvent(new CustomEvent('artifacts:refresh', { 
            detail: { contractId: event.data.contractId }
          }));
        }
        break;

      case 'artifact:updated':
        handlers.onArtifactUpdated?.(event.data);
        if (autoRefresh) {
          window.dispatchEvent(new CustomEvent('artifacts:refresh', { 
            detail: { artifactId: event.data.artifactId }
          }));
        }
        break;

      case 'ratecard:created':
        handlers.onRateCardCreated?.(event.data);
        if (autoRefresh) {
          window.dispatchEvent(new CustomEvent('ratecards:refresh'));
        }
        break;

      case 'ratecard:updated':
        handlers.onRateCardUpdated?.(event.data);
        if (autoRefresh) {
          window.dispatchEvent(new CustomEvent('ratecards:refresh'));
        }
        break;

      case 'ratecard:imported':
        handlers.onRateCardImported?.(event.data);
        if (showToasts) {
        }
        if (autoRefresh) {
          window.dispatchEvent(new CustomEvent('ratecards:refresh'));
        }
        break;

      case 'benchmark:calculated':
        handlers.onBenchmarkCalculated?.(event.data);
        if (autoRefresh) {
          window.dispatchEvent(new CustomEvent('benchmarks:refresh'));
        }
        break;

      case 'benchmark:invalidated':
        handlers.onBenchmarkInvalidated?.(event.data);
        if (autoRefresh) {
          window.dispatchEvent(new CustomEvent('benchmarks:refresh'));
        }
        break;

      case 'job:progress':
        handlers.onJobProgress?.(event.data);
        // Update job progress UI
        window.dispatchEvent(new CustomEvent('job:progress', { 
          detail: event.data 
        }));
        break;

      case 'job:status':
        handlers.onJobStatus?.(event.data);
        window.dispatchEvent(new CustomEvent('job:status', { 
          detail: event.data 
        }));
        break;

      case 'notification':
        handlers.onNotification?.(event.data);
        if (showToasts) {
        }
        break;

      default:
        console.log('[RealTimeUpdates] Unhandled event type:', event.type);
    }
  }, [handlers, showToasts, autoRefresh]);

  const { isConnected, lastEvent, error, reconnect, disconnect } = useEventStream({
    tenantId,
    userId,
    onEvent: handleEvent,
    onError: (err) => {
      console.error('[RealTimeUpdates] Connection error:', err);
      if (showToasts) {
      }
    },
    onConnect: () => {
      console.log('[RealTimeUpdates] Connected to real-time updates');
      if (showToasts) {
      }
    }
  });

  return {
    isConnected,
    lastEvent,
    updates,
    error,
    reconnect,
    disconnect,
  };
}

/**
 * Hook for listening to specific entity updates
 */
export function useEntityUpdates(entityType: string, entityId: string, onUpdate: (data: any) => void) {
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      const detail = event.detail;
      
      // Check if this event is for our entity
      if (entityType === 'contract' && detail.contractId === entityId) {
        onUpdate(detail);
      } else if (entityType === 'artifact' && detail.artifactId === entityId) {
        onUpdate(detail);
      } else if (entityType === 'ratecard' && detail.rateCardId === entityId) {
        onUpdate(detail);
      }
    };

    const eventName = `${entityType}:refresh`;
    window.addEventListener(eventName as any, handleRefresh as any);

    return () => {
      window.removeEventListener(eventName as any, handleRefresh as any);
    };
  }, [entityType, entityId, onUpdate]);
}
