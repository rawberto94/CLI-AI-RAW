/**
 * Professional Feedback System
 * 
 * User-friendly error states, success messages, and feedback mechanisms
 */

'use client';

import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  LucideIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  ArrowRight,
  X,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Sparkles,
  Wifi,
  WifiOff,
  Server,
  ShieldAlert,
  FileWarning,
  Search,
  HelpCircle,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface FeedbackAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export interface ErrorDetails {
  code?: string;
  message: string;
  details?: string;
  timestamp?: Date;
  requestId?: string;
  suggestions?: string[];
  actions?: FeedbackAction[];
}

// =============================================================================
// TOAST NOTIFICATION
// =============================================================================

interface ToastProps {
  type: FeedbackType;
  title: string;
  message?: string;
  duration?: number;
  onClose?: () => void;
  action?: FeedbackAction;
  className?: string;
}

export const Toast = memo<ToastProps>(({
  type,
  title,
  message,
  duration = 5000,
  onClose,
  action,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (duration > 0 && type !== 'loading') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 200);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, type, onClose]);

  const icons: Record<FeedbackType, LucideIcon> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
    loading: Loader2,
  };
  
  const colors: Record<FeedbackType, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-violet-500',
    loading: 'bg-primary',
  };
  
  const Icon = icons[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className={cn(
            'flex items-start gap-3 p-4 rounded-xl',
            'bg-popover border shadow-lg',
            'max-w-sm w-full',
            className
          )}
        >
          <div className={cn('p-1.5 rounded-lg', colors[type])}>
            <Icon className={cn(
              'h-4 w-4 text-white',
              type === 'loading' && 'animate-spin'
            )} />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{title}</p>
            {message && (
              <p className="mt-1 text-xs text-muted-foreground">{message}</p>
            )}
            {action && (
              <button
                onClick={action.onClick}
                className="mt-2 text-xs font-medium text-primary hover:underline"
              >
                {action.label} →
              </button>
            )}
          </div>
          
          {onClose && type !== 'loading' && (
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onClose(), 200);
              }}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
Toast.displayName = 'Toast';

// =============================================================================
// TOAST CONTAINER
// =============================================================================

interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  className?: string;
  children?: React.ReactNode;
}

export const ToastContainer = memo<ToastContainerProps>(({
  position = 'top-right',
  className,
  children,
}) => {
  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div className={cn(
      'fixed z-50 flex flex-col gap-2',
      positionClasses[position],
      className
    )}>
      {children}
    </div>
  );
});
ToastContainer.displayName = 'ToastContainer';

// =============================================================================
// INLINE ALERT
// =============================================================================

