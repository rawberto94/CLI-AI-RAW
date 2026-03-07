'use client';

/**
 * Enhanced Toast Notifications
 * Beautiful, accessible toast notifications with rich content support
 */

import React, { createContext, useContext, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Loader2,
  ExternalLink,
  type LucideIcon 
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline';
}

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: ToastAction;
  duration?: number;
  dismissible?: boolean;
  icon?: LucideIcon;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, toast: Partial<Toast>) => void;
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

// Convenience functions
export function useToastActions() {
  const { addToast, removeToast, updateToast } = useToast();
  
  return {
    success: (title: string, description?: string, action?: ToastAction) =>
      addToast({ type: 'success', title, description, action }),
    error: (title: string, description?: string, action?: ToastAction) =>
      addToast({ type: 'error', title, description, action, duration: 8000 }),
    warning: (title: string, description?: string, action?: ToastAction) =>
      addToast({ type: 'warning', title, description, action }),
    info: (title: string, description?: string, action?: ToastAction) =>
      addToast({ type: 'info', title, description, action }),
    loading: (title: string, description?: string) =>
      addToast({ type: 'loading', title, description, duration: Infinity, dismissible: false }),
    dismiss: removeToast,
    update: updateToast,
  };
}

// ============================================================================
// Toast Styles
// ============================================================================

const TOAST_STYLES: Record<ToastType, { 
  icon: LucideIcon; 
  iconClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-violet-500',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-500',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
  info: {
    icon: Info,
    iconClass: 'text-violet-500',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
  },
  loading: {
    icon: Loader2,
    iconClass: 'text-violet-500 animate-spin',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
  },
};

// ============================================================================
// Toast Component
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const style = TOAST_STYLES[toast.type];
  const Icon = toast.icon || style.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className={cn(
        'relative flex items-start gap-3 w-full max-w-sm p-4 rounded-xl border shadow-lg',
        'bg-white backdrop-blur-sm',
        style.borderClass
      )}
    >
      {/* Icon */}
      <div className={cn('p-1 rounded-lg', style.bgClass)}>
        <Icon className={cn('w-5 h-5', style.iconClass)} />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-slate-600">{toast.description}</p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className={cn(
              'mt-2 text-sm font-medium inline-flex items-center gap-1',
              'transition-colors',
              toast.action.variant === 'outline'
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-violet-600 hover:text-violet-700'
            )}
          >
            {toast.action.label}
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
      
      {/* Dismiss button */}
      {toast.dismissible !== false && (
        <button
          onClick={onDismiss}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      {/* Progress bar for timed toasts */}
      {toast.duration && toast.duration !== Infinity && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
          className={cn(
            'absolute bottom-0 left-0 right-0 h-1 origin-left rounded-b-xl',
            style.bgClass
          )}
          style={{ transformOrigin: 'left' }}
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// Toast Container
// ============================================================================

interface ToastContainerProps {
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
}

function ToastContainer({ position = 'top-right' }: ToastContainerProps) {
  const { toasts, removeToast } = useToast();
  
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-left': 'bottom-4 left-4',
  };

  return (
    <div className={cn(
      'fixed z-[100] flex flex-col gap-2 pointer-events-none',
      positionClasses[position]
    )}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={() => removeToast(toast.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Provider
// ============================================================================

interface EnhancedToastProviderProps {
  children: React.ReactNode;
  position?: ToastContainerProps['position'];
  maxToasts?: number;
}

export function EnhancedToastProvider({ 
  children, 
  position = 'top-right',
  maxToasts = 5 
}: EnhancedToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = toast.duration ?? 5000;
    
    setToasts((prev) => {
      const newToasts = [...prev, { ...toast, id, duration }];
      // Limit number of toasts
      return newToasts.slice(-maxToasts);
    });

    // Auto dismiss
    if (duration !== Infinity) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, [maxToasts]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <ToastContainer position={position} />
    </ToastContext.Provider>
  );
}

// ============================================================================
// Standalone Toast Function (for use outside React)
// ============================================================================

let toastFn: ToastContextValue['addToast'] | null = null;

export function setToastFunction(fn: ToastContextValue['addToast']) {
  toastFn = fn;
}

export const toast = {
  success: (title: string, description?: string) => 
    toastFn?.({ type: 'success', title, description }),
  error: (title: string, description?: string) => 
    toastFn?.({ type: 'error', title, description, duration: 8000 }),
  warning: (title: string, description?: string) => 
    toastFn?.({ type: 'warning', title, description }),
  info: (title: string, description?: string) => 
    toastFn?.({ type: 'info', title, description }),
  loading: (title: string, description?: string) => 
    toastFn?.({ type: 'loading', title, description, duration: Infinity, dismissible: false }),
};
