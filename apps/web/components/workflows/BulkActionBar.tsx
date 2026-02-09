'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  UserPlus,
  X,
  Loader2,
  AlertTriangle,
  CheckCheck,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Framer Motion typing workaround
const MotionDiv = motion.div as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    transition?: object;
    className?: string;
  }
>;

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onApprove: () => void;
  onReject: () => void;
  onDelegate?: () => void;
  onEscalate?: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
  processingAction?: string;
  processedCount?: number;
  className?: string;
}

/**
 * Floating Bulk Action Bar
 * Appears at the bottom of the screen when items are selected
 * Provides quick access to bulk actions with progress feedback
 */
export function BulkActionBar({
  selectedCount,
  totalCount,
  onApprove,
  onReject,
  onDelegate,
  onEscalate,
  onSelectAll,
  onClearSelection,
  isProcessing = false,
  processingAction,
  processedCount = 0,
  className,
}: BulkActionBarProps) {
  const progress = isProcessing && selectedCount > 0 
    ? Math.round((processedCount / selectedCount) * 100) 
    : 0;

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <MotionDiv
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
            'bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-slate-900/10',
            'rounded-2xl overflow-hidden',
            className
          )}
          role="toolbar"
          aria-label={`Bulk actions for ${selectedCount} selected items`}
        >
          {/* Progress bar for processing */}
          {isProcessing && (
            <div className="h-1 bg-slate-100">
              <MotionDiv
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          <div className="px-4 py-3 flex items-center gap-4">
            {/* Selection info */}
            <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-violet-200/50">
                {selectedCount}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
                </div>
                <div className="text-xs text-slate-500">
                  {selectedCount < totalCount ? (
                    <button
                      onClick={onSelectAll}
                      className="text-violet-600 hover:text-indigo-800 font-medium"
                      disabled={isProcessing}
                    >
                      Select all {totalCount}
                    </button>
                  ) : (
                    <span className="text-green-600">All items selected</span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            {isProcessing ? (
              <div 
                className="flex items-center gap-3 text-sm text-slate-600"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="w-5 h-5 animate-spin text-violet-600" aria-hidden="true" />
                <span>
                  {processingAction || 'Processing'} ({processedCount}/{selectedCount})...
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2" role="group" aria-label="Bulk actions">
                {/* Approve All */}
                <button
                  onClick={onApprove}
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-xl hover:shadow-lg hover:shadow-green-200/50 transition-all font-semibold text-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  aria-label={`Approve all ${selectedCount} selected items`}
                >
                  <CheckCheck className="w-4 h-4" aria-hidden="true" />
                  Approve All
                </button>

                {/* Reject All */}
                <button
                  onClick={onReject}
                  className="px-4 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl hover:shadow-lg hover:shadow-red-200/50 transition-all font-semibold text-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-label={`Reject all ${selectedCount} selected items`}
                >
                  <Ban className="w-4 h-4" aria-hidden="true" />
                  Reject All
                </button>

                {/* Delegate */}
                {onDelegate && (
                  <button
                    onClick={onDelegate}
                    className="px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium text-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    aria-label={`Delegate ${selectedCount} selected items`}
                  >
                    <UserPlus className="w-4 h-4" aria-hidden="true" />
                    Delegate
                  </button>
                )}

                {/* Escalate */}
                {onEscalate && (
                  <button
                    onClick={onEscalate}
                    className="px-3 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium text-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                    aria-label={`Escalate ${selectedCount} selected items`}
                  >
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    Escalate
                  </button>
                )}
              </div>
            )}

            {/* Clear selection */}
            <button
              onClick={onClearSelection}
              disabled={isProcessing}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-2 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              aria-label="Clear selection"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Keyboard shortcut hints */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">A</kbd>
              Approve
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">R</kbd>
              Reject
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono">Esc</kbd>
              Clear
            </span>
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}

/**
 * Confirmation dialog for bulk actions
 */
interface BulkActionConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  action: 'approve' | 'reject' | 'delegate' | 'escalate';
  count: number;
  isProcessing?: boolean;
}

export function BulkActionConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  action,
  count,
  isProcessing = false,
}: BulkActionConfirmDialogProps) {
  const actionConfig = {
    approve: {
      title: 'Approve All Selected',
      description: `You are about to approve ${count} pending approval${count > 1 ? 's' : ''}. This action cannot be undone.`,
      icon: CheckCircle2,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      buttonColor: 'bg-gradient-to-r from-violet-500 to-violet-600',
      buttonText: 'Approve All',
    },
    reject: {
      title: 'Reject All Selected',
      description: `You are about to reject ${count} pending approval${count > 1 ? 's' : ''}. This action cannot be undone.`,
      icon: XCircle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-100',
      buttonColor: 'bg-gradient-to-r from-red-500 to-rose-600',
      buttonText: 'Reject All',
    },
    delegate: {
      title: 'Delegate Selected',
      description: `You are about to delegate ${count} approval${count > 1 ? 's' : ''} to another team member.`,
      icon: UserPlus,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-100',
      buttonColor: 'bg-gradient-to-r from-violet-500 to-purple-600',
      buttonText: 'Delegate',
    },
    escalate: {
      title: 'Escalate Selected',
      description: `You are about to escalate ${count} approval${count > 1 ? 's' : ''} to a higher authority.`,
      icon: ArrowRight,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
      buttonColor: 'bg-gradient-to-r from-amber-500 to-orange-600',
      buttonText: 'Escalate',
    },
  };

  const config = actionConfig[action];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Dialog */}
          <MotionDiv
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4',
                config.iconBg
              )}>
                <Icon className={cn('w-8 h-8', config.iconColor)} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {config.title}
              </h3>
              <p className="text-slate-500 mb-1">
                {config.description}
              </p>
              <div className="flex items-center justify-center gap-1 text-sm text-amber-600 bg-amber-50 rounded-lg py-2 px-3 mt-4">
                <AlertTriangle className="w-4 h-4" />
                <span>Please confirm to proceed</span>
              </div>
            </div>

            <div className="px-6 pb-6 flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isProcessing}
                className={cn(
                  'flex-1 px-4 py-3 text-white rounded-xl transition-all font-semibold flex items-center justify-center gap-2',
                  config.buttonColor,
                  isProcessing && 'opacity-70 cursor-not-allowed'
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Icon className="w-4 h-4" />
                    {config.buttonText}
                  </>
                )}
              </button>
            </div>
          </MotionDiv>
        </>
      )}
    </AnimatePresence>
  );
}

export default BulkActionBar;
