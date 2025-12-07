/**
 * Background Sync & Offline Support
 * 
 * Handles:
 * - Queuing mutations when offline
 * - Syncing when back online
 * - Showing sync status in UI
 * - Retry with exponential backoff
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// =====================
// Types
// =====================

interface PendingMutation {
  id: string;
  type: string;
  url: string;
  method: string;
  body?: string;
  timestamp: number;
  retries: number;
}

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: Date | null;
}

// =====================
// Storage Keys
// =====================

const PENDING_MUTATIONS_KEY = 'contigo:pending-mutations';
const LAST_SYNC_KEY = 'contigo:last-sync';

// =====================
// Utilities
// =====================

function getPendingMutations(): PendingMutation[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(PENDING_MUTATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePendingMutations(mutations: PendingMutation[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(mutations));
}

function addPendingMutation(mutation: Omit<PendingMutation, 'id' | 'timestamp' | 'retries'>): void {
  const mutations = getPendingMutations();
  mutations.push({
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retries: 0,
  });
  savePendingMutations(mutations);
}

function removePendingMutation(id: string): void {
  const mutations = getPendingMutations();
  savePendingMutations(mutations.filter(m => m.id !== id));
}

function updateMutationRetries(id: string): void {
  const mutations = getPendingMutations();
  const updated = mutations.map(m => 
    m.id === id ? { ...m, retries: m.retries + 1 } : m
  );
  savePendingMutations(updated);
}

// =====================
// Background Sync Hook
// =====================

/**
 * Manages background sync and offline support
 * 
 * @example
 * const { status, syncNow, queueMutation } = useBackgroundSync();
 * 
 * // Queue a mutation when offline
 * queueMutation({
 *   type: 'delete-contract',
 *   url: '/api/contracts/123',
 *   method: 'DELETE',
 * });
 * 
 * // Show sync status
 * {status.pendingCount > 0 && <Badge>Syncing {status.pendingCount} changes...</Badge>}
 */
export function useBackgroundSync() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    isSyncing: false,
    lastSyncAt: null,
  });
  const syncingRef = useRef(false);

  // Update pending count
  const updatePendingCount = useCallback(() => {
    const mutations = getPendingMutations();
    setStatus(prev => ({ ...prev, pendingCount: mutations.length }));
  }, []);

  // Process a single pending mutation
  const processMutation = useCallback(async (mutation: PendingMutation): Promise<boolean> => {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: mutation.body,
      });

      if (response.ok) {
        removePendingMutation(mutation.id);
        return true;
      } else if (response.status >= 400 && response.status < 500) {
        // Client error - don't retry
        removePendingMutation(mutation.id);
        console.warn(`Mutation ${mutation.id} failed with client error, removing from queue`);
        return false;
      } else {
        // Server error - retry later
        updateMutationRetries(mutation.id);
        return false;
      }
    } catch (error) {
      // Network error - keep in queue
      updateMutationRetries(mutation.id);
      return false;
    }
  }, []);

  // Sync all pending mutations
  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;

    const mutations = getPendingMutations();
    if (mutations.length === 0) return;

    syncingRef.current = true;
    setStatus(prev => ({ ...prev, isSyncing: true }));

    let successCount = 0;
    const maxRetries = 3;

    for (const mutation of mutations) {
      if (mutation.retries >= maxRetries) {
        // Too many retries - remove and notify
        removePendingMutation(mutation.id);
        toast.error(`Failed to sync: ${mutation.type}`);
        continue;
      }

      const success = await processMutation(mutation);
      if (success) {
        successCount++;
      }

      // Small delay between mutations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Invalidate all queries after sync
    if (successCount > 0) {
      queryClient.invalidateQueries();
      toast.success(`Synced ${successCount} change(s)`);
    }

    const lastSyncAt = new Date();
    localStorage.setItem(LAST_SYNC_KEY, lastSyncAt.toISOString());

    syncingRef.current = false;
    setStatus(prev => ({
      ...prev,
      isSyncing: false,
      lastSyncAt,
      pendingCount: getPendingMutations().length,
    }));
  }, [processMutation, queryClient]);

  // Queue a mutation for later sync
  const queueMutation = useCallback((
    mutation: Omit<PendingMutation, 'id' | 'timestamp' | 'retries'>
  ) => {
    addPendingMutation(mutation);
    updatePendingCount();
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      syncNow();
    } else {
      toast.info('Offline - change queued for sync');
    }
  }, [updatePendingCount, syncNow]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('Back online');
      syncNow();
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
      toast.warning('You are offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    updatePendingCount();
    if (navigator.onLine && getPendingMutations().length > 0) {
      syncNow();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow, updatePendingCount]);

  return {
    status,
    syncNow,
    queueMutation,
    clearPending: () => {
      savePendingMutations([]);
      updatePendingCount();
    },
  };
}

// =====================
// Offline-Aware Mutation
// =====================

/**
 * Creates a mutation that works offline
 * Falls back to queuing when offline
 * 
 * @example
 * const deleteContract = useOfflineMutation({
 *   type: 'delete-contract',
 *   mutationFn: (id) => fetch(`/api/contracts/${id}`, { method: 'DELETE' }),
 *   getOfflinePayload: (id) => ({
 *     url: `/api/contracts/${id}`,
 *     method: 'DELETE',
 *   }),
 *   onSuccess: () => queryClient.invalidateQueries(['contracts']),
 * });
 */
interface OfflineMutationOptions<TVariables> {
  type: string;
  mutationFn: (variables: TVariables) => Promise<unknown>;
  getOfflinePayload: (variables: TVariables) => { url: string; method: string; body?: string };
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useOfflineMutation<TVariables>({
  type,
  mutationFn,
  getOfflinePayload,
  onSuccess,
  onError,
}: OfflineMutationOptions<TVariables>) {
  const { queueMutation } = useBackgroundSync();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      if (!navigator.onLine) {
        // Queue for later
        const payload = getOfflinePayload(variables);
        queueMutation({ type, ...payload });
        return { queued: true };
      }
      return mutationFn(variables);
    },
    onSuccess: (result) => {
      if (result && typeof result === 'object' && 'queued' in result && result.queued) {
        // Already toasted in queueMutation
        return;
      }
      onSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

// =====================
// Sync Status Component Helper
// =====================

/**
 * Returns props for displaying sync status
 */
export function getSyncStatusDisplay(status: SyncStatus) {
  if (!status.isOnline) {
    return {
      label: 'Offline',
      color: 'red' as const,
      icon: 'wifi-off',
    };
  }

  if (status.isSyncing) {
    return {
      label: `Syncing ${status.pendingCount}...`,
      color: 'yellow' as const,
      icon: 'refresh',
    };
  }

  if (status.pendingCount > 0) {
    return {
      label: `${status.pendingCount} pending`,
      color: 'orange' as const,
      icon: 'clock',
    };
  }

  return {
    label: 'Synced',
    color: 'green' as const,
    icon: 'check',
  };
}
