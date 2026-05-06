/**
 * Batch Operations Panel
 * Perform bulk operations on multiple contracts
 */

'use client';

import { memo, useState } from 'react';
import { 
  CheckSquare, 
  Download, 
  Trash2, 
  Tag, 
  FolderSync,
  Brain,
  RefreshCw,
  Archive,
  Send,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getTenantId } from '@/lib/tenant';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface BatchOperation {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  variant?: 'default' | 'destructive';
  requiresConfirmation?: boolean;
}

const batchOperations: BatchOperation[] = [
  {
    id: 'export',
    label: 'Export',
    icon: Download,
    description: 'Export selected contracts as CSV or PDF',
  },
  {
    id: 'reprocess',
    label: 'Reprocess',
    icon: RefreshCw,
    description: 'Re-run OCR and artifact generation',
  },
  {
    id: 'categorize',
    label: 'Categorize',
    icon: Tag,
    description: 'Run auto-categorization',
  },
  {
    id: 'analyze',
    label: 'AI Analysis',
    icon: Brain,
    description: 'Generate AI insights',
  },
  {
    id: 'archive',
    label: 'Archive',
    icon: Archive,
    description: 'Move to archive',
    requiresConfirmation: true,
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    description: 'Permanently delete',
    variant: 'destructive',
    requiresConfirmation: true,
  },
];

interface BatchOperationsPanelProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onOperationComplete?: (operation: string, results: BatchResult) => void;
  className?: string;
}

interface BatchResult {
  success: number;
  failed: number;
  errors?: string[];
}

type OperationPayload = Record<string, unknown>;

interface OperationExecutionResult {
  batchResult: BatchResult;
  downloadUrl?: string;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      return data as Record<string, unknown>;
    }
    return payload as Record<string, unknown>;
  }

  return {};
}

function extractErrorMessage(payload: Record<string, unknown>, fallback: string): string {
  const error = payload.error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  if (typeof payload.message === 'string') {
    return payload.message;
  }

  if (typeof payload.details === 'string') {
    return payload.details;
  }

  return fallback;
}

