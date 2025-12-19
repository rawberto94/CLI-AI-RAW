'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, CheckCircle, AlertCircle, AlertTriangle, Info, 
  Loader2, Undo2, Bell, BellOff, Volume2, VolumeX 
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'default';
type ToastPosition = 
  | 'top-left' 
  | 'top-center' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-center' 
  | 'bottom-right';

interface ToastOptions {
  id?: string;
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  undo?: () => void;
  icon?: React.ReactNode;
  onClose?: () => void;
  progress?: boolean;
}

interface Toast extends ToastOptions {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (options: ToastOptions) => string;
  updateToast: (id: string, options: Partial<ToastOptions>) => void;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
  pauseAll: () => void;
  resumeAll: () => void;
}

// ============================================================================
// Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface ToastProviderProps {
  children: React.ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
  pauseOnHover?: boolean;
  pauseOnFocusLoss?: boolean;
  playSound?: boolean;
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
  pauseOnHover = true,
  pauseOnFocusLoss = true,
  playSound = false,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (playSound && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, [playSound]);

  // Add toast
  const addToast = useCallback((options: ToastOptions): string => {
    const id = options.id || `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newToast: Toast = {
      ...options,
      id,
      type: options.type || 'default',
      duration: options.duration ?? (options.type === 'loading' ? Infinity : 5000),
      dismissible: options.dismissible ?? true,
      createdAt: Date.now(),
    };

    setToasts(prev => {
      const filtered = prev.filter(t => t.id !== id);
      const updated = [...filtered, newToast];
      return updated.slice(-maxToasts);
    });

    playNotificationSound();
    return id;
  }, [maxToasts, playNotificationSound]);

  // Update toast
  const updateToast = useCallback((id: string, options: Partial<ToastOptions>) => {
    setToasts(prev => 
      prev.map(toast => 
        toast.id === id ? { ...toast, ...options, createdAt: Date.now() } : toast
      )
    );
  }, []);

  // Dismiss toast
  const dismissToast = useCallback((id: string) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id);
      toast?.onClose?.();
      return prev.filter(t => t.id !== id);
    });
  }, []);

  // Dismiss all
  const dismissAll = useCallback(() => {
    toasts.forEach(toast => toast.onClose?.());
    setToasts([]);
  }, [toasts]);

  // Pause/resume
  const pauseAll = useCallback(() => setIsPaused(true), []);
  const resumeAll = useCallback(() => setIsPaused(false), []);

  // Pause on focus loss
  useEffect(() => {
    if (!pauseOnFocusLoss) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pauseOnFocusLoss]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        updateToast,
        dismissToast,
        dismissAll,
        pauseAll,
        resumeAll,
      }}
    >
      {children}
      <ToastContainer
        toasts={toasts}
        position={position}
        isPaused={isPaused}
        pauseOnHover={pauseOnHover}
        onDismiss={dismissToast}
        onPause={pauseAll}
        onResume={resumeAll}
      />
      {playSound && (
        <audio
          ref={audioRef}
          src="/sounds/notification.mp3"
          preload="auto"
        />
      )}
    </ToastContext.Provider>
  );
}

// ============================================================================
// Toast Container
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[];
  position: ToastPosition;
  isPaused: boolean;
  pauseOnHover: boolean;
  onDismiss: (id: string) => void;
  onPause: () => void;
  onResume: () => void;
}

function ToastContainer({
  toasts,
  position,
  isPaused,
  pauseOnHover,
  onDismiss,
  onPause,
  onResume,
}: ToastContainerProps) {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
  };

  const isTop = position.startsWith('top');

  return (
    <div
      className={`fixed z-[100] flex flex-col gap-2 pointer-events-none ${positionClasses[position]}`}
      style={{ maxWidth: 'min(420px, calc(100vw - 2rem))' }}
      onMouseEnter={pauseOnHover ? onPause : undefined}
      onMouseLeave={pauseOnHover ? onResume : undefined}
    >
      <AnimatePresence mode="popLayout">
        {(isTop ? toasts : [...toasts].reverse()).map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            isPaused={isPaused}
            onDismiss={onDismiss}
            position={position}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Toast Item
// ============================================================================

interface ToastItemProps {
  toast: Toast;
  isPaused: boolean;
  onDismiss: (id: string) => void;
  position: ToastPosition;
}

function ToastItem({ toast, isPaused, onDismiss, position }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(toast.duration || 5000);

  // Auto dismiss timer
  useEffect(() => {
    if (toast.duration === Infinity) return;

    let animationFrame: number;

    const updateProgress = () => {
      if (isPaused) {
        animationFrame = requestAnimationFrame(updateProgress);
        return;
      }

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      const newProgress = (remaining / (toast.duration || 5000)) * 100;

      setProgress(newProgress);

      if (remaining <= 0) {
        onDismiss(toast.id);
      } else {
        animationFrame = requestAnimationFrame(updateProgress);
      }
    };

    animationFrame = requestAnimationFrame(updateProgress);

    return () => cancelAnimationFrame(animationFrame);
  }, [toast.id, toast.duration, isPaused, onDismiss]);

  // Update start time when pausing/resuming
  useEffect(() => {
    if (isPaused) {
      remainingTimeRef.current -= Date.now() - startTimeRef.current;
    } else {
      startTimeRef.current = Date.now();
    }
  }, [isPaused]);

  const typeConfig = {
    success: {
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      bg: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800',
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
      bg: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800',
    },
    info: {
      icon: <Info className="w-5 h-5 text-blue-500" />,
      bg: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
    },
    loading: {
      icon: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
      bg: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
    },
    default: {
      icon: null,
      bg: 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700',
    },
  };

  const config = typeConfig[toast.type || 'default'];

  const slideDirection = position.includes('right') ? 100 : position.includes('left') ? -100 : 0;
  const slideY = position.startsWith('top') ? -20 : 20;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: slideDirection, y: slideY, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: slideDirection, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`
        pointer-events-auto rounded-xl border shadow-lg overflow-hidden
        ${config.bg}
      `}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        {(toast.icon || config.icon) && (
          <div className="flex-shrink-0 mt-0.5">
            {toast.icon || config.icon}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              {toast.title}
            </p>
          )}
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {toast.message}
          </p>

          {/* Actions */}
          {(toast.action || toast.undo) && (
            <div className="flex gap-2 mt-2">
              {toast.action && (
                <button
                  onClick={() => {
                    toast.action!.onClick();
                    onDismiss(toast.id);
                  }}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {toast.action.label}
                </button>
              )}
              {toast.undo && (
                <button
                  onClick={() => {
                    toast.undo!();
                    onDismiss(toast.id);
                  }}
                  className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Undo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible && (
          <button
            onClick={() => onDismiss(toast.id)}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {toast.progress !== false && toast.duration !== Infinity && (
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <motion.div
            className="h-full bg-current opacity-30"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Convenience Hooks
// ============================================================================

export function useToastActions() {
  const { addToast, updateToast, dismissToast, dismissAll } = useToast();

  return {
    success: (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, message, type: 'success' }),

    error: (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, message, type: 'error', duration: 8000 }),

    warning: (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, message, type: 'warning' }),

    info: (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, message, type: 'info' }),

    loading: (message: string, options?: Partial<ToastOptions>) =>
      addToast({ ...options, message, type: 'loading' }),

    promise: async <T,>(
      promise: Promise<T>,
      {
        loading = 'Loading...',
        success = 'Success!',
        error = 'Something went wrong',
      }: {
        loading?: string;
        success?: string | ((data: T) => string);
        error?: string | ((err: Error) => string);
      }
    ): Promise<T> => {
      const id = addToast({ message: loading, type: 'loading' });

      try {
        const result = await promise;
        const successMessage = typeof success === 'function' ? success(result) : success;
        updateToast(id, { message: successMessage, type: 'success', duration: 5000 });
        return result;
      } catch (err) {
        const errorMessage = typeof error === 'function' ? error(err as Error) : error;
        updateToast(id, { message: errorMessage, type: 'error', duration: 8000 });
        throw err;
      }
    },

    dismiss: dismissToast,
    dismissAll,
  };
}

// ============================================================================
// Notification Toggle
// ============================================================================

interface NotificationToggleProps {
  className?: string;
}

export function NotificationToggle({ className = '' }: NotificationToggleProps) {
  const [enabled, setEnabled] = useState(true);

  return (
    <button
      onClick={() => setEnabled(!enabled)}
      className={`p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
      title={enabled ? 'Mute notifications' : 'Unmute notifications'}
    >
      {enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
    </button>
  );
}

// ============================================================================
// Sound Toggle
// ============================================================================

interface SoundToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
}

export function SoundToggle({ enabled, onChange, className = '' }: SoundToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${className}`}
      title={enabled ? 'Mute sounds' : 'Unmute sounds'}
    >
      {enabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
    </button>
  );
}
