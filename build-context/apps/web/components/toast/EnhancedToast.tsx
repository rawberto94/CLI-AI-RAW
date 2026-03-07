'use client';

/**
 * Enhanced Toast Notifications
 * 
 * Beautiful, accessible toast notifications with:
 * - Multiple variants (success, error, warning, info, loading)
 * - Progress bars for timed toasts
 * - Action buttons
 * - Stacking and queuing
 * - Animations
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Loader2, 
  X,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'default';
export type ToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';

export interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms, 0 for persistent
  icon?: LucideIcon;
  action?: ToastAction;
  dismissible?: boolean;
  progress?: boolean;
  onDismiss?: () => void;
}

export type ToastOptions = Omit<Toast, 'id'>;

interface ToastContextValue {
  toasts: Toast[];
  toast: (options: ToastOptions) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  loading: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  update: (id: string, options: Partial<ToastOptions>) => void;
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ) => Promise<T>;
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
  defaultDuration?: number;
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
  defaultDuration = 5000,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdCounter = useRef(0);

  const generateId = () => {
    toastIdCounter.current += 1;
    return `toast-${toastIdCounter.current}-${Date.now()}`;
  };

  const dismiss = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      toast?.onDismiss?.();
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const dismissAll = useCallback(() => {
    setToasts(prev => {
      prev.forEach(t => t.onDismiss?.());
      return [];
    });
  }, []);

  const toast = useCallback((options: ToastOptions): string => {
    const id = generateId();
    const newToast: Toast = {
      id,
      variant: 'default',
      duration: defaultDuration,
      dismissible: true,
      progress: true,
      ...options,
    };

    setToasts(prev => {
      const updated = [newToast, ...prev];
      // Remove oldest if exceeding max
      if (updated.length > maxToasts) {
        const removed = updated.pop();
        removed?.onDismiss?.();
      }
      return updated;
    });

    // Auto dismiss if duration is set
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => dismiss(id), newToast.duration);
    }

    return id;
  }, [defaultDuration, maxToasts, dismiss]);

  const success = useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: 'success' });
  }, [toast]);

  const error = useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: 'error', duration: 8000 });
  }, [toast]);

  const warning = useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: 'warning' });
  }, [toast]);

  const info = useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: 'info' });
  }, [toast]);

  const loading = useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: 'loading', duration: 0, dismissible: false, progress: false });
  }, [toast]);

  const update = useCallback((id: string, options: Partial<ToastOptions>) => {
    setToasts(prev => prev.map(t => 
      t.id === id ? { ...t, ...options } : t
    ));
  }, []);

  const promiseToast = useCallback(async <T,>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    }
  ): Promise<T> => {
    const id = loading(options.loading);

    try {
      const data = await promise;
      const successMessage = typeof options.success === 'function' 
        ? options.success(data) 
        : options.success;
      update(id, { 
        title: successMessage, 
        variant: 'success', 
        duration: defaultDuration,
        dismissible: true,
        progress: true,
      });
      setTimeout(() => dismiss(id), defaultDuration);
      return data;
    } catch (err) {
      const errorMessage = typeof options.error === 'function'
        ? options.error(err as Error)
        : options.error;
      update(id, { 
        title: errorMessage, 
        variant: 'error', 
        duration: 8000,
        dismissible: true,
        progress: true,
      });
      setTimeout(() => dismiss(id), 8000);
      throw err;
    }
  }, [loading, update, dismiss, defaultDuration]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        toast,
        success,
        error,
        warning,
        info,
        loading,
        dismiss,
        dismissAll,
        update,
        promise: promiseToast,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} position={position} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ============================================================================
// Toast Container
// ============================================================================

const positionStyles: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

interface ToastContainerProps {
  toasts: Toast[];
  position: ToastPosition;
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, position, onDismiss }: ToastContainerProps) {
  const isTop = position.includes('top');

  return (
    <div
      className={cn(
        'fixed z-[100] flex flex-col gap-2 pointer-events-none',
        positionStyles[position]
      )}
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDismiss={() => onDismiss(toast.id)}
            fromTop={isTop}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Toast Item
// ============================================================================

const variantConfig: Record<ToastVariant, { icon: LucideIcon; styles: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    styles: 'bg-white border-violet-200',
    iconColor: 'text-violet-500',
  },
  error: {
    icon: XCircle,
    styles: 'bg-white border-red-200',
    iconColor: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    styles: 'bg-white border-amber-200',
    iconColor: 'text-amber-500',
  },
  info: {
    icon: Info,
    styles: 'bg-white border-violet-200',
    iconColor: 'text-violet-500',
  },
  loading: {
    icon: Loader2,
    styles: 'bg-white border-slate-200',
    iconColor: 'text-violet-500',
  },
  default: {
    icon: Info,
    styles: 'bg-white border-slate-200',
    iconColor: 'text-slate-500',
  },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
  fromTop: boolean;
}

function ToastItem({ toast, onDismiss, fromTop }: ToastItemProps) {
  const { variant = 'default', title, description, action, dismissible, progress, duration, icon: CustomIcon } = toast;
  const config = variantConfig[variant];
  const Icon = CustomIcon || config.icon;
  const isLoading = variant === 'loading';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: fromTop ? -20 : 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      className={cn(
        'pointer-events-auto relative overflow-hidden',
        'min-w-[320px] max-w-[420px] rounded-xl border shadow-lg',
        config.styles
      )}
      role="alert"
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className={cn('flex-shrink-0 mt-0.5', config.iconColor)}>
          <Icon className={cn('h-5 w-5', isLoading && 'animate-spin')} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
          
          {/* Action */}
          {action && (
            <div className="mt-3">
              <button
                onClick={action.onClick}
                className={cn(
                  'text-sm font-medium transition-colors',
                  action.variant === 'destructive'
                    ? 'text-red-600 hover:text-red-700'
                    : 'text-violet-600 hover:text-violet-700'
                )}
              >
                {action.label}
              </button>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {progress && duration && duration > 0 && (
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: duration / 1000, ease: 'linear' }}
          className={cn(
            'absolute bottom-0 left-0 h-1',
            variant === 'success' && 'bg-violet-500',
            variant === 'error' && 'bg-red-500',
            variant === 'warning' && 'bg-amber-500',
            variant === 'info' && 'bg-violet-500',
            variant === 'default' && 'bg-slate-400',
          )}
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// Standalone Toast Functions (for use without provider)
// ============================================================================

let toastQueue: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

function notifyListeners() {
  listeners.forEach(listener => listener([...toastQueue]));
}

export const standaloneToast = {
  success: (title: string, description?: string) => {
    const id = `toast-${Date.now()}`;
    toastQueue.push({ id, title, description, variant: 'success', duration: 5000 });
    notifyListeners();
    setTimeout(() => {
      toastQueue = toastQueue.filter(t => t.id !== id);
      notifyListeners();
    }, 5000);
    return id;
  },
  error: (title: string, description?: string) => {
    const id = `toast-${Date.now()}`;
    toastQueue.push({ id, title, description, variant: 'error', duration: 8000 });
    notifyListeners();
    setTimeout(() => {
      toastQueue = toastQueue.filter(t => t.id !== id);
      notifyListeners();
    }, 8000);
    return id;
  },
  subscribe: (listener: (toasts: Toast[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  },
};

export default ToastProvider;