function createBatchResult(success: number, failed = 0, errors: string[] = []): BatchResult {
  return {
    success,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

function normalizeBulkResult(operation: string, payload: Record<string, unknown>, selectedCount: number): OperationExecutionResult {
  switch (operation) {
    case 'delete': {
      const success = typeof payload.deleted === 'number' ? payload.deleted : selectedCount;
      const failed = typeof payload.failed === 'number' ? payload.failed : Math.max(selectedCount - success, 0);
      return { batchResult: createBatchResult(success, failed) };
    }
    case 'archive': {
      const success = typeof payload.archived === 'number' ? payload.archived : selectedCount;
      const failed = Math.max(selectedCount - success, 0);
      return { batchResult: createBatchResult(success, failed) };
    }
    case 'export': {
      const contracts = Array.isArray(payload.contracts) ? payload.contracts : [];
      const success = contracts.length > 0 ? contracts.length : selectedCount;
      return {
        batchResult: createBatchResult(success, Math.max(selectedCount - success, 0)),
        downloadUrl: typeof payload.downloadUrl === 'string' ? payload.downloadUrl : undefined,
      };
    }
    case 'analyze': {
      const results = Array.isArray(payload.results) ? payload.results : [];
      const success = results.filter((result) => {
        if (!result || typeof result !== 'object') {
          return false;
        }

        return (result as { status?: string }).status === 'queued';
      }).length;
      const failed = results.length > 0 ? results.length - success : Math.max(selectedCount - success, 0);
      const errors = results
        .filter((result): result is { error?: string } => !!result && typeof result === 'object')
        .map((result) => result.error)
        .filter((error): error is string => typeof error === 'string' && error.length > 0);

      return { batchResult: createBatchResult(success || selectedCount, failed, errors) };
    }
    default:
      return { batchResult: createBatchResult(selectedCount) };
  }
}

function normalizeCategorizeResult(payload: Record<string, unknown>, selectedCount: number): OperationExecutionResult {
  const results = Array.isArray(payload.results) ? payload.results : [];
  const successCount = typeof payload.successCount === 'number'
    ? payload.successCount
    : results.filter((result) => !result || typeof result !== 'object' || (result as { success?: boolean }).success !== false).length;
  const failedCount = typeof payload.failureCount === 'number'
    ? payload.failureCount
    : results.length > 0
      ? results.length - successCount
      : Math.max(selectedCount - successCount, 0);
  const errors = results
    .filter((result): result is { error?: string; errors?: string[] } => !!result && typeof result === 'object')
    .flatMap((result) => {
      if (typeof result.error === 'string' && result.error.length > 0) {
        return [result.error];
      }

      return Array.isArray(result.errors) ? result.errors.filter((error): error is string => typeof error === 'string') : [];
    });

  return { batchResult: createBatchResult(successCount || selectedCount, failedCount, errors) };
}

function normalizeReprocessResult(results: PromiseSettledResult<void>[]): OperationExecutionResult {
  const success = results.filter((result) => result.status === 'fulfilled').length;
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason)
    .map((reason) => (reason instanceof Error ? reason.message : String(reason)));

  return {
    batchResult: createBatchResult(success, results.length - success, errors),
  };
}

function triggerDownload(downloadUrl: string) {
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.rel = 'noopener noreferrer';
  link.click();
}

export const BatchOperationsPanel = memo(function BatchOperationsPanel({
  selectedIds,
  onClearSelection,
  onOperationComplete,
  className,
}: BatchOperationsPanelProps) {
  const [processing, setProcessing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<BatchOperation | null>(null);

  const tenantId = getTenantId();

  const executeMappedOperation = async (operationId: string): Promise<OperationExecutionResult> => {
    const baseHeaders = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
    };

    if (operationId === 'categorize') {
      const response = await fetch('/api/contracts/categorize', {
        method: 'POST',
        headers: baseHeaders,
        body: JSON.stringify({
          contractIds: selectedIds,
          forceRecategorize: true,
        } satisfies OperationPayload),
      });

      const payload = await readJson(response);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Categorization failed'));
      }

      return normalizeCategorizeResult(payload, selectedIds.length);
    }

    if (operationId === 'reprocess') {
      const results = await Promise.allSettled(
        selectedIds.map(async (contractId) => {
          const response = await fetch(`/api/contracts/${contractId}/process`, {
            method: 'POST',
            headers: {
              'x-tenant-id': tenantId,
            },
          });

          if (!response.ok) {
            const payload = await readJson(response);
            throw new Error(extractErrorMessage(payload, `Reprocess failed for ${contractId}`));
          }
        }),
      );

      return normalizeReprocessResult(results);
    }

    const response = await fetch('/api/contracts/bulk', {
      method: 'POST',
      headers: baseHeaders,
      body: JSON.stringify({
        operation: operationId,
        contractIds: selectedIds,
      } satisfies OperationPayload),
    });

    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(extractErrorMessage(payload, `${operationId} failed`));
    }

    return normalizeBulkResult(operationId, payload, selectedIds.length);
  };

  const handleOperation = async (operation: BatchOperation) => {
    if (operation.requiresConfirmation) {
      setConfirmDialog(operation);
      return;
    }
    
    await executeOperation(operation);
  };

  const executeOperation = async (operation: BatchOperation) => {
    setConfirmDialog(null);
    setProcessing(true);
    setCurrentOperation(operation.id);
    setProgress(15);

    try {
      const { batchResult, downloadUrl } = await executeMappedOperation(operation.id);
      setProgress(100);

      if (downloadUrl) {
        triggerDownload(downloadUrl);
      }
      
      toast.success(`${operation.label} completed`, {
        description: batchResult.failed > 0
          ? `${batchResult.success} succeeded, ${batchResult.failed} failed`
          : `${batchResult.success} contracts processed`,
      });

      onOperationComplete?.(operation.id, batchResult);
      onClearSelection();
    } catch (error) {
      toast.error(`${operation.label} failed`, {
        description: (error as Error).message,
      });
    } finally {
      setProcessing(false);
      setCurrentOperation(null);
      setProgress(0);
    }
  };

  if (selectedIds.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'bg-white rounded-2xl shadow-2xl border border-slate-200',
          'px-4 py-3 flex items-center gap-4',
          'animate-in slide-in-from-bottom-4 duration-300',
          className
        )}
      >
        {/* Selection Count */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <CheckSquare className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-sm">{selectedIds.length} selected</p>
            <p className="text-xs text-slate-500">contracts</p>
          </div>
        </div>

        <div className="w-px h-10 bg-slate-200" />

        {/* Processing State */}
        {processing ? (
          <div className="flex items-center gap-3 min-w-[200px]">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
            <div className="flex-1">
              <p className="text-sm font-medium capitalize">{currentOperation}...</p>
              <Progress value={progress} className="h-1.5 mt-1" />
            </div>
          </div>
        ) : (
          <>
            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              {batchOperations.slice(0, 4).map((op) => {
                const Icon = op.icon;
                return (
                  <Button
                    key={op.id}
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleOperation(op)}
                  >
                    <Icon className="h-4 w-4" />
                    {op.label}
                  </Button>
                );
              })}
            </div>

            {/* More Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {batchOperations.slice(4).map((op) => {
                  const Icon = op.icon;
                  return (
                    <DropdownMenuItem
                      key={op.id}
                      onClick={() => handleOperation(op)}
                      className={cn(
                        'gap-2',
                        op.variant === 'destructive' && 'text-red-600'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {op.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        <div className="w-px h-10 bg-slate-200" />

        {/* Clear Selection */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmDialog?.variant === 'destructive' && (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              Confirm {confirmDialog?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmDialog?.label.toLowerCase()}{' '}
              <strong>{selectedIds.length}</strong> contracts?
              {confirmDialog?.variant === 'destructive' && (
                <span className="block mt-2 text-red-600">
                  This action cannot be undone.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog && executeOperation(confirmDialog)}
              className={cn(
                confirmDialog?.variant === 'destructive' &&
                  'bg-red-600 hover:bg-red-700'
              )}
            >
              {confirmDialog?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
