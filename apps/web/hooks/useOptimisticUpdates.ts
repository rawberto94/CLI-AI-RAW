'use client';

/**
 * Optimistic UI Updates Hook
 * Provides instant feedback while operations complete in the background
 */

import { useState, useCallback, useRef } from 'react';

// ============================================
// Types
// ============================================

type OptimisticState<T> = {
  data: T;
  pending: boolean;
  error: Error | null;
  rollback: T | null;
};

type OptimisticAction<T, P = void> = {
  execute: (params: P) => Promise<T>;
  optimisticUpdate: (current: T, params: P) => T;
  rollbackOnError?: boolean;
};

// ============================================
// Optimistic Update Hook
// ============================================

export function useOptimisticUpdate<T>(initialData: T) {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    pending: false,
    error: null,
    rollback: null,
  });

  const pendingRef = useRef<number>(0);

  const mutate = useCallback(
    async <P = void>(action: OptimisticAction<T, P>, params: P): Promise<boolean> => {
      const operationId = ++pendingRef.current;
      const { execute, optimisticUpdate, rollbackOnError = true } = action;

      // Store current state for potential rollback
      const previousData = state.data;

      // Apply optimistic update
      setState(prev => ({
        ...prev,
        data: optimisticUpdate(prev.data, params),
        pending: true,
        error: null,
        rollback: previousData,
      }));

      try {
        // Execute actual operation
        const result = await execute(params);

        // Only update if this is still the latest operation
        if (pendingRef.current === operationId) {
          setState(prev => ({
            ...prev,
            data: result,
            pending: false,
            error: null,
            rollback: null,
          }));
        }

        return true;
      } catch (error) {
        // Only handle if this is still the latest operation
        if (pendingRef.current === operationId) {
          setState(prev => ({
            ...prev,
            data: rollbackOnError ? previousData : prev.data,
            pending: false,
            error: error instanceof Error ? error : new Error('Operation failed'),
            rollback: null,
          }));
        }

        return false;
      }
    },
    [state.data]
  );

  const setData = useCallback((updater: T | ((prev: T) => T)) => {
    setState(prev => ({
      ...prev,
      data: typeof updater === 'function' ? (updater as (prev: T) => T)(prev.data) : updater,
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    data: state.data,
    pending: state.pending,
    error: state.error,
    mutate,
    setData,
    clearError,
  };
}

// ============================================
// Optimistic List Hook
// ============================================

export interface OptimisticListItem {
  id: string;
  [key: string]: unknown;
}

export function useOptimisticList<T extends OptimisticListItem>(initialItems: T[] = []) {
  const { data: items, pending, error, mutate, setData, clearError } = useOptimisticUpdate(initialItems);

  // Add item optimistically
  const addItem = useCallback(
    async (
      newItem: T,
      createFn: (item: T) => Promise<T>
    ): Promise<boolean> => {
      return mutate(
        {
          execute: async () => {
            const created = await createFn(newItem);
            return [...items.filter(i => i.id !== newItem.id), created];
          },
          optimisticUpdate: (current) => [...current, newItem],
        },
        undefined
      );
    },
    [items, mutate]
  );

  // Update item optimistically
  const updateItem = useCallback(
    async (
      id: string,
      updates: Partial<T>,
      updateFn: (id: string, updates: Partial<T>) => Promise<T>
    ): Promise<boolean> => {
      return mutate(
        {
          execute: async () => {
            const updated = await updateFn(id, updates);
            return items.map(item => (item.id === id ? updated : item));
          },
          optimisticUpdate: (current) =>
            current.map(item => (item.id === id ? { ...item, ...updates } : item)),
        },
        undefined
      );
    },
    [items, mutate]
  );

  // Remove item optimistically
  const removeItem = useCallback(
    async (
      id: string,
      deleteFn: (id: string) => Promise<void>
    ): Promise<boolean> => {
      return mutate(
        {
          execute: async () => {
            await deleteFn(id);
            return items.filter(item => item.id !== id);
          },
          optimisticUpdate: (current) => current.filter(item => item.id !== id),
        },
        undefined
      );
    },
    [items, mutate]
  );

  // Reorder items optimistically
  const reorderItems = useCallback(
    async (
      fromIndex: number,
      toIndex: number,
      reorderFn: (orderedIds: string[]) => Promise<void>
    ): Promise<boolean> => {
      return mutate(
        {
          execute: async () => {
            const reordered = [...items];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);
            await reorderFn(reordered.map(i => i.id));
            return reordered;
          },
          optimisticUpdate: (current) => {
            const reordered = [...current];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);
            return reordered;
          },
        },
        undefined
      );
    },
    [items, mutate]
  );

  return {
    items,
    pending,
    error,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    setItems: setData,
    clearError,
  };
}

// ============================================
// Optimistic Toggle Hook
// ============================================

export function useOptimisticToggle(initialValue: boolean = false) {
  const { data: value, pending, error, mutate, clearError } = useOptimisticUpdate(initialValue);

  const toggle = useCallback(
    async (updateFn: (newValue: boolean) => Promise<boolean>): Promise<boolean> => {
      return mutate(
        {
          execute: async () => {
            const newValue = !value;
            await updateFn(newValue);
            return newValue;
          },
          optimisticUpdate: (current) => !current,
        },
        undefined
      );
    },
    [value, mutate]
  );

  const setValue = useCallback(
    async (
      newValue: boolean,
      updateFn: (value: boolean) => Promise<boolean>
    ): Promise<boolean> => {
      return mutate(
        {
          execute: async () => {
            await updateFn(newValue);
            return newValue;
          },
          optimisticUpdate: () => newValue,
        },
        undefined
      );
    },
    [mutate]
  );

  return {
    value,
    pending,
    error,
    toggle,
    setValue,
    clearError,
  };
}

// ============================================
// Optimistic Counter Hook
// ============================================

export function useOptimisticCounter(initialValue: number = 0) {
  const { data: count, pending, error, mutate, clearError } = useOptimisticUpdate(initialValue);

  const increment = useCallback(
    async (
      amount: number = 1,
      updateFn: (newValue: number) => Promise<number>
    ): Promise<boolean> => {
      return mutate(
        {
          execute: async () => {
            const newValue = count + amount;
            return await updateFn(newValue);
          },
          optimisticUpdate: (current) => current + amount,
        },
        undefined
      );
    },
    [count, mutate]
  );

  const decrement = useCallback(
    async (
      amount: number = 1,
      updateFn: (newValue: number) => Promise<number>
    ): Promise<boolean> => {
      return mutate(
        {
          execute: async () => {
            const newValue = Math.max(0, count - amount);
            return await updateFn(newValue);
          },
          optimisticUpdate: (current) => Math.max(0, current - amount),
        },
        undefined
      );
    },
    [count, mutate]
  );

  return {
    count,
    pending,
    error,
    increment,
    decrement,
    clearError,
  };
}

// ============================================
// Batch Optimistic Updates Hook
// ============================================

export function useBatchOptimisticUpdates<T>(initialData: T) {
  const { data, pending, error, mutate, setData, clearError } = useOptimisticUpdate(initialData);
  const pendingUpdates = useRef<Map<string, Partial<T>>>(new Map());

  const queueUpdate = useCallback(
    (id: string, update: Partial<T>) => {
      pendingUpdates.current.set(id, {
        ...(pendingUpdates.current.get(id) || {}),
        ...update,
      });
    },
    []
  );

  const flushUpdates = useCallback(
    async (
      executeFn: (updates: Map<string, Partial<T>>) => Promise<T>
    ): Promise<boolean> => {
      if (pendingUpdates.current.size === 0) return true;

      const updates = new Map(pendingUpdates.current);
      pendingUpdates.current.clear();

      return mutate(
        {
          execute: () => executeFn(updates),
          optimisticUpdate: (current) => {
            // Merge all pending updates into current state
            let result = current;
            updates.forEach((update) => {
              result = { ...result, ...update };
            });
            return result;
          },
        },
        undefined
      );
    },
    [mutate]
  );

  return {
    data,
    pending,
    error,
    queueUpdate,
    flushUpdates,
    setData,
    clearError,
    hasPendingUpdates: pendingUpdates.current.size > 0,
  };
}

export default useOptimisticUpdate;
