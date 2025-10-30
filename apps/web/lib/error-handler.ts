/**
 * Error Handler Utility
 * Provides centralized error handling with user-friendly messages and Sentry integration
 */

import * as Sentry from '@sentry/nextjs';

export interface ErrorContext {
  userId?: string;
  action?: string;
  component?: string;
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  message: string;
  userMessage: string;
  code?: string;
  statusCode?: number;
}

/**
 * Maps error types to user-friendly messages
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
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

    // Server errors
    if (message.includes('500') || message.includes('internal server')) {
      return 'Server error. Our team has been notified.';
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return error.message; // Return the actual validation message
    }

    // File upload errors
    if (message.includes('file') && message.includes('size')) {
      return 'File is too large. Please upload a smaller file.';
    }

    if (message.includes('file') && message.includes('type')) {
      return 'Invalid file type. Please upload a supported file format.';
    }
  }

  // Default message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Logs error to Sentry with context
 */
export function logErrorToSentry(
  error: unknown,
  context?: ErrorContext
): string {
  const eventId = Sentry.captureException(error, {
    level: 'error',
    tags: {
      component: context?.component,
      action: context?.action,
    },
    user: context?.userId
      ? {
          id: context.userId,
        }
      : undefined,
    extra: context?.metadata,
  });

  return eventId;
}

/**
 * Main error handler function
 * Logs to Sentry and returns user-friendly message
 */
export function handleError(
  error: unknown,
  context?: ErrorContext
): ErrorResponse {
  // Log to Sentry
  const eventId = logErrorToSentry(error, context);

  // Get user-friendly message
  const userMessage = getUserFriendlyMessage(error);

  // Extract error details
  let message = 'Unknown error';
  let code: string | undefined;
  let statusCode: number | undefined;

  if (error instanceof Error) {
    message = error.message;
    
    // Try to extract status code from error message
    const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
    if (statusMatch) {
      statusCode = parseInt(statusMatch[1], 10);
    }
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Handler]', {
      error,
      context,
      eventId,
      userMessage,
    });
  }

  return {
    message,
    userMessage,
    code,
    statusCode,
  };
}

/**
 * Handles API response errors
 */
export async function handleApiError(response: Response): Promise<never> {
  let errorMessage = `HTTP ${response.status}`;

  try {
    const data = await response.json();
    errorMessage = data.error || data.message || errorMessage;
  } catch {
    // If response is not JSON, use status text
    errorMessage = response.statusText || errorMessage;
  }

  throw new Error(errorMessage);
}

/**
 * Wraps an async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: Omit<ErrorContext, 'metadata'>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, {
        ...context,
        metadata: { args },
      });
      throw error;
    }
  }) as T;
}

/**
 * Error classes for specific error types
 */
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends Error {
  constructor(message: string = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class PermissionError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'PermissionError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}
