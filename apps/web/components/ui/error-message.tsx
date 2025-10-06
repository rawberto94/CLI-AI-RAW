/**
 * Enhanced Error Message Component
 * Displays user-friendly error messages with recovery suggestions
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, X } from 'lucide-react';
import { shakeVariants, slideDownVariants } from '@/lib/animations/variants';
import { animationConfig } from '@/lib/animations/config';

export interface ErrorMessageProps {
  error: ImportError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  className?: string;
}

export interface ImportError {
  type: 'upload' | 'parsing' | 'validation' | 'network' | 'database';
  message: string;
  details?: string;
  recoverable: boolean;
  suggestions?: string[];
  affectedRows?: number[];
  affectedColumns?: string[];
}

export function ErrorMessage({
  error,
  onRetry,
  onDismiss,
  showDetails = false,
  className = '',
}: ErrorMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isShaking, setIsShaking] = useState(true);

  // Stop shaking after initial animation
  React.useEffect(() => {
    const timer = setTimeout(() => setIsShaking(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const getIcon = () => {
    switch (error.type) {
      case 'upload':
      case 'parsing':
        return <AlertCircle className="h-5 w-5" />;
      case 'validation':
      case 'network':
      case 'database':
      default:
        return <XCircle className="h-5 w-5" />;
    }
  };

  const getColorClasses = () => {
    return {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      text: 'text-red-900',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      secondaryButton: 'text-red-700 hover:bg-red-100',
    };
  };

  const colors = getColorClasses();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial="hidden"
        animate={isShaking ? "shake" : "visible"}
        exit="exit"
        variants={isShaking ? shakeVariants : slideDownVariants}
        className={`rounded-lg border-2 p-4 ${colors.container} ${className}`}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${colors.icon}`}>
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Main message */}
            <h3 className={`text-sm font-semibold ${colors.text}`}>
              {error.message}
            </h3>

            {/* Affected items */}
            {(error.affectedRows || error.affectedColumns) && (
              <p className={`mt-1 text-sm ${colors.text} opacity-80`}>
                {error.affectedRows && (
                  <span>Rows: {error.affectedRows.join(', ')}</span>
                )}
                {error.affectedRows && error.affectedColumns && <span> • </span>}
                {error.affectedColumns && (
                  <span>Columns: {error.affectedColumns.join(', ')}</span>
                )}
              </p>
            )}

            {/* Suggestions */}
            {error.suggestions && error.suggestions.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ delay: 0.2, duration: animationConfig.duration.normal }}
                className="mt-3 space-y-1"
              >
                {error.suggestions.map((suggestion, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className={`text-sm ${colors.text} opacity-90 flex items-start gap-2`}
                  >
                    <span className="text-red-500 font-bold">•</span>
                    <span>{suggestion}</span>
                  </motion.li>
                ))}
              </motion.ul>
            )}

            {/* Technical details (collapsible) */}
            {error.details && showDetails && (
              <div className="mt-3">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`flex items-center gap-1 text-sm font-medium ${colors.secondaryButton} rounded px-2 py-1 transition-colors`}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Technical Details
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: animationConfig.duration.fast }}
                      className="mt-2 overflow-hidden"
                    >
                      <pre className="text-xs bg-red-100 rounded p-2 overflow-x-auto">
                        {error.details}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2">
              {error.recoverable && onRetry && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onRetry}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${colors.button} transition-colors`}
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </motion.button>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`flex-shrink-0 ${colors.secondaryButton} rounded p-1 transition-colors`}
              aria-label="Dismiss error"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
