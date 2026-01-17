/**
 * Comprehensive Security Middleware
 * 
 * Combines all security features:
 * - Input validation
 * - Data sanitization
 * - Rate limiting
 * - Security headers
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { applyRateLimit, EndpointRateLimits } from './rate-limit.middleware';
import { applySecurityHeaders } from './security-headers.middleware';
import { sanitizeRequestBody, sanitizeQueryParams } from './sanitization.middleware';
import { validateRequest, ValidationException } from '../validation/server-validation';

// =========================================================================
// TYPES
// =========================================================================

export interface SecurityOptions {
  rateLimit?: typeof EndpointRateLimits[keyof typeof EndpointRateLimits] | false;
  validation?: {
    bodySchema?: ZodSchema;
    querySchema?: ZodSchema;
  };
  sanitization?: {
    sanitizeBody?: boolean;
    sanitizeQuery?: boolean;
    maxLength?: number;
  };
  securityHeaders?: boolean;
}

export interface SecureRequestData {
  body?: any;
  query?: Record<string, string>;
  validated?: {
    body?: any;
    query?: any;
  };
}

// =========================================================================
// COMPREHENSIVE SECURITY MIDDLEWARE
// =========================================================================

/**
 * Apply all security measures to a request
 */
export async function applySecurityMiddleware(
  request: NextRequest,
  options: SecurityOptions = {}
): Promise<{
  success: boolean;
  data?: SecureRequestData;
  response?: NextResponse;
}> {
  try {
    // 1. Rate Limiting
    if (options.rateLimit !== false) {
      const rateLimitConfig = options.rateLimit || EndpointRateLimits.public;
      const rateLimitResponse = await applyRateLimit(request, rateLimitConfig);

      if (rateLimitResponse) {
        return {
          success: false,
          response: rateLimitResponse,
        };
      }
    }

    // 2. Data Sanitization
    const data: SecureRequestData = {};

    if (options.sanitization?.sanitizeBody !== false) {
      data.body = await sanitizeRequestBody(request, {
        maxLength: options.sanitization?.maxLength,
      });
    }

    if (options.sanitization?.sanitizeQuery !== false) {
      data.query = sanitizeQueryParams(request, {
        maxLength: options.sanitization?.maxLength,
      });
    }

    // 3. Input Validation
    if (options.validation) {
      data.validated = {};

      if (options.validation.bodySchema && data.body) {
        try {
          data.validated.body = await validateRequest(
            request,
            options.validation.bodySchema,
            'body'
          );
        } catch (error) {
          if (error instanceof ValidationException) {
            return {
              success: false,
              response: NextResponse.json(
                {
                  error: 'VALIDATION_ERROR',
                  message: 'Request validation failed',
                  details: error.errors,
                },
                { status: 400 }
              ),
            };
          }
          throw error;
        }
      }

      if (options.validation.querySchema) {
        try {
          data.validated.query = await validateRequest(
            request,
            options.validation.querySchema,
            'query'
          );
        } catch (error) {
          if (error instanceof ValidationException) {
            return {
              success: false,
              response: NextResponse.json(
                {
                  error: 'VALIDATION_ERROR',
                  message: 'Query validation failed',
                  details: error.errors,
                },
                { status: 400 }
              ),
            };
          }
          throw error;
        }
      }
    }

    return {
      success: true,
      data,
    };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'SECURITY_ERROR',
          message: 'Security validation failed',
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Create a secure response with all security features
 */
export function createSecureResponse(
  body: any,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(body, init);
  return applySecurityHeaders(response);
}

// =========================================================================
// SECURITY MIDDLEWARE FACTORY
// =========================================================================

/**
 * Create a security middleware function
 */
export function createSecurityMiddleware(options: SecurityOptions = {}) {
  return async (
    request: NextRequest
  ): Promise<{
    success: boolean;
    data?: SecureRequestData;
    response?: NextResponse;
  }> => {
    return await applySecurityMiddleware(request, options);
  };
}

// =========================================================================
// ROUTE HANDLER WRAPPER
// =========================================================================

/**
 * Wrap a route handler with security middleware
 */
export function withSecurity<T = any>(
  handler: (request: NextRequest, data: SecureRequestData) => Promise<NextResponse>,
  options: SecurityOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Apply security middleware
    const result = await applySecurityMiddleware(request, options);

    // If security checks failed, return error response
    if (!result.success) {
      return result.response!;
    }

    // Call the actual handler with sanitized/validated data
    try {
      const response = await handler(request, result.data!);
      
      // Apply security headers to response
      if (options.securityHeaders !== false) {
        return applySecurityHeaders(response);
      }
      
      return response;
    } catch {
      const errorResponse = NextResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        { status: 500 }
      );

      return applySecurityHeaders(errorResponse);
    }
  };
}

