/**
 * Bulk Operations Hook
 * 
 * Manages bulk operations on contracts with loading states,
 * progress tracking, and error handling.
 */

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export type BulkOperationType = 
  | 'export'
  | 'delete'
  | 'share'
  | 'categorize'
  | 'archive'
  | 'restore'
  | 'updateStatus'
  | 'generateArtifacts';

export interface BulkOperationResult {
  success: boolean;
  successCount: number;
  failedCount: number;
  errors?: { id: string; error: string }[];
  data?: any;
}

export interface UseBulkOperationsOptions {
  /** Tenant ID for API calls */
  tenantId?: string;
  /** Data mode for API calls */
  dataMode?: string;
  /** Callback when operation completes */
  onComplete?: (result: BulkOperationResult) => void;
  /** Callback when operation fails */
  onError?: (error: Error) => void;
  /** Whether to show toast notifications */
  showToasts?: boolean;
}

export interface UseBulkOperationsResult {
  // State
  isProcessing: boolean;
  currentOperation: BulkOperationType | null;
  progress: number;
  
  // Operations
  exportContracts: (contractIds: string[], format?: 'json' | 'csv' | 'pdf') => Promise<BulkOperationResult>;
  deleteContracts: (contractIds: string[]) => Promise<BulkOperationResult>;
  shareContracts: (contractIds: string[], shareWith: string[]) => Promise<BulkOperationResult>;
  categorizeContracts: (contractIds: string[], categoryId?: string) => Promise<BulkOperationResult>;
  autoCategorizeContracts: (contractIds: string[]) => Promise<BulkOperationResult>;
  archiveContracts: (contractIds: string[]) => Promise<BulkOperationResult>;
  restoreContracts: (contractIds: string[]) => Promise<BulkOperationResult>;
  updateContractStatus: (contractIds: string[], status: string) => Promise<BulkOperationResult>;
  generateArtifacts: (contractIds: string[]) => Promise<BulkOperationResult>;
  
