'use client';

import { useState, useCallback } from 'react';
import type { 
  ContractCategorizationResult,
  ContractTypeCategory,
  IndustrySector,
  RiskLevel,
} from '@/lib/ai/contract-categorizer';

// ============================================================================
// TYPES
// ============================================================================

export interface UseCategorizationOptions {
  tenantId?: string;
  autoApply?: boolean;
  autoApplyThreshold?: number;
  onSuccess?: (result: ContractCategorizationResult) => void;
  onError?: (error: string) => void;
}

export interface CategorizationState {
  isLoading: boolean;
  isQuickLoading: boolean;
  result: ContractCategorizationResult | null;
  quickResult: {
    contractType: ContractTypeCategory;
    riskLevel: RiskLevel;
    confidence: number;
  } | null;
  error: string | null;
  isCategorized: boolean;
  pendingReview: boolean;
}

export interface UseCategorizationReturn extends CategorizationState {
  categorize: (contractId: string, options?: { forceRecategorize?: boolean }) => Promise<void>;
  quickCategorize: (contractId: string) => Promise<void>;
  getStatus: (contractId: string) => Promise<void>;
  applyPending: (contractId: string) => Promise<void>;
  reset: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCategorization(
  options: UseCategorizationOptions = {}
): UseCategorizationReturn {
  const {
    tenantId = 'demo',
    autoApply = true,
    autoApplyThreshold = 0.75,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<CategorizationState>({
    isLoading: false,
    isQuickLoading: false,
    result: null,
    quickResult: null,
    error: null,
    isCategorized: false,
    pendingReview: false,
  });

  /**
   * Full categorization
   */
  const categorize = useCallback(async (
    contractId: string,
    opts?: { forceRecategorize?: boolean }
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/contracts/${contractId}/ai-categorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          synchronous: true,
          autoApply,
          autoApplyThreshold,
          forceRecategorize: opts?.forceRecategorize || false,
        }),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const err = rawData.error;
        throw new Error((typeof err === 'object' ? err?.message : err) || 'Categorization failed');
      }

      const data = rawData.data ?? rawData;
      setState(prev => ({
        ...prev,
        isLoading: false,
        result: data.result,
        isCategorized: true,
        error: null,
      }));

      onSuccess?.(data.result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Categorization failed';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      onError?.(errorMessage);
    }
  }, [tenantId, autoApply, autoApplyThreshold, onSuccess, onError]);

  /**
   * Quick categorization (type + risk only)
   */
  const quickCategorize = useCallback(async (contractId: string) => {
    setState(prev => ({ ...prev, isQuickLoading: true, error: null }));

    try {
      const response = await fetch(`/api/contracts/${contractId}/ai-categorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          synchronous: true,
          quick: true,
          autoApply,
          autoApplyThreshold,
        }),
      });

      const rawData = await response.json();

      if (!response.ok) {
        const err = rawData.error;
        throw new Error((typeof err === 'object' ? err?.message : err) || 'Quick categorization failed');
      }

      const data = rawData.data ?? rawData;
      setState(prev => ({
        ...prev,
        isQuickLoading: false,
        quickResult: data.result,
        isCategorized: data.autoApplied,
        error: null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Quick categorization failed';
      setState(prev => ({
        ...prev,
        isQuickLoading: false,
        error: errorMessage,
      }));
      onError?.(errorMessage);
    }
  }, [tenantId, autoApply, autoApplyThreshold, onError]);

  /**
   * Get current categorization status
   */
  const getStatus = useCallback(async (contractId: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/ai-categorize`, {
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get status');
      }

      setState(prev => ({
        ...prev,
        isCategorized: data.isCategorized,
        pendingReview: data.needsReview,
        result: data.categorization || prev.result,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get status';
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [tenantId]);

  /**
   * Apply pending categorization
   */
  const applyPending = useCallback(async (contractId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/contracts/${contractId}/ai-categorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          applyPending: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply categorization');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        isCategorized: true,
        pendingReview: false,
        error: null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply categorization';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [tenantId]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setState({
      isLoading: false,
      isQuickLoading: false,
      result: null,
      quickResult: null,
      error: null,
      isCategorized: false,
      pendingReview: false,
    });
  }, []);

  return {
    ...state,
    categorize,
    quickCategorize,
    getStatus,
    applyPending,
    reset,
  };
}

// ============================================================================
// BATCH CATEGORIZATION HOOK
// ============================================================================

export interface UseBatchCategorizationReturn {
  isProcessing: boolean;
  progress: number;
  results: Array<{ id: string; success: boolean; type?: string }>;
  error: string | null;
  categorizeMany: (contractIds: string[]) => Promise<void>;
  reset: () => void;
}

export function useBatchCategorization(
  options: { tenantId?: string } = {}
): UseBatchCategorizationReturn {
  const { tenantId = 'demo' } = options;

  const [state, setState] = useState<{
    isProcessing: boolean;
    progress: number;
    results: Array<{ id: string; success: boolean; type?: string }>;
    error: string | null;
  }>({
    isProcessing: false,
    progress: 0,
    results: [],
    error: null,
  });

  const categorizeMany = useCallback(async (contractIds: string[]) => {
    setState({ isProcessing: true, progress: 0, results: [], error: null });

    const results: Array<{ id: string; success: boolean; type?: string }> = [];
    const total = contractIds.length;

    try {
      for (let i = 0; i < total; i++) {
        const contractId = contractIds[i];
        if (!contractId) continue;

        try {
          const response = await fetch(`/api/contracts/${contractId}/ai-categorize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': tenantId,
            },
            body: JSON.stringify({
              synchronous: true,
              quick: true,
              autoApply: true,
            }),
          });

          const data = await response.json();
          const payload = data.data ?? data;
          const contractType: string | undefined = payload.result?.contractType;

          results.push({
            id: contractId,
            success: response.ok,
            type: contractType,
          });
        } catch {
          results.push({ id: contractId, success: false });
        }

        // Update progress
        setState(prev => ({
          ...prev,
          progress: Math.round(((i + 1) / total) * 100),
          results: [...results],
        }));

        // Small delay to avoid overwhelming the API
        if (i < total - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setState(prev => ({ ...prev, isProcessing: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: err instanceof Error ? err.message : 'Batch categorization failed',
      }));
    }
  }, [tenantId]);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      progress: 0,
      results: [],
      error: null,
    });
  }, []);

  return {
    ...state,
    categorizeMany,
    reset,
  };
}
