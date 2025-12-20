'use client';

/**
 * Async Operation Progress Component
 * Visual feedback for long-running operations
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type OperationStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

export interface OperationStep {
  id: string;
  label: string;
  status: OperationStatus;
  progress?: number;
  message?: string;
  duration?: number; // in ms
}

export interface AsyncOperationProgressProps {
  title: string;
  description?: string;
  status: OperationStatus;
  progress?: number;
  steps?: OperationStep[];
  currentStep?: string;
  estimatedTimeRemaining?: number; // in seconds
  onCancel?: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

// ============================================================================
// Status Configuration
// ============================================================================

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
    label: 'Waiting...'
  },
  running: {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'Processing...',
    animate: true
  },
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'Complete'
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    label: 'Failed'
  },
  cancelled: {
    icon: XCircle,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Cancelled'
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `~${seconds}s remaining`;
  const minutes = Math.ceil(seconds / 60);
  return `~${minutes}m remaining`;
}

// ============================================================================
// Operation Step Item
// ============================================================================

interface StepItemProps {
  step: OperationStep;
  isActive: boolean;
}

function StepItem({ step, isActive }: StepItemProps) {
  const config = statusConfig[step.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
        isActive && "bg-slate-50 dark:bg-slate-800/50"
      )}
    >
      <div className={cn("flex-shrink-0", config.color)}>
        <Icon className={cn(
          "h-4 w-4",
          config.animate && "animate-spin"
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          step.status === 'pending' ? "text-slate-400" : "text-slate-700 dark:text-slate-300"
        )}>
          {step.label}
        </p>
        {step.message && (
          <p className="text-xs text-slate-500 truncate">{step.message}</p>
        )}
      </div>
      {step.duration && step.status === 'success' && (
        <span className="text-xs text-slate-400">{formatDuration(step.duration)}</span>
      )}
      {step.progress !== undefined && step.status === 'running' && (
        <span className="text-xs text-blue-500 font-medium">{step.progress}%</span>
      )}
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AsyncOperationProgress({
  title,
  description,
  status,
  progress,
  steps = [],
  currentStep,
  estimatedTimeRemaining,
  onCancel,
  onRetry,
  onDismiss,
  showDetails: initialShowDetails = true,
  className
}: AsyncOperationProgressProps) {
  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  // Update elapsed time
  useEffect(() => {
    if (status !== 'running') return;
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [status, startTime]);

  const config = statusConfig[status];
  const Icon = config.icon;
  const hasSteps = steps.length > 0;
  const completedSteps = steps.filter(s => s.status === 'success').length;
  const isComplete = status === 'success' || status === 'error' || status === 'cancelled';

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-colors",
      config.bg,
      config.border,
      className
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={cn(
            "p-2 rounded-lg bg-white dark:bg-slate-900",
            config.color
          )}>
            <Icon className={cn(
              "h-5 w-5",
              config.animate && "animate-spin"
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                {title}
              </h4>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                status === 'running' && "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
                status === 'success' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
                status === 'error' && "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
                status === 'pending' && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                status === 'cancelled' && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
              )}>
                {config.label}
              </span>
            </div>

            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                {description}
              </p>
            )}

            {/* Progress Bar */}
            {status === 'running' && (
              <div className="space-y-2">
                <Progress 
                  value={progress ?? (hasSteps ? (completedSteps / steps.length) * 100 : undefined)} 
                  className="h-2"
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {hasSteps 
                      ? `Step ${completedSteps + 1} of ${steps.length}`
                      : progress !== undefined 
                        ? `${progress}% complete`
                        : 'Processing...'
                    }
                  </span>
                  <span className="flex items-center gap-2">
                    {estimatedTimeRemaining && (
                      <span>{formatTimeRemaining(estimatedTimeRemaining)}</span>
                    )}
                    <span className="text-slate-400">
                      Elapsed: {formatDuration(elapsedTime)}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Final Duration */}
            {isComplete && elapsedTime > 0 && (
              <p className="text-xs text-slate-500">
                Completed in {formatDuration(elapsedTime)}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {status === 'running' && onCancel && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onCancel}
                className="h-8 text-slate-500 hover:text-red-500"
              >
                Cancel
              </Button>
            )}
            {status === 'error' && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="h-8 gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            )}
            {isComplete && onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-8"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Steps Detail */}
      {hasSteps && (
        <>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-colors"
          >
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {showDetails ? 'Hide details' : 'Show details'}
            </span>
            {showDetails ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-2 space-y-1 bg-white/30 dark:bg-slate-900/30">
                  {steps.map((step) => (
                    <StepItem 
                      key={step.id} 
                      step={step} 
                      isActive={step.id === currentStep}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Compact Progress Indicator
// ============================================================================

interface CompactProgressProps {
  status: OperationStatus;
  progress?: number;
  label?: string;
  className?: string;
}

export function CompactProgress({ status, progress, label, className }: CompactProgressProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Icon className={cn(
        "h-4 w-4",
        config.color,
        config.animate && "animate-spin"
      )} />
      {label && <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>}
      {progress !== undefined && status === 'running' && (
        <span className="text-xs font-medium text-blue-500">{progress}%</span>
      )}
    </div>
  );
}

// ============================================================================
// Toast-style Progress Notification
// ============================================================================

interface ProgressToastProps {
  title: string;
  status: OperationStatus;
  progress?: number;
  message?: string;
  onDismiss?: () => void;
  className?: string;
}

export function ProgressToast({
  title,
  status,
  progress,
  message,
  onDismiss,
  className
}: ProgressToastProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 rounded-xl shadow-2xl border overflow-hidden",
        "bg-white dark:bg-slate-900",
        config.border,
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={config.color}>
            <Icon className={cn(
              "h-5 w-5",
              config.animate && "animate-spin"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-slate-900 dark:text-white text-sm">
              {title}
            </h4>
            {message && (
              <p className="text-xs text-slate-500 mt-0.5">{message}</p>
            )}
          </div>
          {(status === 'success' || status === 'error') && onDismiss && (
            <button
              onClick={onDismiss}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
        {status === 'running' && (
          <div className="mt-3">
            <Progress value={progress} className="h-1.5" />
            {progress !== undefined && (
              <p className="text-xs text-slate-400 mt-1 text-right">{progress}%</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default AsyncOperationProgress;
