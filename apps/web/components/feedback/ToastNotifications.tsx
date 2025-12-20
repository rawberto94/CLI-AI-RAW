'use client';

/**
 * Enhanced Toast Notifications
 * Rich toast system with actions, progress, and queuing
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Loader2,
  ExternalLink,
  Undo2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'promise';

interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'destructive';
}

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
  action?: ToastAction;
  undoAction?: () => void;
  progress?: number;
  icon?: React.ReactNode;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
  clearAll: () => void;
  
  // Convenience methods
  success: (title: string, options?: Partial<Toast>) => string;
  error: (title: string, options?: Partial<Toast>) => string;
  warning: (title: string, options?: Partial<Toast>) => string;
  info: (title: string, options?: Partial<Toast>) => string;
  loading: (title: string, options?: Partial<Toast>) => string;
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((data: T) => string); error: string | ((err: Error) => string) }
  ) => Promise<T>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Generate unique ID
function generateId() {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Toast Provider
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Add a new toast
  const addToast = useCallback((toast: Omit<Toast, 'id' | 'createdAt'>) => {
    const id = generateId();
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
      dismissible: toast.dismissible ?? true,
      duration: toast.type === 'loading' ? 0 : (toast.duration ?? 4000),
    };

    setToasts(prev => {
      // Limit to 5 toasts max
      const updated = [...prev, newToast];
      if (updated.length > 5) {
        const removed = updated.shift();
        if (removed) {
          const timer = timersRef.current.get(removed.id);
          if (timer) clearTimeout(timer);
          timersRef.current.delete(removed.id);
        }
      }
      return updated;
    });

    // Auto dismiss
    if (newToast.duration && newToast.duration > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        timersRef.current.delete(id);
      }, newToast.duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, []);

  // Remove a toast
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Update a toast
  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

    // Reset timer if duration changed
    if (updates.duration !== undefined) {
      const timer = timersRef.current.get(id);
      if (timer) clearTimeout(timer);

      if (updates.duration > 0) {
        const newTimer = setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
          timersRef.current.delete(id);
        }, updates.duration);
        timersRef.current.set(id, newTimer);
      }
    }
  }, []);

  // Clear all toasts
  const clearAll = useCallback(() => {
    setToasts([]);
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  // Convenience methods
  const success = useCallback((title: string, options?: Partial<Toast>) => {
    return addToast({ type: 'success', title, ...options });
  }, [addToast]);

  const error = useCallback((title: string, options?: Partial<Toast>) => {
    return addToast({ type: 'error', title, duration: 6000, ...options });
  }, [addToast]);

  const warning = useCallback((title: string, options?: Partial<Toast>) => {
    return addToast({ type: 'warning', title, ...options });
  }, [addToast]);

  const info = useCallback((title: string, options?: Partial<Toast>) => {
    return addToast({ type: 'info', title, ...options });
  }, [addToast]);

  const loading = useCallback((title: string, options?: Partial<Toast>) => {
    return addToast({ type: 'loading', title, dismissible: false, ...options });
  }, [addToast]);

  const promise = useCallback(async <T,>(
    promiseValue: Promise<T>,
    messages: { loading: string; success: string | ((data: T) => string); error: string | ((err: Error) => string) }
  ) => {
    const id = addToast({ type: 'loading', title: messages.loading, dismissible: false });

    try {
      const data = await promiseValue;
      const successMessage = typeof messages.success === 'function' 
        ? messages.success(data) 
        : messages.success;
      updateToast(id, { type: 'success', title: successMessage, duration: 4000, dismissible: true });
      return data;
    } catch (err) {
      const errorMessage = typeof messages.error === 'function' 
        ? messages.error(err as Error) 
        : messages.error;
      updateToast(id, { type: 'error', title: errorMessage, duration: 6000, dismissible: true });
      throw err;
    }
  }, [addToast, updateToast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      updateToast,
      clearAll,
      success,
      error,
      warning,
      info,
      loading,
      promise,
    }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

// Toast Container
function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Toast Icons
const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  info: <Info className="h-5 w-5 text-blue-500" />,
  loading: <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />,
  promise: <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />,
};

const toastStyles: Record<ToastType, string> = {
  success: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50',
  error: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50',
  warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50',
  info: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50',
  loading: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50',
  promise: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50',
};

// Individual Toast Item
interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(toast.createdAt);
  const durationRef = useRef(toast.duration || 4000);

  // Progress bar animation
  useEffect(() => {
    if (toast.type === 'loading' || toast.duration === 0) return;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / durationRef.current) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [toast.type, toast.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      className={cn(
        "relative overflow-hidden rounded-lg border shadow-lg pointer-events-auto",
        toastStyles[toast.type]
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            {toast.icon || toastIcons[toast.type]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {toast.title}
            </p>
            {toast.description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {toast.description}
              </p>
            )}

            {/* Actions */}
            {(toast.action || toast.undoAction) && (
              <div className="mt-3 flex items-center gap-2">
                {toast.action && (
                  <button
                    onClick={() => {
                      toast.action?.onClick();
                      onDismiss();
                    }}
                    className={cn(
                      "text-xs font-medium px-2 py-1 rounded transition-colors",
                      toast.action.variant === 'destructive'
                        ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300"
                        : toast.action.variant === 'secondary'
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300"
                    )}
                  >
                    {toast.action.label}
                    {toast.action.label.toLowerCase().includes('view') && (
                      <ExternalLink className="inline-block h-3 w-3 ml-1" />
                    )}
                  </button>
                )}
                {toast.undoAction && (
                  <button
                    onClick={() => {
                      toast.undoAction?.();
                      onDismiss();
                    }}
                    className="text-xs font-medium px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition-colors flex items-center gap-1"
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Dismiss button */}
          {toast.dismissible && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 p-1 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && toast.type !== 'loading' && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/50 dark:bg-slate-700/50">
          <motion.div
            initial={{ width: '100%' }}
            style={{ width: `${progress}%` }}
            className={cn(
              "h-full transition-none",
              toast.type === 'success' && "bg-emerald-500",
              toast.type === 'error' && "bg-red-500",
              toast.type === 'warning' && "bg-amber-500",
              toast.type === 'info' && "bg-blue-500"
            )}
          />
        </div>
      )}

      {/* Custom progress (for file uploads, etc.) */}
      {toast.progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/50 dark:bg-slate-700/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${toast.progress}%` }}
            className="h-full bg-indigo-500"
          />
        </div>
      )}
    </motion.div>
  );
}

// Standalone toast function (for use outside React context)
let externalAddToast: ((toast: Omit<Toast, 'id' | 'createdAt'>) => string) | null = null;

export function setExternalToast(addFn: typeof externalAddToast) {
  externalAddToast = addFn;
}

export const toast = {
  success: (title: string, options?: Partial<Toast>) => 
    externalAddToast?.({ type: 'success', title, ...options }),
  error: (title: string, options?: Partial<Toast>) => 
    externalAddToast?.({ type: 'error', title, duration: 6000, ...options }),
  warning: (title: string, options?: Partial<Toast>) => 
    externalAddToast?.({ type: 'warning', title, ...options }),
  info: (title: string, options?: Partial<Toast>) => 
    externalAddToast?.({ type: 'info', title, ...options }),
  loading: (title: string, options?: Partial<Toast>) => 
    externalAddToast?.({ type: 'loading', title, dismissible: false, ...options }),
};

export default ToastProvider;
