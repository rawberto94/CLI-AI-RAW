/**
 * Type-safe Event Emitter
 * For component communication and decoupled architecture
 * 
 * @example
 * // Define event map
 * interface AppEvents {
 *   'contract:created': { id: string; name: string };
 *   'contract:updated': { id: string; changes: Partial<Contract> };
 *   'user:logout': void;
 * }
 * 
 * // Create typed emitter
 * const events = new TypedEventEmitter<AppEvents>();
 * 
 * // Subscribe (with auto-cleanup in React)
 * const unsubscribe = events.on('contract:created', (data) => {
 *   console.log('Created:', data.id, data.name);
 * });
 * 
 * // Emit
 * events.emit('contract:created', { id: '123', name: 'New Contract' });
 * 
 * // Cleanup
 * unsubscribe();
 */

// ============================================================================
// Types
// ============================================================================

export type EventHandler<T = void> = T extends void ? () => void : (data: T) => void;

export type Unsubscribe = () => void;

// ============================================================================
// Typed Event Emitter
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEventEmitter<Events extends Record<string, any>> {
  private handlers = new Map<keyof Events, Set<EventHandler<unknown>>>();
  private onceHandlers = new Map<keyof Events, Set<EventHandler<unknown>>>();

  /**
   * Subscribe to an event
   */
  on<K extends keyof Events>(
    event: K,
    handler: EventHandler<Events[K]>
  ): Unsubscribe {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);

    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Subscribe to an event once
   */
  once<K extends keyof Events>(
    event: K,
    handler: EventHandler<Events[K]>
  ): Unsubscribe {
    if (!this.onceHandlers.has(event)) {
      this.onceHandlers.set(event, new Set());
    }
    this.onceHandlers.get(event)!.add(handler as EventHandler<unknown>);

    return () => {
      this.onceHandlers.get(event)?.delete(handler as EventHandler<unknown>);
    };
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends keyof Events>(
    event: K,
    handler: EventHandler<Events[K]>
  ): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
    this.onceHandlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  /**
   * Emit an event
   */
  emit<K extends keyof Events>(
    ...args: Events[K] extends void ? [event: K] : [event: K, data: Events[K]]
  ): void {
    const [event, data] = args;

    // Call regular handlers
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          (handler as EventHandler<Events[K]>)(data as Events[K]);
        } catch (error) {
          console.error(`Error in event handler for "${String(event)}":`, error);
        }
      }
    }

    // Call once handlers and remove them
    const onceHandlers = this.onceHandlers.get(event);
    if (onceHandlers) {
      for (const handler of onceHandlers) {
        try {
          (handler as EventHandler<Events[K]>)(data as Events[K]);
        } catch (error) {
          console.error(`Error in once handler for "${String(event)}":`, error);
        }
      }
      this.onceHandlers.delete(event);
    }
  }

  /**
   * Remove all handlers for an event
   */
  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event) {
      this.handlers.delete(event);
      this.onceHandlers.delete(event);
    } else {
      this.handlers.clear();
      this.onceHandlers.clear();
    }
  }

  /**
   * Get listener count for an event
   */
  listenerCount<K extends keyof Events>(event: K): number {
    const regular = this.handlers.get(event)?.size || 0;
    const once = this.onceHandlers.get(event)?.size || 0;
    return regular + once;
  }

  /**
   * Check if event has listeners
   */
  hasListeners<K extends keyof Events>(event: K): boolean {
    return this.listenerCount(event) > 0;
  }

  /**
   * Get all event names with handlers
   */
  eventNames(): (keyof Events)[] {
    const names = new Set<keyof Events>();
    for (const key of this.handlers.keys()) names.add(key);
    for (const key of this.onceHandlers.keys()) names.add(key);
    return Array.from(names);
  }
}

// ============================================================================
// Application Event Types
// ============================================================================

export interface AppEvents {
  // Contract events
  'contract:created': { id: string; name: string };
  'contract:updated': { id: string };
  'contract:deleted': { id: string };
  'contract:processing:started': { id: string };
  'contract:processing:completed': { id: string };
  'contract:processing:failed': { id: string; error: string };

  // Artifact events
  'artifact:generated': { contractId: string; type: string };
  'artifact:updated': { contractId: string; type: string };

  // UI events
  'sidebar:toggle': void;
  'modal:open': { id: string; data?: unknown };
  'modal:close': { id: string };
  'toast:show': { message: string; type: 'success' | 'error' | 'warning' | 'info' };

  // Data events
  'cache:invalidate': { key: string };
  'data:refresh': { resource: string };

  // User events
  'user:login': { userId: string };
  'user:logout': void;
  'user:preferences:changed': { key: string; value: unknown };

  // Navigation events
  'navigation:start': { url: string };
  'navigation:complete': { url: string };
}

// ============================================================================
// Global Event Bus
// ============================================================================

export const eventBus = new TypedEventEmitter<AppEvents>();

// ============================================================================
// React Hook
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';

/**
 * Subscribe to events with automatic cleanup
 */
export function useEvent<K extends keyof AppEvents>(
  event: K,
  handler: EventHandler<AppEvents[K]>,
  deps: React.DependencyList = []
): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const wrappedHandler = (data: unknown) => {
      (handlerRef.current as (data: unknown) => void)(data);
    };

    return eventBus.on(event, wrappedHandler as EventHandler<AppEvents[K]>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

/**
 * Get emit function for specific event
 */
export function useEmit<K extends keyof AppEvents>(
  event: K
): AppEvents[K] extends void ? () => void : (data: AppEvents[K]) => void {
  return useCallback(
    ((data?: AppEvents[K]) => {
      if (data === undefined) {
        // @ts-expect-error - Conditional emit based on event type
        eventBus.emit(event);
      } else {
        // @ts-expect-error - Conditional emit based on event type
        eventBus.emit(event, data);
      }
    }) as AppEvents[K] extends void ? () => void : (data: AppEvents[K]) => void,
    [event]
  );
}

// ============================================================================
// Event Helpers
// ============================================================================

/**
 * Create a namespaced event emitter
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createNamespacedEmitter<Events extends Record<string, any> = Record<string, unknown>>(
  namespace: string
): TypedEventEmitter<Events> & { namespace: string } {
  const emitter = new TypedEventEmitter<Events>();
  return Object.assign(emitter, { namespace });
}

/**
 * Debounced emit
 */
export function createDebouncedEmitter<K extends keyof AppEvents>(
  event: K,
  delay: number
): (...args: AppEvents[K] extends void ? [] : [data: AppEvents[K]]) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (args.length === 0) {
        // @ts-expect-error - Conditional emit based on event type
        eventBus.emit(event);
      } else {
        // @ts-expect-error - Conditional emit based on event type
        eventBus.emit(event, args[0]);
      }
    }, delay);
  };
}

/**
 * Wait for an event (Promise-based)
 */
export function waitForEvent<K extends keyof AppEvents>(
  event: K,
  timeout?: number
): Promise<AppEvents[K]> {
  return new Promise((resolve, reject) => {
    const unsubscribe = eventBus.once(event, ((data: AppEvents[K]) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve(data);
    }) as EventHandler<AppEvents[K]>);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeout) {
      timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for event: ${String(event)}`));
      }, timeout);
    }
  });
}
