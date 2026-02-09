'use client';

/**
 * Undo Toast Component
 * Toast notifications with undo capability for reversible actions
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Undo2, 
  X, 
  Trash2, 
  Archive,
  CheckCircle2,
  AlertCircle,
  type LucideIcon 
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface UndoAction {
  id: string;
  message: string;
  icon?: LucideIcon;
  type?: 'delete' | 'archive' | 'update' | 'custom';
  duration?: number;
  onUndo: () => Promise<void> | void;
  onComplete?: () => void;
}

interface UndoToastContextValue {
  showUndoToast: (action: Omit<UndoAction, 'id'>) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

// ============================================================================
// Context
// ============================================================================

const UndoToastContext = createContext<UndoToastContextValue | null>(null);

export function useUndoToast() {
  const context = useContext(UndoToastContext);
  if (!context) {
    throw new Error('useUndoToast must be used within an UndoToastProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface UndoToastProviderProps {
  children: ReactNode;
  position?: 'bottom-left' | 'bottom-center' | 'bottom-right';
  maxToasts?: number;
}

export function UndoToastProvider({
  children,
  position = 'bottom-left',
  maxToasts = 3,
}: UndoToastProviderProps) {
  const [toasts, setToasts] = useState<UndoAction[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }

    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id);
      if (toast?.onComplete) {
        toast.onComplete();
      }
      return prev.filter((t) => t.id !== id);
    });
  }, []);

  const showUndoToast = useCallback((action: Omit<UndoAction, 'id'>) => {
    const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = action.duration ?? 5000;

    const newToast: UndoAction = {
      ...action,
      id,
    };

    setToasts((prev) => {
      const updated = [newToast, ...prev];
      return updated.slice(0, maxToasts);
    });

    // Auto dismiss after duration
    const timeout = setTimeout(() => {
      dismissToast(id);
    }, duration);
    timeoutsRef.current.set(id, timeout);

    return id;
  }, [maxToasts, dismissToast]);

  const dismissAll = useCallback(() => {
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setToasts((prev) => {
      prev.forEach((toast) => toast.onComplete?.());
      return [];
    });
  }, []);

  const positionClasses = {
    'bottom-left': 'bottom-6 left-6',
    'bottom-center': 'bottom-6 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-6 right-6',
  };

  return (
    <UndoToastContext.Provider value={{ showUndoToast, dismissToast, dismissAll }}>
      {children}
      
      {/* Toast Container */}
      <div className={cn('fixed z-50 flex flex-col gap-2', positionClasses[position])}>
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <UndoToastItem
              key={toast.id}
              toast={toast}
              onDismiss={() => dismissToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </UndoToastContext.Provider>
  );
}

// ============================================================================
// Toast Item
// ============================================================================

interface UndoToastItemProps {
  toast: UndoAction;
  onDismiss: () => void;
}

function UndoToastItem({ toast, onDismiss }: UndoToastItemProps) {
  const [isUndoing, setIsUndoing] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? 5000;

  // Progress bar animation
  React.useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - (100 / (duration / 100))));
    }, 100);

    return () => clearInterval(interval);
  }, [duration]);

  const handleUndo = async () => {
    setIsUndoing(true);
    try {
      await toast.onUndo();
      onDismiss();
    } catch {
      setIsUndoing(false);
    }
  };

  const typeIcons: Record<string, LucideIcon> = {
    delete: Trash2,
    archive: Archive,
    update: CheckCircle2,
    custom: AlertCircle,
  };

  const Icon = toast.icon || typeIcons[toast.type || 'custom'] || CheckCircle2;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="relative bg-slate-900 text-white rounded-xl shadow-2xl overflow-hidden min-w-[320px] max-w-md"
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-700">
        <motion.div
          className="h-full bg-violet-500"
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      <div className="flex items-center gap-3 p-4 pt-5">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-slate-300" />
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{toast.message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <motion.button
            onClick={handleUndo}
            disabled={isUndoing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              isUndoing
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            )}
            whileHover={!isUndoing ? { scale: 1.05 } : undefined}
            whileTap={!isUndoing ? { scale: 0.95 } : undefined}
          >
            <Undo2 className={cn('w-4 h-4', isUndoing && 'animate-spin')} />
            {isUndoing ? 'Undoing...' : 'Undo'}
          </motion.button>

          <button
            onClick={onDismiss}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Convenience Hooks
// ============================================================================

export function useUndoDelete() {
  const { showUndoToast } = useUndoToast();

  return useCallback((
    itemName: string,
    onUndo: () => Promise<void> | void,
    onComplete?: () => void
  ) => {
    return showUndoToast({
      message: `${itemName} deleted`,
      type: 'delete',
      onUndo,
      onComplete,
    });
  }, [showUndoToast]);
}

export function useUndoArchive() {
  const { showUndoToast } = useUndoToast();

  return useCallback((
    itemName: string,
    onUndo: () => Promise<void> | void,
    onComplete?: () => void
  ) => {
    return showUndoToast({
      message: `${itemName} archived`,
      type: 'archive',
      onUndo,
      onComplete,
    });
  }, [showUndoToast]);
}
