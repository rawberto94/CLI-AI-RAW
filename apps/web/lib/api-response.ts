/**
 * API Response Utilities
 * Standardized response handling for API routes
 */

import { NextResponse } from 'next/server';
import type { AppError } from './result';
import { ERROR_CODES } from './constants';

// ============================================================================
// Response Types
// ============================================================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ResponseMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
  timestamp?: string;
}

export interface PaginatedData<T> {
  items: T[];
  meta: Required<Pick<ResponseMeta, 'page' | 'pageSize' | 'total' | 'totalPages' | 'hasMore'>>;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// --------------------------------------------------------------------------
// Back-compat aliases (used by '@/lib' barrel exports)
// --------------------------------------------------------------------------

export const successResponse = success;
export const errorResponse = error;

export function validationError(message = 'Validation failed', details?: Record<string, unknown>) {
  return error(ERROR_CODES.VALIDATION_ERROR, message, 422, details);
}

export function notFoundError(resource = 'Resource') {
  return errors.notFound(resource);
}

export function unauthorizedError(message = 'Authentication required') {
  return errors.unauthorized(message);
}

export function forbiddenError(message = 'Access denied') {
  return errors.forbidden(message);
}

export function serverError(message = 'An unexpected error occurred', details?: Record<string, unknown>) {
  return error(ERROR_CODES.INTERNAL_ERROR, message, 500, details);
}

export function handleApiError(err: unknown, message = 'An unexpected error occurred') {
  const resolved = err ? getErrorMessage(err) : message;
  return errors.internal(resolved);
}

// ============================================================================
// Success Responses
// ============================================================================

/**
 * Create a success response
 */
export function success<T>(data: T, meta?: ResponseMeta, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      meta: meta ? { ...meta, timestamp: new Date().toISOString() } : undefined,
    },
    { status }
  );
}

/**
 * Create a paginated response
 */
export function paginated<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number
): NextResponse<ApiSuccessResponse<PaginatedData<T>>> {
  const totalPages = Math.ceil(total / pageSize);
  
  return success({
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  });
}

/**
 * Create an empty success response (204)
 */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Create a created response (201)
 */
export function created<T>(data: T, location?: string): NextResponse<ApiSuccessResponse<T>> {
  const response = success(data, undefined, 201);
  if (location) {
    response.headers.set('Location', location);
  }
  return response;
}

// ============================================================================
// Error Responses
// ============================================================================

/**
 * Create an error response
 */
export function error(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false as const,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

/**
 * Create an error response from AppError
 */
export function fromAppError(appError: AppError, status = 500): NextResponse<ApiErrorResponse> {
  return error(
    appError.code,
    appError.userMessage || appError.message,
    status,
    appError.details
  );
}

// Common error responses
export const errors = {
  badRequest: (message = 'Bad request', details?: Record<string, unknown>) =>
    error(ERROR_CODES.INVALID_INPUT, message, 400, details),

  unauthorized: (message = 'Authentication required') =>
    error(ERROR_CODES.AUTH_REQUIRED, message, 401),

  forbidden: (message = 'Access denied') =>
    error(ERROR_CODES.FORBIDDEN, message, 403),

  notFound: (resource = 'Resource') =>
    error(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404),

  conflict: (message = 'Resource already exists') =>
    error(ERROR_CODES.CONFLICT, message, 409),

  validation: (field: string, message: string) =>
    error(ERROR_CODES.VALIDATION_ERROR, message, 422, { field }),

  validationMultiple: (errors: Array<{ field: string; message: string }>) =>
    error(ERROR_CODES.VALIDATION_ERROR, 'Validation failed', 422, { errors }),

  tooLarge: (maxSize?: string) =>
    error(ERROR_CODES.FILE_TOO_LARGE, `File is too large${maxSize ? `. Maximum size is ${maxSize}` : ''}`, 413),

  rateLimited: (retryAfter?: number) => {
    const response = error(ERROR_CODES.RATE_LIMITED, 'Too many requests. Please try again later.', 429);
    if (retryAfter) {
      response.headers.set('Retry-After', String(retryAfter));
    }
    return response;
  },

  internal: (message = 'An unexpected error occurred') =>
    error(ERROR_CODES.INTERNAL_ERROR, message, 500),

  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    error(ERROR_CODES.SERVICE_UNAVAILABLE, message, 503),
};

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Extract error message from various error types
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'An unexpected error occurred';
}

/**
 * Wrap an async handler with error handling
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ApiErrorResponse>> {
  return handler().catch((err) => {
    console.error('[API Error]', err);
    return errors.internal(getErrorMessage(err));
  });
}

/**
 * Parse and validate request body
 */
export async function parseBody<T>(
  request: Request,
  schema?: (data: unknown) => { success: boolean; data?: T; error?: string }
): Promise<{ success: true; data: T } | { success: false; response: NextResponse<ApiErrorResponse> }> {
  try {
    const body = await request.json();
    
    if (schema) {
      const result = schema(body);
      if (!result.success) {
        return {
          success: false,
          response: errors.badRequest(result.error || 'Invalid request body'),
        };
      }
      return { success: true, data: result.data as T };
    }
    
    return { success: true, data: body as T };
  } catch {
    return {
      success: false,
      response: errors.badRequest('Invalid JSON body'),
    };
  }
}

/**
 * Parse query parameters with defaults
 */
export function parseQuery(
  searchParams: URLSearchParams,
  defaults: Record<string, string | number | boolean> = {}
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = { ...defaults };
  
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const value = searchParams.get(key);
    if (value !== null) {
      if (typeof defaultValue === 'number') {
        const parsed = Number(value);
        result[key] = isNaN(parsed) ? defaultValue : parsed;
      } else if (typeof defaultValue === 'boolean') {
        result[key] = value === 'true' || value === '1';
      } else {
        result[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * Add CORS headers to response
 */
export function withCors<T>(response: NextResponse<T>, origin = '*'): NextResponse<T> {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

/**
 * Add cache headers to response
 */
export function withCache<T>(
  response: NextResponse<T>,
  maxAge: number,
  options: { private?: boolean; staleWhileRevalidate?: number } = {}
): NextResponse<T> {
  const directives = [
    options.private ? 'private' : 'public',
    `max-age=${maxAge}`,
  ];
  
  if (options.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  
  response.headers.set('Cache-Control', directives.join(', '));
  return response;
}
