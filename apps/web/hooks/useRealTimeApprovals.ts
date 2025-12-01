'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface ApprovalData {
  id: string;
  status: string;
  [key: string]: any;
}

interface UseRealTimeApprovalsOptions {
  pollingInterval?: number; // in milliseconds
  enablePolling?: boolean;
  onUpdate?: (data: ApprovalData[]) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for real-time approval updates
 * Uses polling for now, can be upgraded to WebSockets later
 */
export function useRealTimeApprovals(options: UseRealTimeApprovalsOptions = {}) {
  const {
    pollingInterval = 15000, // 15 seconds default
    enablePolling = true,
    onUpdate,
    onError,
  } = options;

  const [data, setData] = useState<ApprovalData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const fetchApprovals = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setIsLoading(true);
      
      const response = await fetch('/api/approvals', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch approvals');
      }
      
      const json = await response.json();
      
      if (isMountedRef.current) {
        const items = json.data?.items || json.approvals || [];
        setData(items);
        setLastUpdated(new Date());
        setError(null);
        onUpdate?.(items);
      }
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current && isInitial) {
        setIsLoading(false);
      }
    }
  }, [onUpdate, onError]);

  // Initial fetch
  useEffect(() => {
    fetchApprovals(true);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchApprovals]);

  // Polling
  useEffect(() => {
    if (!enablePolling) return;
    
    pollingRef.current = setInterval(() => {
      fetchApprovals(false);
    }, pollingInterval);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [enablePolling, pollingInterval, fetchApprovals]);

  // Manual refresh
  const refresh = useCallback(() => {
    return fetchApprovals(false);
  }, [fetchApprovals]);

  // Optimistic update for approving
  const optimisticApprove = useCallback((approvalId: string) => {
    setData(prev => prev.map(item =>
      item.id === approvalId
        ? { ...item, status: 'approved', _optimistic: true }
        : item
    ));
  }, []);

  // Optimistic update for rejecting
  const optimisticReject = useCallback((approvalId: string) => {
    setData(prev => prev.map(item =>
      item.id === approvalId
        ? { ...item, status: 'rejected', _optimistic: true }
        : item
    ));
  }, []);

  // Rollback optimistic update
  const rollbackOptimistic = useCallback((approvalId: string, originalStatus: string) => {
    setData(prev => prev.map(item =>
      item.id === approvalId
        ? { ...item, status: originalStatus, _optimistic: false }
        : item
    ));
  }, []);

  // Invalidate and refetch
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
    return fetchApprovals(false);
  }, [queryClient, fetchApprovals]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refresh,
    invalidate,
    optimisticApprove,
    optimisticReject,
    rollbackOptimistic,
  };
}

/**
 * Hook for handling approval actions with optimistic updates
 */
interface UseApprovalActionsOptions {
  onSuccess?: (action: string, approvalId: string) => void;
  onError?: (action: string, approvalId: string, error: Error) => void;
}

export function useApprovalActions(options: UseApprovalActionsOptions = {}) {
  const { onSuccess, onError } = options;
  const [pendingActions, setPendingActions] = useState<Map<string, string>>(new Map());
  const queryClient = useQueryClient();

  const performAction = useCallback(async (
    action: 'approve' | 'reject' | 'delegate' | 'escalate',
    approvalId: string,
    additionalData?: Record<string, any>
  ) => {
    // Mark as pending
    setPendingActions(prev => new Map(prev).set(approvalId, action));
    
    try {
      const response = await fetch('/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify({
          action,
          approvalId,
          ...additionalData,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} approval`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        onSuccess?.(action, approvalId);
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
        return { success: true, data: result };
      } else {
        throw new Error(result.error || `Failed to ${action}`);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      onError?.(action, approvalId, error);
      return { success: false, error };
    } finally {
      // Clear pending state
      setPendingActions(prev => {
        const next = new Map(prev);
        next.delete(approvalId);
        return next;
      });
    }
  }, [onSuccess, onError, queryClient]);

  const approve = useCallback((approvalId: string, comment?: string) => {
    return performAction('approve', approvalId, { comment });
  }, [performAction]);

  const reject = useCallback((approvalId: string, reason: string) => {
    return performAction('reject', approvalId, { reason });
  }, [performAction]);

  const delegate = useCallback((approvalId: string, delegateTo: string, note?: string) => {
    return performAction('delegate', approvalId, { delegateTo, note });
  }, [performAction]);

  const escalate = useCallback((approvalId: string) => {
    return performAction('escalate', approvalId);
  }, [performAction]);

  const isPending = useCallback((approvalId: string) => {
    return pendingActions.has(approvalId);
  }, [pendingActions]);

  const getPendingAction = useCallback((approvalId: string) => {
    return pendingActions.get(approvalId);
  }, [pendingActions]);

  return {
    approve,
    reject,
    delegate,
    escalate,
    isPending,
    getPendingAction,
    pendingActions,
  };
}

/**
 * Hook for bulk approval actions
 */
interface UseBulkApprovalActionsOptions {
  onProgress?: (processed: number, total: number) => void;
  onComplete?: (results: { successful: number; failed: number }) => void;
}

export function useBulkApprovalActions(options: UseBulkApprovalActionsOptions = {}) {
  const { onProgress, onComplete } = options;
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const queryClient = useQueryClient();

  const bulkAction = useCallback(async (
    action: 'approve' | 'reject',
    approvalIds: string[],
    reason?: string
  ) => {
    setIsProcessing(true);
    setProcessedCount(0);
    setTotalCount(approvalIds.length);
    
    let successful = 0;
    let failed = 0;
    
    // Process in batches of 5 for better UX
    const batchSize = 5;
    for (let i = 0; i < approvalIds.length; i += batchSize) {
      const batch = approvalIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (id) => {
        try {
          const response = await fetch('/api/approvals', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': 'demo',
            },
            body: JSON.stringify({
              action,
              approvalId: id,
              ...(reason && { reason }),
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              successful++;
            } else {
              failed++;
            }
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
        
        setProcessedCount(prev => {
          const next = prev + 1;
          onProgress?.(next, approvalIds.length);
          return next;
        });
      }));
    }
    
    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
    onComplete?.({ successful, failed });
    
    return { successful, failed };
  }, [queryClient, onProgress, onComplete]);

  const bulkApprove = useCallback((approvalIds: string[]) => {
    return bulkAction('approve', approvalIds);
  }, [bulkAction]);

  const bulkReject = useCallback((approvalIds: string[], reason: string) => {
    return bulkAction('reject', approvalIds, reason);
  }, [bulkAction]);

  return {
    isProcessing,
    processedCount,
    totalCount,
    bulkApprove,
    bulkReject,
  };
}

export default useRealTimeApprovals;