  // Helpers
  cancelOperation: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useBulkOperations(
  options: UseBulkOperationsOptions = {}
): UseBulkOperationsResult {
  const {
    tenantId = 'demo',
    dataMode = 'live',
    onComplete,
    onError,
    showToasts = true,
  } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<BulkOperationType | null>(null);
  const [progress, setProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Generic API call helper
  const performBulkOperation = useCallback(async <T = any>(
    operationType: BulkOperationType,
    endpoint: string,
    payload: any,
    successMessage: string
  ): Promise<BulkOperationResult> => {
    const controller = new AbortController();
    setAbortController(controller);
    setIsProcessing(true);
    setCurrentOperation(operationType);
    setProgress(0);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
          'x-data-mode': dataMode,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Operation failed: ${response.status}`);
      }

      const data = await response.json();
      const result: BulkOperationResult = {
        success: true,
        successCount: data.data?.results?.filter((r: any) => r.success).length || payload.contractIds?.length || 0,
        failedCount: data.data?.results?.filter((r: any) => !r.success).length || 0,
        errors: data.data?.results?.filter((r: any) => !r.success).map((r: any) => ({
          id: r.id,
          error: r.error || 'Unknown error',
        })),
        data: data.data,
      };

      if (showToasts) {
        if (result.failedCount > 0) {
          toast.warning(`${successMessage}: ${result.successCount} succeeded, ${result.failedCount} failed`);
        } else {
          toast.success(successMessage);
        }
      }

      onComplete?.(result);
      setProgress(100);
      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (showToasts) {
          toast.info('Operation cancelled');
        }
        return { success: false, successCount: 0, failedCount: 0 };
      }

      if (showToasts) {
        toast.error(error.message || 'Operation failed');
      }
      onError?.(error);
      
      return {
        success: false,
        successCount: 0,
        failedCount: payload.contractIds?.length || 0,
        errors: [{ id: 'general', error: error.message }],
      };
    } finally {
      setIsProcessing(false);
      setCurrentOperation(null);
      setAbortController(null);
    }
  }, [tenantId, dataMode, showToasts, onComplete, onError]);

  // Export contracts
  const exportContracts = useCallback(async (
    contractIds: string[],
    format: 'json' | 'csv' | 'pdf' = 'csv'
  ): Promise<BulkOperationResult> => {
    return performBulkOperation(
      'export',
      '/api/contracts/bulk',
      { operation: 'export', contractIds, format },
      `Exported ${contractIds.length} contracts`
    );
  }, [performBulkOperation]);

  // Delete contracts
  const deleteContracts = useCallback(async (
    contractIds: string[]
  ): Promise<BulkOperationResult> => {
    return performBulkOperation(
      'delete',
      '/api/contracts/bulk',
      { operation: 'delete', contractIds },
      `Deleted ${contractIds.length} contracts`
    );
  }, [performBulkOperation]);

  // Share contracts
  const shareContracts = useCallback(async (
    contractIds: string[],
    shareWith: string[]
  ): Promise<BulkOperationResult> => {
    return performBulkOperation(
      'share',
      '/api/contracts/bulk',
      { operation: 'share', contractIds, shareWith },
      `Shared ${contractIds.length} contracts`
    );
  }, [performBulkOperation]);

  // Categorize contracts with specific category
  const categorizeContracts = useCallback(async (
    contractIds: string[],
    categoryId?: string
  ): Promise<BulkOperationResult> => {
    return performBulkOperation(
      'categorize',
      '/api/contracts/bulk',
      { operation: 'categorize', contractIds, categoryId },
      `Categorized ${contractIds.length} contracts`
    );
  }, [performBulkOperation]);

  // Auto-categorize contracts using AI
  const autoCategorizeContracts = useCallback(async (
    contractIds: string[]
  ): Promise<BulkOperationResult> => {
    if (showToasts) {
      toast.info('Auto-categorizing contracts with AI...');
    }
    
    return performBulkOperation(
      'categorize',
      '/api/contracts/bulk-categorize',
      { contractIds },
      `Auto-categorized ${contractIds.length} contracts`
    );
  }, [performBulkOperation, showToasts]);

  // Archive contracts
  const archiveContracts = useCallback(async (
    contractIds: string[]
  ): Promise<BulkOperationResult> => {
    return performBulkOperation(
      'archive',
      '/api/contracts/bulk',
      { operation: 'archive', contractIds },
      `Archived ${contractIds.length} contracts`
    );
  }, [performBulkOperation]);

  // Restore contracts
  const restoreContracts = useCallback(async (
    contractIds: string[]
  ): Promise<BulkOperationResult> => {
    return performBulkOperation(
      'restore',
      '/api/contracts/bulk',
      { operation: 'restore', contractIds },
      `Restored ${contractIds.length} contracts`
    );
  }, [performBulkOperation]);

  // Update contract status
  const updateContractStatus = useCallback(async (
    contractIds: string[],
    status: string
  ): Promise<BulkOperationResult> => {
    return performBulkOperation(
      'updateStatus',
      '/api/contracts/bulk',
      { operation: 'updateStatus', contractIds, status },
      `Updated status for ${contractIds.length} contracts`
    );
  }, [performBulkOperation]);

  // Generate AI artifacts
  const generateArtifacts = useCallback(async (
    contractIds: string[]
  ): Promise<BulkOperationResult> => {
    if (showToasts) {
      toast.info('Generating AI artifacts...');
    }
    
    return performBulkOperation(
      'generateArtifacts',
      '/api/contracts/bulk',
      { operation: 'analyze', contractIds },
      `Generated artifacts for ${contractIds.length} contracts`
    );
  }, [performBulkOperation, showToasts]);

  // Cancel current operation
  const cancelOperation = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
  }, [abortController]);

  return {
    isProcessing,
    currentOperation,
    progress,
    exportContracts,
    deleteContracts,
    shareContracts,
    categorizeContracts,
    autoCategorizeContracts,
    archiveContracts,
    restoreContracts,
    updateContractStatus,
    generateArtifacts,
    cancelOperation,
  };
}

export default useBulkOperations;
