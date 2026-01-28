'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Trash2,
  Share2,
  Brain,
  FolderOpen,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BulkOperationStatus = 'idle' | 'running' | 'completed' | 'failed' | 'partial';

interface BulkOperationResult {
  contractId: string;
  contractTitle: string;
  success: boolean;
  error?: string;
}

interface EnhancedBulkProgressProps {
  isOpen: boolean;
  operation: string;
  operationIcon: React.ElementType;
  totalCount: number;
  currentProgress: number;
  results: BulkOperationResult[];
  status: BulkOperationStatus;
  onClose: () => void;
  onRetryFailed?: () => void;
  onCancel?: () => void;
}

const statusConfig = {
  idle: { color: 'bg-slate-100', text: 'Preparing...', icon: Loader2 },
  running: { color: 'bg-violet-100', text: 'Processing...', icon: Loader2 },
  completed: { color: 'bg-violet-100', text: 'Completed', icon: CheckCircle },
  failed: { color: 'bg-red-100', text: 'Failed', icon: XCircle },
  partial: { color: 'bg-amber-100', text: 'Partial Success', icon: AlertTriangle },
};

export const EnhancedBulkProgress = memo(function EnhancedBulkProgress({
  isOpen,
  operation,
  operationIcon: OperationIcon,
  totalCount,
  currentProgress,
  results,
  status,
  onClose,
  onRetryFailed,
  onCancel,
}: EnhancedBulkProgressProps) {
  const [showDetails, setShowDetails] = useState(false);

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const progressPercent = totalCount > 0 ? Math.round((currentProgress / totalCount) * 100) : 0;

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  useEffect(() => {
    // Auto-expand details if there are failures
    if (status === 'partial' || status === 'failed') {
      setShowDetails(true);
    }
  }, [status]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 w-96"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className={cn('px-4 py-3 border-b border-slate-100 dark:border-slate-700', config.color)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/80 dark:bg-slate-800/80 rounded-lg">
                    <OperationIcon className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {operation}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {totalCount} contract{totalCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon
                    className={cn(
                      'h-5 w-5',
                      status === 'running' || status === 'idle' ? 'animate-spin text-violet-600' : '',
                      status === 'completed' && 'text-violet-600',
                      status === 'failed' && 'text-red-600',
                      status === 'partial' && 'text-amber-600'
                    )}
                  />
                  {(status === 'completed' || status === 'failed' || status === 'partial') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={onClose}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {config.text}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    status === 'completed' && 'bg-violet-500',
                    status === 'running' && 'bg-violet-500',
                    status === 'failed' && 'bg-red-500',
                    status === 'partial' && 'bg-gradient-to-r from-violet-500 to-amber-500',
                    status === 'idle' && 'bg-slate-400'
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Stats */}
              {results.length > 0 && (
                <div className="flex items-center gap-4 mt-3 text-xs">
                  {successCount > 0 && (
                    <div className="flex items-center gap-1 text-violet-600">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>{successCount} succeeded</span>
                    </div>
                  )}
                  {failedCount > 0 && (
                    <div className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-3.5 w-3.5" />
                      <span>{failedCount} failed</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Details Toggle */}
            {results.length > 0 && (
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full px-4 py-2 flex items-center justify-between text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-700"
              >
                <span>{showDetails ? 'Hide details' : 'Show details'}</span>
                {showDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Details List */}
            <AnimatePresence>
              {showDetails && results.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-100 dark:border-slate-700 overflow-hidden"
                >
                  <div className="max-h-48 overflow-y-auto">
                    {results.map((result, idx) => (
                      <motion.div
                        key={result.contractId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className={cn(
                          'px-4 py-2 flex items-center justify-between border-b border-slate-50 dark:border-slate-800 last:border-0',
                          result.success ? 'bg-violet-50/50 dark:bg-violet-950/20' : 'bg-red-50/50 dark:bg-red-950/20'
                        )}
                      >
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1 pr-2">
                          {result.contractTitle}
                        </span>
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-violet-500 flex-shrink-0" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            {result.error && (
                              <span className="text-[10px] text-red-500 max-w-[100px] truncate">
                                {result.error}
                              </span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            {(status === 'completed' || status === 'partial' || status === 'failed') && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                {failedCount > 0 && onRetryFailed && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={onRetryFailed}
                  >
                    Retry Failed ({failedCount})
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>
            )}

            {/* Cancel during operation */}
            {status === 'running' && onCancel && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                  onClick={onCancel}
                >
                  Cancel Operation
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// Hook for managing bulk operation progress
export function useBulkOperationProgress() {
  const [isOpen, setIsOpen] = useState(false);
  const [operation, setOperation] = useState('');
  const [operationIcon, setOperationIcon] = useState<React.ElementType>(FolderOpen);
  const [totalCount, setTotalCount] = useState(0);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [results, setResults] = useState<BulkOperationResult[]>([]);
  const [status, setStatus] = useState<BulkOperationStatus>('idle');

  const startOperation = useCallback(
    (
      name: string,
      icon: React.ElementType,
      total: number
    ) => {
      setOperation(name);
      setOperationIcon(icon);
      setTotalCount(total);
      setCurrentProgress(0);
      setResults([]);
      setStatus('running');
      setIsOpen(true);
    },
    []
  );

  const updateProgress = useCallback((result: BulkOperationResult) => {
    setResults((prev) => [...prev, result]);
    setCurrentProgress((prev) => prev + 1);
  }, []);

  const completeOperation = useCallback(() => {
    setStatus((prev) => {
      const failed = results.filter((r) => !r.success).length;
      const succeeded = results.filter((r) => r.success).length;
      
      if (failed === results.length) return 'failed';
      if (failed > 0) return 'partial';
      return 'completed';
    });
  }, [results]);

  const close = useCallback(() => {
    setIsOpen(false);
    setStatus('idle');
    setResults([]);
    setCurrentProgress(0);
  }, []);

  return {
    isOpen,
    operation,
    operationIcon,
    totalCount,
    currentProgress,
    results,
    status,
    startOperation,
    updateProgress,
    completeOperation,
    close,
  };
}

export default EnhancedBulkProgress;
