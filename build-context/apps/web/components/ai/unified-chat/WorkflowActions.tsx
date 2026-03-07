'use client';

/**
 * Workflow Actions Component
 * 
 * Interactive workflow actions in chat messages.
 * Supports confirm/reject, start workflow, and navigation actions.
 * 
 * Consolidated from AIChatbot workflow integration.
 */

import React, { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Check,
  X,
  RefreshCw,
  FileEdit,
  Send,
  AlertCircle,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Action types
export type WorkflowActionType = 
  | 'start-renewal'
  | 'start-amendment'
  | 'draft-contract'
  | 'send-notification'
  | 'confirm'
  | 'reject'
  | 'navigate';

export interface WorkflowAction {
  id: string;
  type: WorkflowActionType;
  label: string;
  description?: string;
  contractId?: string;
  data?: Record<string, unknown>;
  variant?: 'primary' | 'secondary' | 'danger';
  requiresConfirmation?: boolean;
}

export interface WorkflowActionsProps {
  actions: WorkflowAction[];
  onAction: (action: WorkflowAction) => Promise<void>;
  disabled?: boolean;
  className?: string;
}

// Get icon for action type
function ActionIcon({ type }: { type: WorkflowActionType }) {
  switch (type) {
    case 'start-renewal':
      return <RefreshCw className="h-4 w-4" />;
    case 'start-amendment':
      return <FileEdit className="h-4 w-4" />;
    case 'draft-contract':
      return <FileEdit className="h-4 w-4" />;
    case 'send-notification':
      return <Send className="h-4 w-4" />;
    case 'confirm':
      return <Check className="h-4 w-4" />;
    case 'reject':
      return <X className="h-4 w-4" />;
    case 'navigate':
      return <ArrowRight className="h-4 w-4" />;
    default:
      return <Play className="h-4 w-4" />;
  }
}

// Single action button
interface ActionButtonProps {
  action: WorkflowAction;
  onAction: (action: WorkflowAction) => Promise<void>;
  disabled?: boolean;
}

const ActionButton = memo(function ActionButton({
  action,
  onAction,
  disabled,
}: ActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleClick = useCallback(async () => {
    if (action.requiresConfirmation && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await onAction(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
    }
  }, [action, onAction, showConfirm]);
  
  const handleCancel = useCallback(() => {
    setShowConfirm(false);
    setError(null);
  }, []);
  
  // Get button styles based on variant and type
  const getButtonStyles = () => {
    if (action.type === 'confirm' || action.variant === 'primary') {
      return 'bg-emerald-600 hover:bg-emerald-700 text-white';
    }
    if (action.type === 'reject' || action.variant === 'danger') {
      return 'bg-red-600 hover:bg-red-700 text-white';
    }
    return 'bg-slate-600 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-600';
  };
  
  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {showConfirm ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-2"
          >
            <span className="text-sm text-amber-600 dark:text-amber-400 mr-1">
              Are you sure?
            </span>
            <button
              onClick={handleClick}
              disabled={isLoading}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium',
                'bg-emerald-600 hover:bg-emerald-700 text-white',
                'transition-colors disabled:opacity-50'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Yes'
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium',
                'bg-slate-200 hover:bg-slate-300 text-slate-700',
                'dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200',
                'transition-colors disabled:opacity-50'
              )}
            >
              No
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="action"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={handleClick}
            disabled={disabled || isLoading}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-md',
              'text-sm font-medium transition-all',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              getButtonStyles()
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ActionIcon type={action.type} />
            )}
            <span>{action.label}</span>
          </motion.button>
        )}
      </AnimatePresence>
      
      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 mt-1 flex items-center gap-1 text-xs text-red-600 dark:text-red-400"
        >
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </motion.div>
      )}
    </div>
  );
});

// Workflow actions group
export const WorkflowActions = memo(function WorkflowActions({
  actions,
  onAction,
  disabled,
  className,
}: WorkflowActionsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  if (actions.length === 0) return null;
  
  // Group primary and secondary actions
  const primaryActions = actions.filter(a => 
    a.type === 'confirm' || a.type === 'reject' || a.variant === 'primary'
  );
  const secondaryActions = actions.filter(a => 
    a.type !== 'confirm' && a.type !== 'reject' && a.variant !== 'primary'
  );
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border border-slate-200 dark:border-slate-700',
        'bg-slate-50 dark:bg-slate-800/50 p-3',
        className
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left mb-2"
      >
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Available Actions
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3">
              {/* Primary actions (confirm/reject) */}
              {primaryActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {primaryActions.map((action) => (
                    <ActionButton
                      key={action.id}
                      action={action}
                      onAction={onAction}
                      disabled={disabled}
                    />
                  ))}
                </div>
              )}
              
              {/* Secondary actions (workflows) */}
              {secondaryActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {secondaryActions.map((action) => (
                    <ActionButton
                      key={action.id}
                      action={action}
                      onAction={onAction}
                      disabled={disabled}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// Inline action for simple confirm/reject
export interface InlineActionProps {
  onConfirm: () => Promise<void>;
  onReject: () => Promise<void>;
  confirmLabel?: string;
  rejectLabel?: string;
  disabled?: boolean;
  className?: string;
}

export const InlineConfirmReject = memo(function InlineConfirmReject({
  onConfirm,
  onReject,
  confirmLabel = 'Confirm',
  rejectLabel = 'Reject',
  disabled,
  className,
}: InlineActionProps) {
  const [isLoading, setIsLoading] = useState<'confirm' | 'reject' | null>(null);
  
  const handleConfirm = useCallback(async () => {
    setIsLoading('confirm');
    try {
      await onConfirm();
    } finally {
      setIsLoading(null);
    }
  }, [onConfirm]);
  
  const handleReject = useCallback(async () => {
    setIsLoading('reject');
    try {
      await onReject();
    } finally {
      setIsLoading(null);
    }
  }, [onReject]);
  
  return (
    <div className={cn('inline-flex gap-2', className)}>
      <button
        onClick={handleConfirm}
        disabled={disabled || isLoading !== null}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md',
          'text-sm font-medium transition-colors',
          'bg-emerald-600 hover:bg-emerald-700 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isLoading === 'confirm' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        <span>{confirmLabel}</span>
      </button>
      
      <button
        onClick={handleReject}
        disabled={disabled || isLoading !== null}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md',
          'text-sm font-medium transition-colors',
          'bg-red-600 hover:bg-red-700 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isLoading === 'reject' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <X className="h-3.5 w-3.5" />
        )}
        <span>{rejectLabel}</span>
      </button>
    </div>
  );
});

export default WorkflowActions;
