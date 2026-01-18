'use client';

/**
 * Enhanced Toast Notification System
 * Beautiful, accessible toast notifications with actions and progress
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
  Undo2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'default' | 'destructive';
}

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number; // ms, 0 = infinite
  dismissible?: boolean;
  action?: ToastAction;
  undoAction?: () => void | Promise<void>;
  progress?: number; // 0-100 for loading toasts
  icon?: React.ReactNode;
  href?: string;
}

export type ToastOptions = Omit<Toast, 'id'>;

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: ToastOptions) => string;
  success: (title: string, options?: Partial<ToastOptions>) => string;
  error: (title: string, options?: Partial<ToastOptions>) => string;
  warning: (title: string, options?: Partial<ToastOptions>) => string;
  info: (title: string, options?: Partial<ToastOptions>) => string;
  loading: (title: string, options?: Partial<ToastOptions>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  update: (id: string, updates: Partial<Toast>) => void;
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => Promise<T>;
}

// ============================================
// Context
// ============================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// ============================================
// Toast Configuration
// ============================================

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
  loading: <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />,
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'border-emerald-200 dark:border-emerald-800',
  error: 'border-red-200 dark:border-red-800',
  warning: 'border-amber-200 dark:border-amber-800',
  info: 'border-blue-200 dark:border-blue-800',
  loading: 'border-purple-200 dark:border-purple-800',
};

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
  loading: 0, // Infinite until manually dismissed
};

// ============================================
// Toast Provider
// ============================================

interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Generate unique ID
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Add toast
  const addToast = useCallback((options: ToastOptions): string => {
    const id = generateId();
    const duration = options.duration ?? DEFAULT_DURATIONS[options.type];

    const newToast: Toast = {
      id,
      dismissible: true,
      ...options,
      duration,
    };

    setToasts(prev => {
      const updated = [newToast, ...prev];
      return updated.slice(0, maxToasts);
    });

    return id;
  }, [maxToasts]);

  // Dismiss toast
  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Dismiss all
  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Update toast
  const update = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Convenience methods
  const success = useCallback(
    (title: string, options?: Partial<ToastOptions>) =>
      addToast({ type: 'success', title, ...options }),
    [addToast]
  );

  const error = useCallback(
    (title: string, options?: Partial<ToastOptions>) =>
      addToast({ type: 'error', title, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (title: string, options?: Partial<ToastOptions>) =>
      addToast({ type: 'warning', title, ...options }),
    [addToast]
  );

  const info = useCallback(
    (title: string, options?: Partial<ToastOptions>) =>
      addToast({ type: 'info', title, ...options }),
    [addToast]
  );

  const loading = useCallback(
    (title: string, options?: Partial<ToastOptions>) =>
      addToast({ type: 'loading', title, ...options }),
    [addToast]
  );

  // Promise handler
  const handlePromise = useCallback(
    async <T,>(
      promise: Promise<T>,
      options: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: Error) => string);
      }
    ): Promise<T> => {
      const id = loading(options.loading);

      try {
        const result = await promise;
        const successMessage =
          typeof options.success === 'function'
            ? options.success(result)
            : options.success;

        update(id, {
          type: 'success',
          title: successMessage,
          duration: DEFAULT_DURATIONS.success,
        });

        return result;
      } catch (err) {
        const errorMessage =
          typeof options.error === 'function'
            ? options.error(err instanceof Error ? err : new Error('Unknown error'))
            : options.error;

        update(id, {
          type: 'error',
          title: errorMessage,
          duration: DEFAULT_DURATIONS.error,
        });

        throw err;
      }
    },
    [loading, update]
  );

  const value: ToastContextValue = {
    toasts,
    toast: addToast,
    success,
    error,
    warning,
    info,
    loading,
    dismiss,
    dismissAll,
    update,
    promise: handlePromise,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} position={position} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ============================================
// Toast Container
// ============================================

interface ToastContainerProps {
  toasts: Toast[];
  position: ToastPosition;
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, position, onDismiss }: ToastContainerProps) {
  const positionClasses: Record<ToastPosition, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  const isTop = position.startsWith('top');

  return (
    <div
      className={cn(
        'fixed z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none',
        positionClasses[position]
      )}
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {(isTop ? toasts : [...toasts].reverse()).map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Toast Item
// ============================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);

  // Auto dismiss with progress
  useEffect(() => {
    if (toast.duration === 0 || isHovered) return;

    const startTime = Date.now();
    const duration = toast.duration || 4000;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      } else {
        onDismiss(toast.id);
      }
    };

    const animationId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationId);
  }, [toast.id, toast.duration, isHovered, onDismiss]);

  const handleAction = async () => {
    if (toast.action?.onClick) {
      await toast.action.onClick();
    }
    onDismiss(toast.id);
  };

  const handleUndo = async () => {
    if (toast.undoAction) {
      await toast.undoAction();
    }
    onDismiss(toast.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'pointer-events-auto relative overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-lg',
        TOAST_STYLES[toast.type]
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Progress bar */}
      {toast.duration !== 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800">
          <motion.div
            className={cn(
              'h-full',
              toast.type === 'success' && 'bg-emerald-500',
              toast.type === 'error' && 'bg-red-500',
              toast.type === 'warning' && 'bg-amber-500',
              toast.type === 'info' && 'bg-blue-500',
              toast.type === 'loading' && 'bg-purple-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex items-start gap-3 p-4 pt-5">
        {/* Icon */}
        <div className="flex-shrink-0">
          {toast.icon || TOAST_ICONS[toast.type]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 dark:text-white text-sm">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {toast.description}
            </p>
          )}

          {/* Actions */}
          {(toast.action || toast.undoAction || toast.href) && (
            <div className="flex items-center gap-2 mt-3">
              {toast.action && (
                <button
                  onClick={handleAction}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-lg transition-colors',
                    toast.action.variant === 'destructive'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {toast.action.label}
                </button>
              )}
              {toast.undoAction && (
                <button
                  onClick={handleUndo}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  <Undo2 className="w-3 h-3" />
                  Undo
                </button>
              )}
              {toast.href && (
                <a
                  href={toast.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition-colors"
                >
                  View
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible && (
          <button
            onClick={() => onDismiss(toast.id)}
            className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Loading progress */}
      {toast.type === 'loading' && typeof toast.progress === 'number' && (
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${toast.progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-right">
            {toast.progress}%
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default ToastProvider;
