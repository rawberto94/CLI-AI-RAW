/**
 * Enhanced Toast Utilities
 * 
 * Production-ready toast notifications with:
 * - Undo support for destructive actions
 * - Progress indicators for long operations
 * - Grouped notifications to prevent spam
 */

import { toast, type ExternalToast } from 'sonner';
import { ReactNode } from 'react';

// =====================
// Types
// =====================

interface UndoableToastOptions {
  message: string;
  description?: string;
  duration?: number;
  onUndo: () => void | Promise<void>;
  onConfirm?: () => void | Promise<void>;
}

interface ProgressToastOptions {
  id?: string;
  message: string;
  description?: string;
}

interface GroupedToastOptions {
  groupId: string;
  message: string;
  count?: number;
  duration?: number;
}

// =====================
// Tracking State
// =====================

const activeToasts = new Map<string, { count: number; toastId: string | number }>();
const pendingUndos = new Map<string, NodeJS.Timeout>();

// =====================
// Undoable Toast
// =====================

/**
 * Show a toast with an undo button
 * Useful for destructive actions like delete
 * 
 * @example
 * toastWithUndo({
 *   message: 'Contract deleted',
 *   onUndo: () => restoreContract(contractId),
 *   onConfirm: () => permanentlyDelete(contractId),
 * });
 */
export function toastWithUndo({
  message,
  description,
  duration = 5000,
  onUndo,
  onConfirm,
}: UndoableToastOptions): string | number {
  const toastId = `undo-${Date.now()}`;
  
  // Set up auto-confirm timer
  const timeoutId = setTimeout(async () => {
    pendingUndos.delete(toastId);
    if (onConfirm) {
      await onConfirm();
    }
  }, duration);
  
  pendingUndos.set(toastId, timeoutId);
  
  return toast(message, {
    id: toastId,
    description,
    duration,
    action: {
      label: 'Undo',
      onClick: async () => {
        // Cancel the confirm timer
        const timeout = pendingUndos.get(toastId);
        if (timeout) {
          clearTimeout(timeout);
          pendingUndos.delete(toastId);
        }
        
        // Execute undo
        await onUndo();
        toast.success('Action undone');
      },
    },
  });
}

/**
 * Cancel a pending undoable action
 */
export function cancelUndo(toastId: string): void {
  const timeout = pendingUndos.get(toastId);
  if (timeout) {
    clearTimeout(timeout);
    pendingUndos.delete(toastId);
    toast.dismiss(toastId);
  }
}

// =====================
// Progress Toast
// =====================

/**
 * Show a loading toast that can be updated
 * 
 * @example
 * const toastId = toastProgress.start({ message: 'Uploading...' });
 * // Later...
 * toastProgress.update(toastId, { message: 'Processing...', description: '50%' });
 * // Finally...
 * toastProgress.success(toastId, 'Upload complete!');
 */
export const toastProgress = {
  start({ id, message, description }: ProgressToastOptions): string | number {
    const toastId = id || `progress-${Date.now()}`;
    toast.loading(message, {
      id: toastId,
      description,
    });
    return toastId;
  },
  
  update(toastId: string | number, { message, description }: ProgressToastOptions): void {
    toast.loading(message, {
      id: toastId,
      description,
    });
  },
  
  success(toastId: string | number, message: string, options?: ExternalToast): void {
    toast.success(message, {
      id: toastId,
      ...options,
    });
  },
  
  error(toastId: string | number, message: string, options?: ExternalToast): void {
    toast.error(message, {
      id: toastId,
      ...options,
    });
  },
  
  dismiss(toastId: string | number): void {
    toast.dismiss(toastId);
  },
};

// =====================
// Grouped Toast
// =====================

/**
 * Group multiple similar notifications into one
 * Prevents toast spam when many similar events happen
 * 
 * @example
 * // Called 5 times rapidly
 * toastGrouped({ groupId: 'contracts-updated', message: 'Contracts updated' });
 * // Shows: "Contracts updated (5)"
 */
export function toastGrouped({
  groupId,
  message,
  count = 1,
  duration = 3000,
}: GroupedToastOptions): void {
  const existing = activeToasts.get(groupId);
  
  if (existing) {
    // Update existing toast
    const newCount = existing.count + count;
    activeToasts.set(groupId, { ...existing, count: newCount });
    toast.success(`${message} (${newCount})`, {
      id: existing.toastId,
      duration,
    });
  } else {
    // Create new toast
    const toastId = toast.success(count > 1 ? `${message} (${count})` : message, {
      duration,
    });
    activeToasts.set(groupId, { count, toastId });
    
    // Clean up after duration
    setTimeout(() => {
      activeToasts.delete(groupId);
    }, duration + 100);
  }
}

// =====================
// Notification Types
// =====================

/**
 * Pre-configured toast types for common scenarios
 */
export const notify = {
  /** Success with optional description */
  success: (message: string, description?: string) => 
    toast.success(message, { description }),
  
  /** Error with optional description */
  error: (message: string, description?: string) => 
    toast.error(message, { description }),
  
  /** Warning toast */
  warning: (message: string, description?: string) => 
    toast.warning(message, { description }),
  
  /** Info toast */
  info: (message: string, description?: string) => 
    toast.info(message, { description }),
  
  /** Saved confirmation */
  saved: (itemName?: string) => 
    toast.success(itemName ? `${itemName} saved` : 'Changes saved'),
  
  /** Deleted with undo */
  deleted: (itemName: string, onUndo: () => void, onConfirm?: () => void) =>
    toastWithUndo({
      message: `${itemName} deleted`,
      onUndo,
      onConfirm,
    }),
  
  /** Copied to clipboard */
  copied: (itemName?: string) => 
    toast.success(itemName ? `${itemName} copied` : 'Copied to clipboard'),
  
  /** Network error */
  networkError: () => 
    toast.error('Network error', { description: 'Please check your connection and try again' }),
  
  /** Permission denied */
  permissionDenied: () => 
    toast.error('Permission denied', { description: 'You don\'t have access to perform this action' }),
  
  /** Rate limited */
  rateLimited: () => 
    toast.warning('Slow down', { description: 'Too many requests. Please wait a moment.' }),
  
  /** Coming soon */
  comingSoon: (featureName?: string) => 
    toast.info(featureName ? `${featureName} coming soon` : 'Coming soon!'),
};

// =====================
// Promise Toast
// =====================

/**
 * Wrap a promise with loading/success/error toasts
 * 
 * @example
 * await toastPromise(
 *   deleteContract(id),
 *   {
 *     loading: 'Deleting contract...',
 *     success: 'Contract deleted',
 *     error: 'Failed to delete contract',
 *   }
 * );
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: Error) => string);
  }
): Promise<T> {
  toast.promise(promise, messages);
  return promise;
}
