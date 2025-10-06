/**
 * Toast Component
 * Individual toast notification
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, Check, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastProps extends Toast {
  onDismiss: (id: string) => void;
}

export function ToastComponent({
  id,
  type,
  title,
  message,
  dismissible = true,
  action,
  onDismiss,
}: ToastProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: 'text-green-600',
          title: 'text-green-900',
          message: 'text-green-700',
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
          title: 'text-red-900',
          message: 'text-red-700',
        };
      case 'warning':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          icon: 'text-orange-600',
          title: 'text-orange-900',
          message: 'text-orange-700',
        };
      case 'info':
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          message: 'text-blue-700',
        };
    }
  };

  const colors = getColors();

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      layout
      className={`
        relative flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-sm w-full
        ${colors.bg} ${colors.border}
      `}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${colors.icon}`}>
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-semibold ${colors.title}`}>
          {title}
        </h4>
        
        {message && (
          <p className={`text-sm mt-1 ${colors.message}`}>
            {message}
          </p>
        )}
        
        {action && (
          <button
            onClick={action.onClick}
            className={`
              text-sm font-medium mt-2 underline hover:no-underline transition-all
              ${colors.title}
            `}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <button
          onClick={() => onDismiss(id)}
          className={`
            flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors
            ${colors.icon}
          `}
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
