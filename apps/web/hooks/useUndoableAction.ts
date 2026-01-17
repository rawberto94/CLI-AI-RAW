'use client';

/**
 * useUndoableAction Hook
 * 
 * Provides undo capability for destructive actions with toast notifications.
 * Shows a toast with an undo button that allows reverting the action within a time window.
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface UndoableActionOptions<T> {
  /** The action to perform (e.g., delete) */
  action: () => Promise<T>;
  /** The action to undo (e.g., restore) */
  undoAction: () => Promise<void>;
  /** Success message shown in toast */
  successMessage: string;
  /** Message shown when undo is triggered */
  undoMessage?: string;
  /** Duration in ms to show the undo option (default: 5000) */
  undoDuration?: number;
  /** Called when action completes successfully */
  onSuccess?: (result: T) => void;
  /** Called when action fails */
  onError?: (error: Error) => void;
  /** Called when undo completes */
  onUndo?: () => void;
}

interface UndoableActionReturn {
  execute: () => Promise<void>;
  isPending: boolean;
}

export function useUndoableAction<T = void>(
  options: UndoableActionOptions<T>
): UndoableActionReturn {
  const {
    action,
    undoAction,
    successMessage,
    undoMessage = 'Action undone',
    undoDuration = 5000,
    onSuccess,
    onError,
    onUndo,
  } = options;

  const isPendingRef = useRef(false);
  const toastIdRef = useRef<string | number | undefined>(undefined);

  const execute = useCallback(async () => {
    if (isPendingRef.current) return;

    isPendingRef.current = true;

    try {
      const result = await action();
      
      // Show success toast with undo button
      toastIdRef.current = toast.success(successMessage, {
        duration: undoDuration,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await undoAction();
              toast.success(undoMessage);
              onUndo?.();
            } catch {
              toast.error('Failed to undo action');
            }
          },
        },
      });

      onSuccess?.(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Action failed');
      toast.error(err.message);
      onError?.(err);
    } finally {
      isPendingRef.current = false;
    }
  }, [action, undoAction, successMessage, undoMessage, undoDuration, onSuccess, onError, onUndo]);

  return {
    execute,
    isPending: isPendingRef.current,
  };
}

/**
 * Creates an undoable delete action with optimistic UI update
 */
export function useUndoableDelete<T extends { id: string }>(options: {
  /** Function to delete the item */
  deleteItem: (id: string) => Promise<void>;
  /** Function to restore the item */
  restoreItem: (item: T) => Promise<void>;
  /** The item being deleted */
  item: T;
  /** Item type name for messages (e.g., "contract", "filter") */
  itemType: string;
  /** Called after successful delete */
  onDelete?: () => void;
  /** Called after successful undo */
  onRestore?: () => void;
}) {
  const { deleteItem, restoreItem, item, itemType, onDelete, onRestore } = options;

  return useUndoableAction({
    action: () => deleteItem(item.id),
    undoAction: () => restoreItem(item),
    successMessage: `${itemType} deleted`,
    undoMessage: `${itemType} restored`,
    onSuccess: onDelete,
    onUndo: onRestore,
  });
}

/**
 * Simple toast with undo button (no async action needed)
 */
export function showUndoToast(options: {
  message: string;
  onUndo: () => void;
  undoMessage?: string;
  duration?: number;
}) {
  const { message, onUndo, undoMessage = 'Undone', duration = 5000 } = options;

  toast.success(message, {
    duration,
    action: {
      label: 'Undo',
      onClick: () => {
        onUndo();
        toast.success(undoMessage);
      },
    },
  });
}
