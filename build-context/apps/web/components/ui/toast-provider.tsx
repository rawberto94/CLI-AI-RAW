/**
 * Toast Provider Component
 * Context provider for toast notifications
 */

"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { ToastContainer } from "./toast-container";
import type { Toast } from "./toast-types";

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export interface ToastProviderProps {
  children: React.ReactNode;
  position?:
    | "top-right"
    | "top-left"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "bottom-center";
  maxToasts?: number;
}

export function ToastProvider({
  children,
  position = "top-right",
  maxToasts = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      
      // Determine type from variant or use default
      let type = toast.type;
      if (!type && toast.variant === 'destructive') {
        type = 'error';
      } else if (!type) {
        type = 'info';
      }
      
      const newToast: Toast = {
        id,
        dismissible: true,
        duration: 5000,
        type,
        ...toast,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Keep only the most recent toasts
        return updated.slice(-maxToasts);
      });

      // Auto-dismiss if duration is set
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }

      return id;
    },
    
    [maxToasts]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, clearToasts }}
    >
      {children}
      <ToastContainer
        toasts={toasts}
        onDismiss={removeToast}
        position={position}
      />
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications
 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  const { addToast, removeToast, clearToasts } = context;

  // Convenience methods
  const success = useCallback(
    (title: string, message?: string, options?: Partial<Toast>) => {
      return addToast({ type: "success", title, message, ...options });
    },
    [addToast]
  );

  const error = useCallback(
    (title: string, message?: string, options?: Partial<Toast>) => {
      return addToast({ type: "error", title, message, ...options });
    },
    [addToast]
  );

  const info = useCallback(
    (title: string, message?: string, options?: Partial<Toast>) => {
      return addToast({ type: "info", title, message, ...options });
    },
    [addToast]
  );

  const warning = useCallback(
    (title: string, message?: string, options?: Partial<Toast>) => {
      return addToast({ type: "warning", title, message, ...options });
    },
    [addToast]
  );

  return {
    toast: addToast,
    success,
    error,
    info,
    warning,
    dismiss: removeToast,
    clear: clearToasts,
  };
}
