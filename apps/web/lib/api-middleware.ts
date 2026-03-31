/**
 * API Middleware Utilities
 * 
 * Provides standardized request validation, error handling, and response formatting
 * for all API routes. Defense-in-depth: supplements edge middleware auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiContext {
  requestId: string;
  tenantId: string;
  startTime: number;
  dataMode: 'real' | 'mock';
}

export interface AuthenticatedApiContext extends ApiContext {
  userId: string;
  userRole?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
    field?: string;
    retryable: boolean;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    responseTime: string;
    cached: boolean;
    dataSource: string;
  };
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const sortSchema = z.object({
  sortBy: z.enum([
    'createdAt', 'updatedAt', 'uploadedAt', 'totalValue',
    'expirationDate', 'effectiveDate', 'contractTitle',
    'clientName', 'supplierName', 'viewCount', 'lastViewedAt'
  ]).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const contractFilterSchema = z.object({
  search: z.string().optional(),
  status: z.array(z.string()).or(z.string().transform(s => [s])).optional(),
  contractType: z.array(z.string()).or(z.string().transform(s => [s])).optional(),
  category: z.array(z.string()).or(z.string().transform(s => [s])).optional(),
  clientName: z.array(z.string()).or(z.string().transform(s => [s])).optional(),
  supplierName: z.array(z.string()).or(z.string().transform(s => [s])).optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  expiringBefore: z.string().datetime().optional(),
  expiringAfter: z.string().datetime().optional(),
  uploadedAfter: z.string().datetime().optional(),
  uploadedBefore: z.string().datetime().optional(),
});

export const contractQuerySchema = paginationSchema
  .merge(sortSchema)
  .merge(contractFilterSchema);

export type ContractQueryParams = z.infer<typeof contractQuerySchema>;

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Extract and validate API context from request
 */
export function getApiContext(request: NextRequest): ApiContext {
  const tenantId = request.headers.get('x-tenant-id');
  if (!tenantId && process.env.NODE_ENV === 'production') {
    throw new Error('Tenant ID required. Provide x-tenant-id header.');
  }
  return {
    requestId: request.headers.get('x-request-id') || nanoid(),
    tenantId: tenantId || 'demo', // Only used in development
    startTime: Date.now(),
    dataMode: (request.headers.get('x-data-mode') || 'real') as 'real' | 'mock',
  };
}

/**
 * Extract API context for PUBLIC routes (signup, forgot-password, etc.)
 * Does NOT require tenant ID - these routes are unauthenticated by design.
 */
export function getPublicApiContext(request: NextRequest): ApiContext {
  return {
    requestId: request.headers.get('x-request-id') || nanoid(),
    tenantId: request.headers.get('x-tenant-id') || 'public',
    startTime: Date.now(),
    dataMode: (request.headers.get('x-data-mode') || 'real') as 'real' | 'mock',
  };
}

/**
 * Extract authenticated API context (defense-in-depth).
 * Reads user identity from middleware-injected headers.
 * Returns null if no user identity present.
 */
export function getAuthenticatedApiContext(request: NextRequest): AuthenticatedApiContext | null {
  const userId = request.headers.get('x-user-id');
  const tenantId = request.headers.get('x-tenant-id');

  if (!userId) {
    console.log(`[API-DIAG] getAuthenticatedApiContext: no userId header, path=${request.nextUrl?.pathname}`);
    return null;
  }

  // In production, require explicit tenant
  if (!tenantId && process.env.NODE_ENV === 'production') {
    console.error(`[API-DIAG] Missing tenantId for user=${userId}, path=${request.nextUrl?.pathname}`);
    // Return null instead of throwing to avoid unhandled errors
    // The handler will return a 401 which is clearer than a 500
    return null;
  }
  return {
    requestId: request.headers.get('x-request-id') || nanoid(),
    tenantId: tenantId || 'demo', // Only used in development
    userId,
    userRole: request.headers.get('x-user-role') || undefined,
    startTime: Date.now(),
    dataMode: (request.headers.get('x-data-mode') || 'real') as 'real' | 'mock',
  };
}

/**
 * Parse and validate query parameters
 */
export function parseQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; error: ZodError } {
  const { searchParams } = new URL(request.url);
  const params: Record<string, unknown> = {};

  // Convert URLSearchParams to object, handling arrays
  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing !== undefined) {
      params[key] = Array.isArray(existing) 
        ? [...existing, value] 
        : [existing, value];
    } else {
      params[key] = value;
    }
  });

  const result = schema.safeParse(params);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  context: ApiContext,
  code: string,
  message: string,
  status: number,
  options?: {
    details?: string;
    field?: string;
    retryable?: boolean;
    retryAfter?: number;
  }
): NextResponse<ApiErrorResponse> {
  const headers: Record<string, string> = {
    'X-Request-ID': context.requestId,
    'X-Response-Time': `${Date.now() - context.startTime}ms`,
  };

  if (options?.retryAfter) {
    headers['Retry-After'] = options.retryAfter.toString();
  }

  return NextResponse.json(
    {
      success: false as const,
      error: {
        code,
        message,
        details: options?.details,
        field: options?.field,
        retryable: options?.retryable ?? isRetryableStatus(status),
      },
      meta: {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
      },
    },
    { status, headers }
  );
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  context: ApiContext,
  data: T,
  options?: {
    status?: number;
    cached?: boolean;
    dataSource?: string;
    headers?: Record<string, string>;
  }
): NextResponse<ApiSuccessResponse<T>> {
  const responseTime = Date.now() - context.startTime;

  return NextResponse.json(
    {
      success: true as const,
      data,
      meta: {
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        cached: options?.cached ?? false,
        dataSource: options?.dataSource ?? 'database',
      },
    },
    {
      status: options?.status ?? 200,
      headers: {
        'X-Request-ID': context.requestId,
        'X-Response-Time': `${responseTime}ms`,
        'X-Data-Source': options?.dataSource ?? 'database',
        ...options?.headers,
      },
    }
  );
}