interface InlineAlertProps {
  type: FeedbackType;
  title?: string;
  message: string;
  actions?: FeedbackAction[];
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export const InlineAlert = memo<InlineAlertProps>(({
  type,
  title,
  message,
  actions,
  dismissible = false,
  onDismiss,
  className,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  
  const icons: Record<FeedbackType, LucideIcon> = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
    loading: Loader2,
  };
  
  const styles: Record<FeedbackType, string> = {
    success: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
    info: 'bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-400',
    loading: 'bg-primary/10 border-primary/20 text-primary',
  };
  
  const Icon = icons[type];

  if (isDismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        styles[type],
        className
      )}
    >
      <Icon className={cn(
        'h-5 w-5 flex-shrink-0 mt-0.5',
        type === 'loading' && 'animate-spin'
      )} />
      
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium mb-1">{title}</p>}
        <p className="text-sm opacity-90">{message}</p>
        
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={action.onClick}
                className={cn(
                  'text-sm font-medium px-3 py-1.5 rounded-lg transition-colors',
                  action.variant === 'primary' && 'bg-current/20 hover:bg-current/30',
                  action.variant === 'ghost' && 'hover:bg-current/10',
                  !action.variant && 'bg-current/10 hover:bg-current/20',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {dismissible && (
        <button
          onClick={() => {
            setIsDismissed(true);
            onDismiss?.();
          }}
          className="p-1 rounded hover:bg-current/10"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
});
InlineAlert.displayName = 'InlineAlert';

// =============================================================================
// ERROR BOUNDARY UI
// =============================================================================

interface ErrorStateProps {
  error: ErrorDetails;
  onRetry?: () => void;
  onGoBack?: () => void;
  showDetails?: boolean;
  className?: string;
}

export const ErrorState = memo<ErrorStateProps>(({
  error,
  onRetry,
  onGoBack,
  showDetails = false,
  className,
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyError = useCallback(() => {
    const errorText = `
Error Code: ${error.code || 'N/A'}
Message: ${error.message}
Details: ${error.details || 'N/A'}
Request ID: ${error.requestId || 'N/A'}
Timestamp: ${error.timestamp?.toISOString() || 'N/A'}
    `.trim();
    
    navigator.clipboard.writeText(errorText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [error]);

  // Determine error type for better messaging
  const getErrorIcon = () => {
    if (error.code?.includes('NETWORK') || error.message.toLowerCase().includes('network')) {
      return WifiOff;
    }
    if (error.code?.includes('AUTH') || error.message.toLowerCase().includes('auth')) {
      return ShieldAlert;
    }
    if (error.code?.includes('SERVER') || error.message.toLowerCase().includes('server')) {
      return Server;
    }
    if (error.code?.includes('NOT_FOUND') || error.message.toLowerCase().includes('not found')) {
      return Search;
    }
    return XCircle;
  };

  const ErrorIcon = getErrorIcon();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        className
      )}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6"
      >
        <ErrorIcon className="h-10 w-10 text-red-500" />
      </motion.div>
      
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold mb-2"
      >
        {error.code ? `Error: ${error.code}` : 'Something went wrong'}
      </motion.h2>
      
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-muted-foreground max-w-md mb-6"
      >
        {error.message}
      </motion.p>
      
      {/* Suggestions */}
      {error.suggestions && error.suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-md mb-6"
        >
          <p className="text-sm font-medium text-left mb-2">Try the following:</p>
          <ul className="text-sm text-muted-foreground text-left space-y-1">
            {error.suggestions.map((suggestion, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
      
      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        )}
        
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium hover:bg-muted transition-colors"
          >
            Go Back
          </button>
        )}
        
        {error.actions?.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              action.variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
              action.variant === 'ghost' && 'hover:bg-muted',
              !action.variant && 'border hover:bg-muted',
            )}
          >
            {action.label}
          </button>
        ))}
      </motion.div>
      
      {/* Technical Details */}
      {showDetails && (error.details || error.requestId) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 w-full max-w-md"
        >
          <button
            onClick={() => setIsDetailsOpen(!isDetailsOpen)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <HelpCircle className="h-3 w-3" />
            {isDetailsOpen ? 'Hide' : 'Show'} technical details
          </button>
          
          <AnimatePresence>
            {isDetailsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-4 rounded-lg bg-muted text-left text-xs font-mono overflow-hidden"
              >
                {error.details && (
                  <p className="mb-2 break-all">{error.details}</p>
                )}
                {error.requestId && (
                  <p className="text-muted-foreground">Request ID: {error.requestId}</p>
                )}
                {error.timestamp && (
                  <p className="text-muted-foreground">Time: {error.timestamp.toISOString()}</p>
                )}
                
                <button
                  onClick={handleCopyError}
                  className="mt-3 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {isCopied ? 'Copied!' : 'Copy error details'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
});
ErrorState.displayName = 'ErrorState';

// =============================================================================
// EMPTY STATE
// =============================================================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: FeedbackAction;
  className?: string;
}

export const EmptyState = memo<EmptyStateProps>(({
  icon: Icon = Search,
  title,
  description,
  action,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center p-12 text-center',
        className
      )}
    >
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      )}
      
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
});
EmptyState.displayName = 'EmptyState';

// =============================================================================
// SUCCESS STATE
// =============================================================================

interface SuccessStateProps {
  title: string;
  description?: string;
  action?: FeedbackAction;
  secondaryAction?: FeedbackAction;
  confetti?: boolean;
  className?: string;
}

