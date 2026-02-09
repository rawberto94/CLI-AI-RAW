/**
 * useErrorHandler Hook
 * Provides error handling with toast notifications and Sentry logging
 */

'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { handleError, type ErrorContext } from '@/lib/error-handler';

export interface UseErrorHandlerOptions {
  showToast?: boolean;
  logToSentry?: boolean;
  onError?: (error: unknown) => void;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    showToast = true,
    logToSentry = true,
    onError,
  } = options;

  const handleErrorWithToast = useCallback(
    (error: unknown, context?: ErrorContext) => {
      // Handle the error (logs to Sentry and gets user-friendly message)
      const errorResponse = handleError(error, context);

      // Show toast notification if enabled
      if (showToast) {
        toast.error(errorResponse.userMessage, {
          duration: 6000,
        });
      }

      // Call custom error handler if provided
      if (onError) {
        onError(error);
      }

      return errorResponse;
    },
    [showToast, onError]
  );

  return {
    handleError: handleErrorWithToast,
  };
}
