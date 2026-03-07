/**
 * Centralized API Error Handling
 * Consistent error responses across all API routes
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';

// ============ Error Classes ============

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: Record<string, unknown>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(
    message: string,
    public errors: Array<{ field: string; message: string }>
  ) {
    super(message, 400, 'VALIDATION_ERROR', { errors });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with ID "${id}" not found` : `${resource} not found`,
      404,
      'NOT_FOUND',
      { resource, id }
    );
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 409, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter }, true);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(service: string) {
    super(`${service} is temporarily unavailable`, 503, 'SERVICE_UNAVAILABLE', { service }, true);
    this.name = 'ServiceUnavailableError';
  }
}

export class ExternalServiceError extends ApiError {
  constructor(service: string, originalError?: string) {
    super(
      `External service error: ${service}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      { service, originalError },
      true
    );
    this.name = 'ExternalServiceError';
  }
}

// ============ Error Response Builder ============

interface ErrorResponseBody {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
    retryable?: boolean;
    retryAfter?: number;
  };
  timestamp: string;
  requestId?: string;
}

export function buildErrorResponse(
  error: ApiError | Error | unknown,
  requestId?: string
): NextResponse<ErrorResponseBody> {
  const timestamp = new Date().toISOString();

  // Handle ApiError instances
  if (error instanceof ApiError) {
    const body: ErrorResponseBody = {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
        retryable: error.retryable,
      },
      timestamp,
      requestId,
    };

    if (error instanceof RateLimitError && error.details?.retryAfter) {
      body.error.retryAfter = error.details.retryAfter as number;
    }

    return NextResponse.json(body, { status: error.statusCode });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationErrors = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    const body: ErrorResponseBody = {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: { errors: validationErrors },
      },
      timestamp,
      requestId,
    };

    return NextResponse.json(body, { status: 400 });
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; message?: string; meta?: unknown };
    
    if (prismaError.code === 'P2025') {
      const body: ErrorResponseBody = {
        success: false,
        error: {
          message: 'Record not found',
          code: 'NOT_FOUND',
        },
        timestamp,
        requestId,
      };
      return NextResponse.json(body, { status: 404 });
    }

    if (prismaError.code === 'P2002') {
      const body: ErrorResponseBody = {
        success: false,
        error: {
          message: 'A record with this value already exists',
          code: 'CONFLICT',
          details: { meta: prismaError.meta },
        },
        timestamp,
        requestId,
      };
      return NextResponse.json(body, { status: 409 });
    }
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : 'An unexpected error occurred';
  
  // Log unexpected errors
  logger.error('Unexpected API error', {
    error: error instanceof Error ? error.stack : String(error),
    requestId,
  });

  const body: ErrorResponseBody = {
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      code: 'INTERNAL_ERROR',
    },
    timestamp,
    requestId,
  };

  return NextResponse.json(body, { status: 500 });
}

// ============ Error Handler Wrapper ============

type ApiHandler = (
  request: Request,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Wraps an API handler with consistent error handling
 */
export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (request, context) => {
    const requestId = request.headers.get('x-request-id') || 
                      `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    
    try {
      const response = await handler(request, context);
      
      // Add request ID to successful responses
      response.headers.set('x-request-id', requestId);
      
      return response;
    } catch (error) {
      return buildErrorResponse(error, requestId);
    }
  };
}

// ============ Validation Helpers ============

/**
 * Validates required fields and throws ValidationError if missing
 */
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[]
): void {
  const missing = fields.filter(
    (field) => data[field] === undefined || data[field] === null || data[field] === ''
  );

  if (missing.length > 0) {
    throw new ValidationError('Missing required fields', 
      missing.map((field) => ({ field, message: `${field} is required` }))
    );
  }
}

/**
 * Validates a UUID format
 */
export function validateUUID(value: string, fieldName: string = 'id'): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    throw new ValidationError(`Invalid ${fieldName} format`, [
      { field: fieldName, message: 'Must be a valid UUID' },
    ]);
  }
}

/**
 * Validates pagination parameters
 */
export function validatePagination(
  page?: string | number | null,
  limit?: string | number | null
): { page: number; limit: number } {
  const parsedPage = Math.max(1, parseInt(String(page || 1), 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit || 20), 10) || 20));
  
  return { page: parsedPage, limit: parsedLimit };
}

// ============ Success Response Builder ============

interface SuccessResponseOptions {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Builds a consistent success response
 */
export function buildSuccessResponse<T>(
  data: T,
  options: SuccessResponseOptions = {}
): NextResponse {
  const { status = 200, headers = {} } = options;
  
  const body = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Builds a paginated success response
 */
export function buildPaginatedResponse<T>(
  items: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
  },
  options: SuccessResponseOptions = {}
): NextResponse {
  const { page, limit, total } = pagination;
  const totalPages = Math.ceil(total / limit);
  
  const body = {
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: options.status || 200,
    headers: options.headers,
  });
}
