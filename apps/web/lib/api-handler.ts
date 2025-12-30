/**
 * Unified API Handler with Validation, CSRF Protection, and Error Handling
 * 
 * This module provides a type-safe, secure wrapper for Next.js API routes
 * with built-in Zod validation, CSRF protection, and standardized responses.
 * 
 * @example
 * // In an API route
 * import { createApiHandler, withValidation } from '@/lib/api-handler';
 * import { z } from 'zod';
 * 
 * const createContractSchema = z.object({
 *   title: z.string().min(1).max(200),
 *   vendorName: z.string().min(1),
 *   value: z.number().positive().optional(),
 * });
 * 
 * export const POST = createApiHandler({
 *   schema: createContractSchema,
 *   requireAuth: true,
 *   csrfProtection: true,
 *   handler: async ({ data, user, tenantId }) => {
 *     const contract = await createContract({ ...data, tenantId });
 *     return { contract };
 *   },
 * });
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { auth } from '@/lib/auth';
import { success, error as apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

// ============================================================================
// Types
// ============================================================================

interface Session {
  user?: {
    id: string;
    email?: string;
    name?: string;
    role?: string;
    tenantId?: string;
  };
}

interface ApiHandlerContext<T = unknown> {
  request: NextRequest;
  params?: Record<string, string>;
  data: T;
  user: Session['user'];
  tenantId: string;
}

interface ApiHandlerOptions<TInput, TOutput> {
  /** Zod schema for request body validation */
  schema?: ZodSchema<TInput>;
  /** Zod schema for query params validation */
  querySchema?: ZodSchema<Record<string, unknown>>;
  /** Require authentication */
  requireAuth?: boolean;
  /** Require CSRF token for state-changing operations */
  csrfProtection?: boolean;
  /** Required user roles */
  roles?: string[];
  /** Rate limit key prefix */
  rateLimitKey?: string;
  /** The actual handler function */
  handler: (context: ApiHandlerContext<TInput>) => Promise<TOutput>;
}

// ============================================================================
// CSRF Token Utilities
// ============================================================================

const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = 'csrf-token';

/**
 * Validate CSRF token from request
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  
  if (!headerToken || !cookieToken) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  if (headerToken.length !== cookieToken.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Validation Error Formatter
// ============================================================================

function formatZodErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    errors[path || 'root'] = issue.message;
  }
  
  return errors;
}

// ============================================================================
// Main API Handler Factory
// ============================================================================

/**
 * Create a type-safe API handler with validation and security
 */
export function createApiHandler<TInput, TOutput>(
  options: ApiHandlerOptions<TInput, TOutput>
) {
  return async (
    request: NextRequest,
    context?: { params?: Record<string, string> }
  ): Promise<NextResponse> => {
    const startTime = Date.now();
    const method = request.method;
    const url = request.url;
    
    try {
      // 1. Authentication check
      if (options.requireAuth !== false) {
        const session = await auth() as Session | null;
        
        if (!session?.user) {
          logger.warn('Unauthorized API request', { url, method });
          return apiError('Unauthorized', 'UNAUTHORIZED', 401);
        }
        
        // Role check
        if (options.roles && options.roles.length > 0) {
          const userRole = session.user.role || 'user';
          if (!options.roles.includes(userRole)) {
            logger.warn('Forbidden - insufficient role', { 
              url, 
              method, 
              userRole, 
              requiredRoles: options.roles 
            });
            return apiError('Forbidden - insufficient permissions', 'FORBIDDEN', 403);
          }
        }
      }
      
      // 2. CSRF protection for state-changing operations
      if (options.csrfProtection && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        // Skip in development for easier testing
        if (process.env.NODE_ENV === 'production') {
          if (!validateCsrfToken(request)) {
            logger.warn('CSRF validation failed', { url, method });
            return apiError('Invalid CSRF token', 'CSRF_INVALID', 403);
          }
        }
      }
      
      // 3. Get session for handler context
      const session = await auth() as Session | null;
      const user = session?.user;
      const tenantId = user?.tenantId || request.headers.get('x-tenant-id') || 'default';
      
      // 4. Parse and validate request body
      let data: TInput = {} as TInput;
      
      if (options.schema && ['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          const body = await request.json();
          const result = options.schema.safeParse(body);
          
          if (!result.success) {
            logger.debug('Validation failed', { 
              url, 
              errors: formatZodErrors(result.error) 
            });
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Request validation failed',
                  details: formatZodErrors(result.error),
                },
              },
              { status: 400 }
            );
          }
          
          data = result.data;
        } catch (parseError) {
          return apiError('Invalid JSON in request body', 'INVALID_JSON', 400);
        }
      }
      
      // 5. Validate query parameters if schema provided
      if (options.querySchema) {
        const queryParams: Record<string, unknown> = {};
        request.nextUrl.searchParams.forEach((value, key) => {
          // Try to parse numbers and booleans
          if (value === 'true') queryParams[key] = true;
          else if (value === 'false') queryParams[key] = false;
          else if (!isNaN(Number(value)) && value !== '') queryParams[key] = Number(value);
          else queryParams[key] = value;
        });
        
        const result = options.querySchema.safeParse(queryParams);
        if (!result.success) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'QUERY_VALIDATION_ERROR',
                message: 'Query parameter validation failed',
                details: formatZodErrors(result.error),
              },
            },
            { status: 400 }
          );
        }
      }
      
      // 6. Execute the handler
      const result = await options.handler({
        request,
        params: context?.params,
        data,
        user,
        tenantId,
      });
      
      // 7. Log successful request
      const duration = Date.now() - startTime;
      logger.debug('API request completed', { url, method, duration });
      
      // 8. Return success response
      return success(result);
      
    } catch (err) {
      const duration = Date.now() - startTime;
      
      // Handle known error types
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: formatZodErrors(err),
            },
          },
          { status: 400 }
        );
      }
      
      // Log unexpected errors
      logger.error('API handler error', {
        url,
        method,
        duration,
        error: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      });
      
      // Return generic error to client
      return apiError(
        process.env.NODE_ENV === 'development' && err instanceof Error
          ? err.message
          : 'An unexpected error occurred',
        'INTERNAL_ERROR',
        500
      );
    }
  };
}

