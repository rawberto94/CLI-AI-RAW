/**
 * useApiCall Hook
 * Provides API call functionality with automatic retry logic and error handling
 * Includes performance monitoring integration
 */

'use client';

import { useState, useCallback } from 'react';
import { useToast } from './useToast';
import { performanceMonitor } from '@/lib/performance/performance-monitor';

interface UseApiCallOptions {
  maxRetries?: number;
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  successMessage?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

interface ApiCallState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  retryCount: number;
}

/**
 * Determine if an error should be retried
 */
function shouldRetry(error: Error, retryCount: number, maxRetries: number): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Retry on network errors
  if (message.includes('network') || message.includes('fetch failed')) {
    return true;
  }

  // Retry on timeout errors
  if (message.includes('timeout')) {
    return true;
  }

  // Retry on 5xx errors
  if (message.match(/\b5\d{2}\b/)) {
    return true;
  }

  // Retry on 409 Conflict
  if (message.includes('409') || message.includes('conflict')) {
    return true;
  }

  // Don't retry on client errors (4xx except 409)
  if (message.match(/\b4\d{2}\b/) && !message.includes('409')) {
    return false;
  }

  return false;
}

/**
 * Get retry delay with exponential backoff
 */
function getRetryDelay(retryCount: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 10000; // 10 seconds
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(delay + jitter);
}

/**
 * Hook for making API calls with retry logic
 */
export function useApiCall<T = any>(options: UseApiCallOptions = {}) {
  const {
    maxRetries = 3,
    showErrorToast = true,
    showSuccessToast = false,
    successMessage,
    onSuccess,
    onError,
  } = options;

  const toast = useToast();
  const [state, setState] = useState<ApiCallState<T>>({
    data: null,
    error: null,
    loading: false,
    retryCount: 0,
  });

  const execute = useCallback(
    async (apiFunction: () => Promise<T>): Promise<T | null> => {
      setState({
        data: null,
        error: null,
        loading: true,
        retryCount: 0,
      });

      let currentRetry = 0;

      while (currentRetry <= maxRetries) {
        const startTime = performance.now();
        
        try {
          const result = await apiFunction();
          const duration = performance.now() - startTime;

          // Track API performance (will be captured by fetch interceptor)
          // This is a fallback for non-fetch API calls
          if (typeof window !== 'undefined') {
            performanceMonitor.trackApiCall(
              'client-api-call',
              'UNKNOWN',
              duration,
              200,
              false
            );
          }

          setState({
            data: result,
            error: null,
            loading: false,
            retryCount: currentRetry,
          });

          if (showSuccessToast && successMessage) {
            toast.success(successMessage);
          }

          if (onSuccess) {
            onSuccess(result);
          }

          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Unknown error');

          // Check if we should retry
          if (shouldRetry(error, currentRetry, maxRetries)) {
            currentRetry++;
            setState(prev => ({
              ...prev,
              retryCount: currentRetry,
            }));

            // Wait before retry
            const delay = getRetryDelay(currentRetry);
            await new Promise(resolve => setTimeout(resolve, delay));

            continue;
          }

          // Max retries reached or shouldn't retry
          setState({
            data: null,
            error,
            loading: false,
            retryCount: currentRetry,
          });

          if (showErrorToast) {
            toast.error(getUserFriendlyMessage(error));
          }

          if (onError) {
            onError(error);
          }

          return null;
        }
      }

      return null;
    },
    [maxRetries, showErrorToast, showSuccessToast, successMessage, onSuccess, onError, toast]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      loading: false,
      retryCount: 0,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: Error): string {
  const message = error.message.toLowerCase();

  // Network errors
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Timeout errors
  if (message.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Authentication errors
  if (message.includes('401') || message.includes('unauthorized')) {
    return 'Your session has expired. Please log in again.';
  }

  // Permission errors
  if (message.includes('403') || message.includes('forbidden')) {
    return "You don't have permission to perform this action.";
  }

  // Not found errors
  if (message.includes('404') || message.includes('not found')) {
    return 'The requested resource was not found.';
  }

  // Conflict errors
  if (message.includes('409') || message.includes('conflict')) {
    return 'This resource was modified by another user. Please refresh and try again.';
  }

  // Rate limit errors
  if (message.includes('429') || message.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Server errors
  if (message.includes('500') || message.includes('internal server')) {
    return 'Server error. Our team has been notified.';
  }

  // Default message
  return error.message || 'An unexpected error occurred. Please try again.';
}
