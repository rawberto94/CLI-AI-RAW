/**
 * Comprehensive Feedback System
 * Provides success toasts, error messages, and progress notifications
 */

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'progress';

export interface Feedback {
  id: string;
  type: FeedbackType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: number;
  persistent?: boolean;
}

interface FeedbackContextValue {
  feedbacks: Feedback[];
  showSuccess: (title: string, message?: string, options?: Partial<Feedback>) => string;
  showError: (title: string, message?: string, options?: Partial<Feedback>) => string;
  showWarning: (title: string, message?: string, options?: Partial<Feedback>) => string;
  showInfo: (title: string, message?: string, options?: Partial<Feedback>) => string;
  showProgress: (title: string, progress: number, message?: string) => string;
  updateProgress: (id: string, progress: number, message?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

// ============================================================================
// Context
// ============================================================================

const FeedbackContext = createContext<FeedbackContextValue | undefined>(undefined);

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  const addFeedback = useCallback((feedback: Omit<Feedback, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newFeedback: Feedback = {
      ...feedback,
      id,
      duration: feedback.duration ?? (feedback.type === 'error' ? 6000 : 4000),
      dismissible: feedback.dismissible ?? true,
    };

    setFeedbacks(prev => [...prev, newFeedback]);

    // Auto-dismiss if not persistent and not progress
    if (!newFeedback.persistent && newFeedback.type !== 'progress' && newFeedback.duration) {
      setTimeout(() => {
        setFeedbacks(prev => prev.filter(f => f.id !== id));
      }, newFeedback.duration);
    }

    return id;
  }, []);

  const showSuccess = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<Feedback>
  ) => {
    return addFeedback({ type: 'success', title, message, ...options });
  }, [addFeedback]);

  const showError = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<Feedback>
  ) => {
    return addFeedback({ type: 'error', title, message, ...options });
  }, [addFeedback]);

  const showWarning = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<Feedback>
  ) => {
    return addFeedback({ type: 'warning', title, message, ...options });
  }, [addFeedback]);

  const showInfo = useCallback((
    title: string, 
    message?: string, 
    options?: Partial<Feedback>
  ) => {
    return addFeedback({ type: 'info', title, message, ...options });
  }, [addFeedback]);

  const showProgress = useCallback((
    title: string, 
    progress: number, 
    message?: string
  ) => {
    return addFeedback({ 
      type: 'progress', 
      title, 
      message, 
      progress,
      persistent: true,
      dismissible: false,
    });
  }, [addFeedback]);

  const updateProgress = useCallback((id: string, progress: number, message?: string) => {
    setFeedbacks(prev => prev.map(f => 
      f.id === id 
        ? { ...f, progress, message: message || f.message }
        : f
    ));

    // Auto-dismiss when complete
    if (progress >= 100) {
      setTimeout(() => {
        setFeedbacks(prev => prev.filter(f => f.id !== id));
      }, 1000);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setFeedbacks(prev => prev.filter(f => f.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setFeedbacks([]);
  }, []);

  return (
    <FeedbackContext.Provider
      value={{
        feedbacks,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showProgress,
        updateProgress,
        dismiss,
        dismissAll,
      }}
    >
      {children}
      <FeedbackContainer feedbacks={feedbacks} onDismiss={dismiss} />
    </FeedbackContext.Provider>
  );
}

// ============================================================================
// Feedback Container
// ============================================================================

interface FeedbackContainerProps {
  feedbacks: Feedback[];
  onDismiss: (id: string) => void;
}

function FeedbackContainer({ feedbacks, onDismiss }: FeedbackContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md w-full pointer-events-none">
      <AnimatePresence>
        {feedbacks.map(feedback => (
          <FeedbackItem
            key={feedback.id}
            feedback={feedback}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Feedback Item
// ============================================================================

interface FeedbackItemProps {
  feedback: Feedback;
  onDismiss: (id: string) => void;
}

function FeedbackItem({ feedback, onDismiss }: FeedbackItemProps) {
  const getIcon = () => {
    switch (feedback.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
      case 'progress':
        return <Loader2 className="w-5 h-5 animate-spin" />;
    }
  };

  const getColors = () => {
    switch (feedback.type) {
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
        return {
          bg: 'bg-violet-50',
          border: 'border-violet-200',
          icon: 'text-violet-600',
          title: 'text-violet-900',
          message: 'text-violet-700',
        };
      case 'progress':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          icon: 'text-purple-600',
          title: 'text-purple-900',
          message: 'text-purple-700',
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
      className={`
        pointer-events-auto relative flex items-start gap-3 p-4 rounded-lg border shadow-lg
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
          {feedback.title}
        </h4>

        {feedback.message && (
          <p className={`text-sm mt-1 ${colors.message}`}>
            {feedback.message}
          </p>
        )}

        {/* Progress Bar */}
        {feedback.type === 'progress' && feedback.progress !== undefined && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className={colors.message}>Progress</span>
              <span className={colors.message}>{Math.round(feedback.progress)}%</span>
            </div>
            <div className="h-2 bg-white/50 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-600"
                initial={{ width: 0 }}
                animate={{ width: `${feedback.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        {feedback.action && (
          <button
            onClick={feedback.action.onClick}
            className={`
              text-sm font-medium mt-2 underline hover:no-underline transition-all
              ${colors.title}
            `}
          >
            {feedback.action.label}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      {feedback.dismissible && (
        <button
          onClick={() => onDismiss(feedback.id)}
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

// ============================================================================
// Inline Error Message Component
// ============================================================================

export interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function InlineError({ message, onRetry, onDismiss }: InlineErrorProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-red-900 font-medium">Error</p>
        <p className="text-sm text-red-700 mt-1">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-sm font-medium text-red-900 underline hover:no-underline mt-2"
          >
            Try Again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-red-100 transition-colors text-red-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Inline Success Message Component
// ============================================================================

export interface InlineSuccessProps {
  message: string;
  onDismiss?: () => void;
}

export function InlineSuccess({ message, onDismiss }: InlineSuccessProps) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-green-900 font-medium">Success</p>
        <p className="text-sm text-green-700 mt-1">{message}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded hover:bg-green-100 transition-colors text-green-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Form Field Error Component
// ============================================================================

export interface FieldErrorProps {
  error?: string;
}

export function FieldError({ error }: FieldErrorProps) {
  if (!error) return null;

  return (
    <motion.p
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-sm text-red-600 mt-1 flex items-center gap-1"
    >
      <AlertCircle className="w-3 h-3" />
      {error}
    </motion.p>
  );
}