export const SuccessState = memo<SuccessStateProps>(({
  title,
  description,
  action,
  secondaryAction,
  confetti = false,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        className
      )}
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
        className="relative"
      >
        <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
          >
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </motion.div>
        </div>
        
        {confetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 pointer-events-none"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  x: 0, 
                  y: 0, 
                  opacity: 1,
                  scale: 1,
                }}
                animate={{ 
                  x: Math.cos(i * 30 * Math.PI / 180) * 60,
                  y: Math.sin(i * 30 * Math.PI / 180) * 60,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ 
                  duration: 0.8,
                  delay: 0.3 + (i * 0.02),
                  ease: 'easeOut',
                }}
                className={cn(
                  'absolute top-1/2 left-1/2 h-2 w-2 rounded-full',
                  i % 3 === 0 && 'bg-green-500',
                  i % 3 === 1 && 'bg-violet-500',
                  i % 3 === 2 && 'bg-amber-500',
                )}
                style={{
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </motion.div>
        )}
      </motion.div>
      
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-xl font-semibold mb-2"
      >
        {title}
      </motion.h2>
      
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground max-w-md mb-6"
        >
          {description}
        </motion.p>
      )}
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex items-center gap-3"
      >
        {action && (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
        
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border font-medium hover:bg-muted transition-colors"
          >
            {secondaryAction.label}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
});
SuccessState.displayName = 'SuccessState';

// =============================================================================
// FEEDBACK WIDGET
// =============================================================================

interface FeedbackWidgetProps {
  onFeedback: (rating: 'positive' | 'negative', comment?: string) => void;
  prompt?: string;
  className?: string;
}

export const FeedbackWidget = memo<FeedbackWidgetProps>(({
  onFeedback,
  prompt = 'Was this helpful?',
  className,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [selectedRating, setSelectedRating] = useState<'positive' | 'negative' | null>(null);

  const handleRating = (rating: 'positive' | 'negative') => {
    setSelectedRating(rating);
    if (rating === 'negative') {
      setShowComment(true);
    } else {
      onFeedback(rating);
      setSubmitted(true);
    }
  };

  const handleSubmitComment = () => {
    if (selectedRating) {
      onFeedback(selectedRating, comment);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}
      >
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        Thanks for your feedback!
      </motion.div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{prompt}</span>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleRating('positive')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              selectedRating === 'positive' ? 'bg-green-500/10 text-green-500' : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <ThumbsUp className="h-4 w-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleRating('negative')}
            className={cn(
              'p-2 rounded-lg transition-colors',
              selectedRating === 'negative' ? 'bg-red-500/10 text-red-500' : 'hover:bg-muted text-muted-foreground'
            )}
          >
            <ThumbsDown className="h-4 w-4" />
          </motion.button>
        </div>
      </div>
      
      <AnimatePresence>
        {showComment && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="How can we improve? (optional)"
              className="w-full p-3 text-sm rounded-lg border bg-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
              rows={2}
            />
            <button
              onClick={handleSubmitComment}
              className="mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Submit Feedback
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
FeedbackWidget.displayName = 'FeedbackWidget';

// =============================================================================
// LOADING SPINNER WITH MESSAGE
// =============================================================================

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner = memo<LoadingSpinnerProps>(({
  message,
  size = 'md',
  className,
}) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
  };

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      >
        <Loader2 className={cn(sizes[size], 'text-primary')} />
      </motion.div>
      {message && (
        <span className="text-sm text-muted-foreground">{message}</span>
      )}
    </div>
  );
});
LoadingSpinner.displayName = 'LoadingSpinner';

// =============================================================================
// CONNECTION STATUS
// =============================================================================

interface ConnectionStatusProps {
  isOnline: boolean;
  className?: string;
}

export const ConnectionStatus = memo<ConnectionStatusProps>(({
  isOnline,
  className,
}) => {
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowOffline(true);
    } else {
      // Show "back online" briefly then hide
      const timer = setTimeout(() => setShowOffline(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  return (
    <AnimatePresence>
      {showOffline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={cn(
            'fixed top-0 left-0 right-0 z-50 py-2 text-center text-sm font-medium',
            isOnline ? 'bg-green-500 text-white' : 'bg-red-500 text-white',
            className
          )}
        >
          <div className="flex items-center justify-center gap-2">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4" />
                You&apos;re back online
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                You&apos;re offline. Some features may be unavailable.
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
ConnectionStatus.displayName = 'ConnectionStatus';

// =============================================================================
// EXPORTS
// =============================================================================

export default Toast;
