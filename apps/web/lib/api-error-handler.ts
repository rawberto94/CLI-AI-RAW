/**
 * API Error Handler Middleware
 * Provides centralized error handling for API routes with retry logic
 * Includes performance monitoring integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitoringService } from '@/../../packages/data-orchestration/src/services/monitoring.service';
import { performanceMonitor } from '@/lib/performance/performance-monitor';

export interface RequestContext {
  endpoint: string;
  method: string;
  userId?: string;
  requestId: string;
  tenantId?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    requestId: string;
    timestamp: string;
  };
  retry?: {
    allowed: boolean;
    after?: number;
  };
}

/**
 * Custom error classes
 */
export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Determine if an error should be retried
 */
export function shouldRetry(error: Error): boolean {
  // Retry on network errors
  if (error.message.includes('ECONNREFUSED') || 
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ENOTFOUND')) {
    return true;
  }
  
  // Retry on 5xx errors
  if (error.message.match(/\b5\d{2}\b/)) {
    return true;
  }
  
  // Retry on specific errors
  if (error instanceof ConflictError) {
    return true;
  }
  
  // Don't retry client errors
  if (error instanceof ValidationError ||
      error instanceof AuthenticationError ||
      error instanceof AuthorizationError ||
      error instanceof NotFoundError) {
    return false;
  }
  
  return false;
}

/**
 * Get retry delay with exponential backoff
 */
export function getRetryDelay(attemptNumber: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 10000; // 10 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);
  
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  
  return Math.floor(delay + jitter);
}

/**
 * Handle API errors and return appropriate response
 */
export function handleApiError(
  error: Error,
  context: RequestContext
): NextResponse<ErrorResponse> {
  // Log error with context
  monitoringService.logError(error, {
    endpoint: context.endpoint,
    method: context.method,
    userId: context.userId,
    requestId: context.requestId,
    tenantId: context.tenantId,
  });
  
  // Increment error counter
  monitoringService.incrementCounter('api.errors', {
    endpoint: context.endpoint,
    method: context.method,
    errorType: error.name,
  });
  
  const timestamp = new Date().toISOString();
  
  // Handle specific error types
  if (error instanceof ValidationError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.details,
          requestId: context.requestId,
          timestamp,
        },
      },
      { status: 400 }
    );
  }
  
  if (error instanceof AuthenticationError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: error.message,
          requestId: context.requestId,
          timestamp,
        },
      },
      { status: 401 }
    );
  }
  
  if (error instanceof AuthorizationError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'AUTHORIZATION_ERROR',
          message: error.message,
          requestId: context.requestId,
          timestamp,
        },
      },
      { status: 403 }
    );
  }
  
  if (error instanceof NotFoundError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'NOT_FOUND',
          message: error.message,
          requestId: context.requestId,
          timestamp,
        },
      },
      { status: 404 }
    );
  }
  
  if (error instanceof ConflictError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'CONFLICT',
          message: error.message,
          requestId: context.requestId,
          timestamp,
        },
        retry: {
          allowed: true,
          after: 1000,
        },
      },
      { status: 409 }
    );
  }
  
  if (error instanceof RateLimitError) {
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message,
          requestId: context.requestId,
          timestamp,
        },
        retry: {
          allowed: true,
          after: 60000, // 1 minute
        },
      },
      { status: 429 }
    );
  }
  
  // Generic server error (don't expose internal details)
  return NextResponse.json<ErrorResponse>(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: context.requestId,
        timestamp,
      },
    },
    { status: 500 }
  );
}

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandling<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, routeContext?: any): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    
    const context: RequestContext = {
      endpoint: request.nextUrl.pathname,
      method: request.method,
      requestId,
    };
    
    try {
      // Add request ID to headers
      const response = await handler(request, routeContext);
      
      // Record successful request
      const duration = Date.now() - startTime;
      monitoringService.recordTiming('api.request', duration, {
        endpoint: context.endpoint,
        method: context.method,
        status: response.status.toString(),
      });
      
      // Track API performance
      if (typeof window !== 'undefined') {
        performanceMonitor.trackApiCall(
          context.endpoint,
          context.method,
          duration,
          response.status,
          response.headers.get('X-Cache-Hit') === 'true'
        );
      }
      
      // Add headers
      response.headers.set('X-Request-ID', requestId);
      response.headers.set('X-Response-Time', `${duration}ms`);
      
      return response;
    } catch (error) {
      // Record error timing
      const duration = Date.now() - startTime;
      monitoringService.recordTiming('api.request', duration, {
        endpoint: context.endpoint,
        method: context.method,
        status: 'error',
      });
      
      // Handle error
      return handleApiError(
        error instanceof Error ? error : new Error('Unknown error'),
        context
      );
    }
  };
}

/**
 * Retry wrapper for async functions
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  context?: Partial<RequestContext>
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Log retry attempt
      if (context) {
        monitoringService.logWarning(
          `Retry attempt ${attempt}/${maxAttempts}`,
          {
            ...context,
            error: lastError.message,
          }
        );
      }
      
      // Check if we should retry
      if (attempt < maxAttempts && shouldRetry(lastError)) {
        const delay = getRetryDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Max attempts reached or shouldn't retry
      throw lastError;
    }
  }
  
  throw lastError!;
}

/**
 * Generate request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
