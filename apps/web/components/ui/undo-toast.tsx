/**
 * Undo Toast Provider
 * Provides undo functionality for destructive actions
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2, X, Trash2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Types
interface UndoAction {
  id: string;
  type: 'delete' | 'archive' | 'update' | 'bulk-delete';
  message: string;
  itemCount?: number;
  undoData: unknown;
  onUndo: (data: unknown) => Promise<void>;
  onConfirm: () => Promise<void>;
  timeout: number;
  createdAt: number;
}

interface UndoToastContextValue {
  showUndo: (options: {
    type: UndoAction['type'];
    message: string;
    itemCount?: number;
    undoData: unknown;
    onUndo: (data: unknown) => Promise<void>;
    onConfirm: () => Promise<void>;
    timeout?: number;
  }) => string;
  cancelUndo: (id: string) => void;
  confirmAction: (id: string) => void;
}

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export function useUndoToast() {
  const context = useContext(UndoToastContext);
  if (!context) {
    throw new Error('useUndoToast must be used within UndoToastProvider');
  }
  return context;
}

// Toast item component
function UndoToastItem({
  action,
  onUndo,
  onDismiss,
  timeRemaining,
}: {
  action: UndoAction;
  onUndo: () => void;
  onDismiss: () => void;
  timeRemaining: number;
}) {
  const [isUndoing, setIsUndoing] = useState(false);
  const progress = (timeRemaining / action.timeout) * 100;

  const handleUndo = async () => {
    setIsUndoing(true);
    await onUndo();
  };

  const Icon = action.type === 'delete' || action.type === 'bulk-delete' ? Trash2 : AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="relative bg-slate-900 text-white rounded-xl shadow-2xl overflow-hidden min-w-[320px] max-w-md"
    >
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700">
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
          className={cn(
            "h-full",
            action.type === 'delete' || action.type === 'bulk-delete'
              ? "bg-red-500"
              : "bg-amber-500"
          )}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            action.type === 'delete' || action.type === 'bulk-delete'
              ? "bg-red-500/20"
              : "bg-amber-500/20"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              action.type === 'delete' || action.type === 'bulk-delete'
                ? "text-red-400"
                : "text-amber-400"
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{action.message}</p>
            {action.itemCount && action.itemCount > 1 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {action.itemCount} items affected
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Action will complete in {Math.ceil(timeRemaining / 1000)}s
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUndo}
              disabled={isUndoing}
              className="h-8 px-3 text-white hover:bg-white/10 gap-1.5"
            >
              {isUndoing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Undo2 className="h-4 w-4" />
                  Undo
                </>
              )}
            </Button>
            <button
              onClick={onDismiss}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Provider component
export function UndoToastProvider({ children }: { children: React.ReactNode }) {
  const [actions, setActions] = useState<UndoAction[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({});
  const timersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Show undo toast
  const showUndo = useCallback((options: {
    type: UndoAction['type'];
    message: string;
    itemCount?: number;
    undoData: unknown;
    onUndo: (data: unknown) => Promise<void>;
    onConfirm: () => Promise<void>;
    timeout?: number;
  }): string => {
    const id = Math.random().toString(36).substring(2, 9);
    const timeout = options.timeout || 5000;

    const action: UndoAction = {
      id,
      type: options.type,
      message: options.message,
      itemCount: options.itemCount,
      undoData: options.undoData,
      onUndo: options.onUndo,
      onConfirm: options.onConfirm,
      timeout,
      createdAt: Date.now(),
    };

    setActions((prev) => [...prev, action]);
    setTimeRemaining((prev) => ({ ...prev, [id]: timeout }));

    // Start countdown interval
    intervalsRef.current[id] = setInterval(() => {
      setTimeRemaining((prev) => {
        const remaining = Math.max(0, (prev[id] ?? 0) - 100);
        return { ...prev, [id]: remaining };
      });
    }, 100);

    // Set timer for auto-confirm
    timersRef.current[id] = setTimeout(async () => {
      clearInterval(intervalsRef.current[id]);
      try {
        await action.onConfirm();
      } catch (error) {
        console.error('Failed to confirm action:', error);
      }
      setActions((prev) => prev.filter((a) => a.id !== id));
      setTimeRemaining((prev) => {
        const { [id]: _, ...rest } = prev;
        return rest;
      });
    }, timeout);

    return id;
  }, []);

  // Cancel undo (actually perform the undo)
  const cancelUndo = useCallback(async (id: string) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;

    // Clear timers
    clearTimeout(timersRef.current[id]);
    clearInterval(intervalsRef.current[id]);
    delete timersRef.current[id];
    delete intervalsRef.current[id];

    try {
      await action.onUndo(action.undoData);
    } catch (error) {
      console.error('Failed to undo action:', error);
    }

    setActions((prev) => prev.filter((a) => a.id !== id));
    setTimeRemaining((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, [actions]);

  // Force confirm action immediately
  const confirmAction = useCallback(async (id: string) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;

    // Clear timers
    clearTimeout(timersRef.current[id]);
    clearInterval(intervalsRef.current[id]);
    delete timersRef.current[id];
    delete intervalsRef.current[id];

    try {
      await action.onConfirm();
    } catch (error) {
      console.error('Failed to confirm action:', error);
    }

    setActions((prev) => prev.filter((a) => a.id !== id));
    setTimeRemaining((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, [actions]);

  return (
    <UndoToastContext.Provider value={{ showUndo, cancelUndo, confirmAction }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {actions.map((action) => (
            <UndoToastItem
              key={action.id}
              action={action}
              timeRemaining={timeRemaining[action.id] || 0}
              onUndo={() => cancelUndo(action.id)}
              onDismiss={() => confirmAction(action.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </UndoToastContext.Provider>
  );
}

// Hook for common delete pattern
export function useUndoDelete() {
  const { showUndo } = useUndoToast();

  const deleteWithUndo = useCallback(async <T,>(options: {
    items: T[];
    itemLabel: string;
    onDelete: (items: T[]) => Promise<void>;
    onRestore: (items: T[]) => Promise<void>;
    timeout?: number;
  }) => {
    const { items, itemLabel, onDelete, onRestore, timeout = 5000 } = options;
    const count = items.length;
    const message = count === 1
      ? `${itemLabel} deleted`
      : `${count} ${itemLabel}s deleted`;

    // Optimistically remove items from UI first (caller should handle this)
    
    showUndo({
      type: count > 1 ? 'bulk-delete' : 'delete',
      message,
      itemCount: count,
      undoData: items,
      onUndo: async (data) => {
        await onRestore(data as T[]);
      },
      onConfirm: async () => {
        await onDelete(items);
      },
      timeout,
    });
  }, [showUndo]);

  return { deleteWithUndo };
}