// =========================================================================
// PRESET CONFIGURATIONS
// =========================================================================

/**
 * Security configuration for public endpoints
 */
export const PublicEndpointSecurity: SecurityOptions = {
  rateLimit: EndpointRateLimits.public,
  sanitization: {
    sanitizeBody: true,
    sanitizeQuery: true,
    maxLength: 1000,
  },
  securityHeaders: true,
};

/**
 * Security configuration for authenticated endpoints
 */
export const AuthenticatedEndpointSecurity: SecurityOptions = {
  rateLimit: EndpointRateLimits.contracts,
  sanitization: {
    sanitizeBody: true,
    sanitizeQuery: true,
    maxLength: 5000,
  },
  securityHeaders: true,
};

/**
 * Security configuration for admin endpoints
 */
export const AdminEndpointSecurity: SecurityOptions = {
  rateLimit: EndpointRateLimits.admin,
  sanitization: {
    sanitizeBody: true,
    sanitizeQuery: true,
    maxLength: 10000,
  },
  securityHeaders: true,
};

/**
 * Security configuration for file upload endpoints
 */
export const UploadEndpointSecurity: SecurityOptions = {
  rateLimit: EndpointRateLimits.upload,
  sanitization: {
    sanitizeBody: false, // Don't sanitize file data
    sanitizeQuery: true,
  },
  securityHeaders: true,
};

/**
 * Security configuration for AI endpoints
 */
export const AIEndpointSecurity: SecurityOptions = {
  rateLimit: EndpointRateLimits.ai,
  sanitization: {
    sanitizeBody: true,
    sanitizeQuery: true,
    maxLength: 10000,
  },
  securityHeaders: true,
};

// =========================================================================
// USAGE EXAMPLES
// =========================================================================

/**
 * Example 1: Use withSecurity wrapper
 * 
 * ```typescript
 * import { withSecurity, AuthenticatedEndpointSecurity } from '@/lib/middleware/security.middleware';
 * import { createContractSchema } from 'data-orchestration/src/schemas/validation.schemas';
 * 
 * export const POST = withSecurity(
 *   async (request, data) => {
 *     // data.validated.body contains validated and sanitized data
 *     const contract = await createContract(data.validated.body);
 *     return NextResponse.json(contract);
 *   },
 *   {
 *     ...AuthenticatedEndpointSecurity,
 *     validation: {
 *       bodySchema: createContractSchema,
 *     },
 *   }
 * );
 * ```
 * 
 * Example 2: Manual security middleware application
 * 
 * ```typescript
 * import { applySecurityMiddleware, PublicEndpointSecurity } from '@/lib/middleware/security.middleware';
 * 
 * export async function GET(request: NextRequest) {
 *   const result = await applySecurityMiddleware(request, PublicEndpointSecurity);
 *   
 *   if (!result.success) {
 *     return result.response!;
 *   }
 *   
 *   // Use sanitized query parameters
 *   const data = await fetchData(result.data!.query);
 *   
 *   return createSecureResponse(data);
 * }
 * ```
 * 
 * Example 3: Custom security configuration
 * 
 * ```typescript
 * import { withSecurity, EndpointRateLimits } from '@/lib/middleware/security.middleware';
 * import { searchQuerySchema } from 'data-orchestration/src/schemas/validation.schemas';
 * 
 * export const GET = withSecurity(
 *   async (request, data) => {
 *     const results = await search(data.validated.query);
 *     return NextResponse.json(results);
 *   },
 *   {
 *     rateLimit: EndpointRateLimits.search,
 *     validation: {
 *       querySchema: searchQuerySchema,
 *     },
 *     sanitization: {
 *       sanitizeQuery: true,
 *       maxLength: 200,
 *     },
 *   }
 * );
 * ```
 */