// ============================================================================
// Simple Handler Wrappers
// ============================================================================

/**
 * Quick wrapper for authenticated handlers without validation
 */
export function withAuth<T>(
  handler: (context: ApiHandlerContext<unknown>) => Promise<T>
) {
  return createApiHandler({
    requireAuth: true,
    handler,
  });
}

/**
 * Quick wrapper for public handlers (no auth required)
 */
export function publicHandler<T>(
  handler: (context: ApiHandlerContext<unknown>) => Promise<T>
) {
  return createApiHandler({
    requireAuth: false,
    handler,
  });
}

/**
 * Quick wrapper for admin-only handlers
 */
export function adminOnly<T>(
  handler: (context: ApiHandlerContext<unknown>) => Promise<T>
) {
  return createApiHandler({
    requireAuth: true,
    roles: ['admin', 'superadmin'],
    handler,
  });
}

// ============================================================================
// Common Schemas
// ============================================================================

import { z } from 'zod';

/** Common pagination query params */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/** Common ID param */
export const idParamSchema = z.object({
  id: z.string().min(1),
});

/** Common search query */
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500).optional(),
  ...paginationSchema.shape,
});

/** Contract creation schema */
export const createContractSchema = z.object({
  title: z.string().min(1).max(500),
  vendorName: z.string().min(1).max(200).optional(),
  value: z.number().positive().optional(),
  currency: z.string().length(3).default('USD'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'EXPIRED', 'TERMINATED']).default('DRAFT'),
  type: z.string().optional(),
  department: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/** Contract update schema (all fields optional) */
export const updateContractSchema = createContractSchema.partial();

/** Rate card creation schema */
export const createRateCardSchema = z.object({
  name: z.string().min(1).max(200),
  contractId: z.string().min(1),
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  rates: z.array(z.object({
    role: z.string().min(1),
    level: z.string().optional(),
    location: z.string().optional(),
    hourlyRate: z.number().positive(),
    currency: z.string().length(3).default('USD'),
  })).min(1),
});

/** File upload metadata schema */
export const uploadMetadataSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  fileSize: z.number().int().positive().max(50 * 1024 * 1024), // 50MB max
  contractId: z.string().optional(),
});

/** AI chat message schema */
export const chatMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  contractId: z.string().optional(),
  context: z.enum(['global', 'contracts', 'analytics', 'rate-cards', 'templates']).default('global'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(50).optional(),
});

// Export type helpers
export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type CreateRateCardInput = z.infer<typeof createRateCardSchema>;
export type UploadMetadataInput = z.infer<typeof uploadMetadataSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
