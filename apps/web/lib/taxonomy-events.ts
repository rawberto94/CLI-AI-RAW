/**
 * Taxonomy Real-Time Event System
 * 
 * Provides instant propagation of taxonomy changes across:
 * - Multiple browser tabs (BroadcastChannel)
 * - Components within the same tab (EventEmitter pattern)
 * - React Query cache invalidation
 * 
 * Usage:
 *   // Subscribe to taxonomy changes
 *   useTaxonomySync()  // Hook for React components
 *   
 *   // Trigger taxonomy update notification
 *   notifyTaxonomyChange('category_created', { categoryId: '123' })
 */

// ============================================================================
// TYPES
// ============================================================================

export type TaxonomyEventType = 
  | 'category_created'
  | 'category_updated'
  | 'category_deleted'
  | 'preset_applied'
  | 'taxonomy_imported'
  | 'taxonomy_cleared';

export interface TaxonomyEvent {
  type: TaxonomyEventType;
  timestamp: number;
  data?: {
    categoryId?: string;
    categoryName?: string;
    presetId?: string;
    count?: number;
    tenantId?: string;
  };
}

type TaxonomyEventListener = (event: TaxonomyEvent) => void;

// ============================================================================
// SINGLETON EVENT EMITTER
// ============================================================================

class TaxonomyEventEmitter {
  private listeners: Set<TaxonomyEventListener> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private initialized = false;

  constructor() {
    // Initialize only in browser environment
    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  private initialize() {
    if (this.initialized) return;
    this.initialized = true;

    // Create BroadcastChannel for cross-tab communication
    try {
      this.broadcastChannel = new BroadcastChannel('contigo_taxonomy_updates');
      this.broadcastChannel.onmessage = (event) => {
        // Received update from another tab - notify local listeners
        if (event.data && event.data.type) {
          this.notifyListeners(event.data as TaxonomyEvent);
        }
      };
    } catch (error) {
      // BroadcastChannel not supported - fall back to localStorage events
      console.warn('BroadcastChannel not supported, using localStorage fallback');
      this.setupLocalStorageFallback();
    }
  }

  private setupLocalStorageFallback() {
    window.addEventListener('storage', (event) => {
      if (event.key === 'contigo_taxonomy_update' && event.newValue) {
        try {
          const taxonomyEvent = JSON.parse(event.newValue) as TaxonomyEvent;
          this.notifyListeners(taxonomyEvent);
        } catch {
          // Ignore parse errors
        }
      }
    });
  }

  subscribe(listener: TaxonomyEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: TaxonomyEvent) {
    // Notify local listeners
    this.notifyListeners(event);

    // Broadcast to other tabs
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(event);
    } else if (typeof window !== 'undefined') {
      // localStorage fallback for cross-tab
      localStorage.setItem('contigo_taxonomy_update', JSON.stringify(event));
      // Clear immediately to allow duplicate events
      setTimeout(() => localStorage.removeItem('contigo_taxonomy_update'), 100);
    }
  }

  private notifyListeners(event: TaxonomyEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in taxonomy event listener:', error);
      }
    });
  }

  destroy() {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.listeners.clear();
  }
}

// Singleton instance
export const taxonomyEvents = new TaxonomyEventEmitter();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Notify all components and tabs about a taxonomy change
 */
export function notifyTaxonomyChange(
  type: TaxonomyEventType,
  data?: TaxonomyEvent['data']
) {
  taxonomyEvents.emit({
    type,
    timestamp: Date.now(),
    data,
  });
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/use-queries';

/**
 * Hook to sync taxonomy changes across tabs and components
 * 
 * Automatically invalidates React Query caches when taxonomy changes
 * are detected from other tabs or components.
 */
export function useTaxonomySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = taxonomyEvents.subscribe((event) => {
      console.log('[Taxonomy Sync] Received event:', event.type);
      
      // Invalidate taxonomy caches
      queryClient.invalidateQueries({ queryKey: queryKeys.taxonomy.all });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      
      // If a category was deleted, also refresh contracts in case they used it
      if (event.type === 'category_deleted' || event.type === 'taxonomy_cleared') {
        queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all });
      }
    });

    return unsubscribe;
  }, [queryClient]);
}

/**
 * Hook to listen for specific taxonomy events
 */
export function useTaxonomyEvent(
  eventTypes: TaxonomyEventType | TaxonomyEventType[],
  callback: (event: TaxonomyEvent) => void
) {
  useEffect(() => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    
    const unsubscribe = taxonomyEvents.subscribe((event) => {
      if (types.includes(event.type)) {
        callback(event);
      }
    });

    return unsubscribe;
  }, [eventTypes, callback]);
}
