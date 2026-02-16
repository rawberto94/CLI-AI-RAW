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
    setProgress(0);

    try {
      const response = await fetch('/api/contracts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: operation.id,
          contractIds: selectedIds,
        }),
      });

      // Simulate progress for now
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(r => setTimeout(r, 200));
        setProgress(i);
      }

      if (!response.ok) {
        throw new Error('Operation failed');
      }

      const result = await response.json();
      
      toast.success(`${operation.label} completed`, {
        description: `${result.success || selectedIds.length} contracts processed`,
      });

      onOperationComplete?.(operation.id, result);
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
