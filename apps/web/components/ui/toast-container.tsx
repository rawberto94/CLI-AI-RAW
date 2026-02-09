/**
 * Toast Container Component
 * Renders positioned toast notifications
 */

"use client";

import React from "react";
import type { Toast } from "./toast-types";

const positionClasses: Record<string, string> = {
  "top-right": "fixed top-4 right-4 z-[100]",
  "top-left": "fixed top-4 left-4 z-[100]",
  "bottom-right": "fixed bottom-4 right-4 z-[100]",
  "bottom-left": "fixed bottom-4 left-4 z-[100]",
  "top-center": "fixed top-4 left-1/2 -translate-x-1/2 z-[100]",
  "bottom-center": "fixed bottom-4 left-1/2 -translate-x-1/2 z-[100]",
};

const typeStyles: Record<string, string> = {
  success: "bg-green-50 border-green-200 text-green-900",
  error: "bg-red-50 border-red-200 text-red-900",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-900",
  info: "bg-blue-50 border-blue-200 text-blue-900",
};

const iconMap: Record<string, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: string;
}

export function ToastContainer({
  toasts,
  onDismiss,
  position = "top-right",
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className={positionClasses[position] || positionClasses["top-right"]}>
      <div className="flex flex-col gap-2 w-80">
        {toasts.map((toast) => {
          const type = toast.type || "info";
          return (
            <div
              key={toast.id}
              className={`rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-right-full ${typeStyles[type] || typeStyles.info}`}
              role="alert"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0" aria-hidden>
                  {iconMap[type] || iconMap.info}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{toast.title}</p>
                  {(toast.message || toast.description) && (
                    <p className="text-sm mt-1 opacity-80">
                      {toast.message || toast.description}
                    </p>
                  )}
                  {toast.action && (
                    <button
                      onClick={toast.action.onClick}
                      className="mt-2 text-sm font-medium underline hover:no-underline"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
                {toast.dismissible !== false && (
                  <button
                    onClick={() => onDismiss(toast.id)}
                    className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