/**
 * Create validation error response from Zod error
 */
export function createValidationErrorResponse(
  context: ApiContext,
  error: ZodError
): NextResponse<ApiErrorResponse> {
  const firstError = error.errors[0];
  return createErrorResponse(
    context,
    'VALIDATION_ERROR',
    firstError?.message || 'Invalid request parameters',
    400,
    {
      field: firstError?.path.join('.'),
      details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      retryable: false,
    }
  );
}

/**
 * Handle common API errors
 */
export function handleApiError(
  context: ApiContext,
  error: unknown
): NextResponse<ApiErrorResponse> {
  if (error instanceof ZodError) {
    return createValidationErrorResponse(context, error);
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  
  // Determine error type
  let code = 'INTERNAL_ERROR';
  let status = 500;
  let retryable = true;

  if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
    code = 'RATE_LIMITED';
    status = 429;
  } else if (errorMessage.includes('not found') || errorMessage.includes('Not found')) {
    code = 'NOT_FOUND';
    status = 404;
    retryable = false;
  } else if (errorMessage.includes('unauthorized') || errorMessage.includes('Unauthorized')) {
    code = 'UNAUTHORIZED';
    status = 401;
    retryable = false;
  } else if (errorMessage.includes('forbidden') || errorMessage.includes('Forbidden')) {
    code = 'FORBIDDEN';
    status = 403;
    retryable = false;
  } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    code = 'TIMEOUT';
    status = 504;
  } else if (errorMessage.includes('connection') || errorMessage.includes('Connection')) {
    code = 'CONNECTION_ERROR';
    status = 503;
  } else if (errorMessage.includes('database') || errorMessage.includes('prisma')) {
    code = 'DATABASE_ERROR';
    status = 500;
  }

  return createErrorResponse(context, code, 'An error occurred', status, {
    details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    retryable,
  });
}

/**
 * Wrapper for API route handlers with standardized error handling.
 * Forwards Next.js route context (params) for dynamic routes.
 */
export function withApiHandler(
  handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    try {
      const context = getApiContext(request);

      // Merge Next.js route params into context for dynamic routes
      const mergedContext = routeContext?.params
        ? Object.assign(context, { params: routeContext.params })
        : context;

      return await handler(request, mergedContext);
    } catch (error) {
      return handleApiError(getPublicApiContext(request), error);
    }
  };
}

/**
 * Wrapper for PUBLIC API route handlers.
 * Uses a non-tenant-bound context so health checks and other unauthenticated
 * infrastructure endpoints can run in production without x-tenant-id.
 */
export function withPublicApiHandler(
  handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const context = getPublicApiContext(request);

    // Merge Next.js route params into context for dynamic routes
    const mergedContext = routeContext?.params
      ? Object.assign(context, { params: routeContext.params })
      : context;

    try {
      return await handler(request, mergedContext);
    } catch (error) {
      return handleApiError(context, error);
    }
  };
}

/**
 * Wrapper for authenticated API route handlers.
 * Combines defense-in-depth auth check + structured error handling + response formatting.
 * Uses middleware-injected headers (x-user-id, x-tenant-id) for identity.
 * Forwards Next.js route context (params) for dynamic routes.
 */
export function withAuthApiHandler(
  handler: (request: NextRequest, context: AuthenticatedApiContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const context = getAuthenticatedApiContext(request);

    if (!context) {
      const fallback = getApiContext(request);
      return createErrorResponse(fallback, 'UNAUTHORIZED', 'Authentication required', 401, {
        retryable: false,
      });
    }

    // Merge Next.js route params into context for dynamic routes
    const mergedContext = routeContext?.params
      ? Object.assign(context, { params: routeContext.params })
      : context;

    try {
      return await handler(request, mergedContext);
    } catch (error) {
      return handleApiError(context, error);
    }
  };
}

/**
 * Wrapper for cron/internal route handlers.
 * Validates CRON_SECRET or INTERNAL_API_SECRET from Authorization header.
 */
export function withCronHandler(
  handler: (request: NextRequest, context: ApiContext) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const context = getApiContext(request);
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

    if (!cronSecret) {
      return createErrorResponse(context, 'CONFIG_ERROR', 'Cron secret not configured', 500);
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return createErrorResponse(context, 'UNAUTHORIZED', 'Invalid cron secret', 401, {
        retryable: false,
      });
    }

    try {
      return await handler(request, context);
    } catch (error) {
      return handleApiError(context, error);
    }
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/**
 * Valid contract statuses
 */
export const VALID_CONTRACT_STATUSES = [
  'UPLOADED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'ARCHIVED',
  'ACTIVE',
  'PENDING',
  'DRAFT',
  'EXPIRED',
  'CANCELLED',
] as const;

export type ContractStatus = typeof VALID_CONTRACT_STATUSES[number];

/**
 * Map internal status to API status
 */
export function mapContractStatus(status: string): string {
  const statusMap: Record<string, string> = {
    COMPLETED: 'completed',
    PROCESSING: 'processing',
    FAILED: 'failed',
    UPLOADED: 'pending',
    PENDING: 'pending',
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    DRAFT: 'draft',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
  };
  return statusMap[status] || 'processing';
}
