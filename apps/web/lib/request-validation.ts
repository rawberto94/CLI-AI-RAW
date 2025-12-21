/**
 * Production Request Validation Middleware
 * Centralized validation for API requests with Zod schemas
 * 
 * Usage:
 *   import { withValidation, schemas } from '@/lib/request-validation';
 *   
 *   export const POST = withValidation(schemas.contractCreate)(async (req, validatedData) => {
 *     // validatedData is fully typed
 *     return NextResponse.json({ id: newContract.id });
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema, ZodError } from 'zod';
import { logger } from '@/lib/logger';

// ============================================
// Common Validation Schemas
// ============================================

export const schemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),

  // UUID parameter
  uuid: z.string().uuid('Invalid ID format'),

  // Search query
  search: z.object({
    q: z.string().min(1).max(500).optional(),
    query: z.string().min(1).max(500).optional(),
    search: z.string().min(1).max(500).optional(),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    { message: 'Start date must be before end date' }
  ),

  // Contract creation
  contractCreate: z.object({
    fileName: z.string().min(1).max(255),
    clientName: z.string().min(1).max(255).optional(),
    category: z.string().max(100).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    totalValue: z.number().nonnegative().optional(),
    description: z.string().max(5000).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),

  // Contract update
  contractUpdate: z.object({
    fileName: z.string().min(1).max(255).optional(),
    clientName: z.string().min(1).max(255).optional(),
    category: z.string().max(100).optional(),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    totalValue: z.number().nonnegative().optional(),
    description: z.string().max(5000).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),

  // Rate card creation
  rateCardCreate: z.object({
    name: z.string().min(1).max(255),
    supplierName: z.string().min(1).max(255).optional(),
    effectiveDate: z.string().datetime().optional(),
    expirationDate: z.string().datetime().optional(),
    currency: z.string().length(3).default('USD'),
    description: z.string().max(2000).optional(),
  }),

  // Rate card entry
  rateCardEntry: z.object({
    roleName: z.string().min(1).max(255),
    rateType: z.enum(['HOURLY', 'DAILY', 'MONTHLY', 'FIXED']).default('HOURLY'),
    rate: z.number().nonnegative(),
    currency: z.string().length(3).default('USD'),
    level: z.string().max(100).optional(),
    location: z.string().max(255).optional(),
    effectiveDate: z.string().datetime().optional(),
    expirationDate: z.string().datetime().optional(),
  }),

  // AI chat message
  chatMessage: z.object({
    message: z.string().min(1).max(10000),
    contractId: z.string().uuid().optional(),
    history: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })).max(50).optional(),
  }),

  // Webhook creation
  webhookCreate: z.object({
    url: z.string().url(),
    events: z.array(z.string()).min(1),
    secret: z.string().min(16).max(256).optional(),
    active: z.boolean().default(true),
  }),

  // User settings
  userSettings: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.string().max(10).optional(),
    timezone: z.string().max(50).optional(),
    notifications: z.object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
      contractAlerts: z.boolean().optional(),
      weeklyDigest: z.boolean().optional(),
    }).optional(),
  }),

  // Bulk operation
  bulkOperation: z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    action: z.string().min(1).max(50),
    params: z.record(z.unknown()).optional(),
  }),

  // File upload metadata
  fileUpload: z.object({
    fileName: z.string().min(1).max(255),
    fileSize: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
    mimeType: z.string().max(100),
    clientName: z.string().max(255).optional(),
    category: z.string().max(100).optional(),
  }),

  // Tag
  tag: z.object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    description: z.string().max(500).optional(),
  }),

  // Comment
  comment: z.object({
    content: z.string().min(1).max(5000),
    parentId: z.string().uuid().optional(),
  }),

  // Share/permission
  share: z.object({
    email: z.string().email(),
    permission: z.enum(['view', 'edit', 'admin']),
    expiresAt: z.string().datetime().optional(),
  }),
};

// ============================================
// Validation Error Response
// ============================================

interface ValidationErrorResponse {
  error: string;
  code: string;
  details: {
    field: string;
    message: string;
  }[];
}

function formatZodError(error: ZodError): ValidationErrorResponse {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    })),
  };
}

// ============================================
// Validation Middleware
// ============================================

type ValidatedHandler<T> = (
  request: NextRequest,
  validatedData: T,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/**
 * Validate request body against a Zod schema
 */
export function withValidation<T extends ZodSchema>(schema: T) {
  return (handler: ValidatedHandler<z.infer<T>>) => {
    return async (
      request: NextRequest,
      context?: { params: Record<string, string> }
    ): Promise<NextResponse> => {
      try {
        // Parse request body
        let data: unknown;
        
        const contentType = request.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          try {
            data = await request.json();
          } catch {
            return NextResponse.json(
              {
                error: 'Invalid JSON in request body',
                code: 'INVALID_JSON',
              },
              { status: 400 }
            );
          }
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const formData = await request.formData();
          data = Object.fromEntries(formData.entries());
        } else {
          // For GET requests, parse query params
          if (request.method === 'GET') {
            const url = new URL(request.url);
            data = Object.fromEntries(url.searchParams.entries());
          } else {
            data = {};
          }
        }

        // Validate against schema
        const result = schema.safeParse(data);

        if (!result.success) {
          logger.warn('Request validation failed', {
            path: request.nextUrl.pathname,
            errors: result.error.errors,
          });

          return NextResponse.json(formatZodError(result.error), { status: 400 });
        }

        // Call the handler with validated data
        return handler(request, result.data, context);
      } catch (error) {
        logger.error('Validation middleware error', { error });
        
        return NextResponse.json(
          {
            error: 'Internal validation error',
            code: 'VALIDATION_INTERNAL_ERROR',
          },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Validate query parameters against a Zod schema
 */
export function withQueryValidation<T extends ZodSchema>(schema: T) {
  return (handler: ValidatedHandler<z.infer<T>>) => {
    return async (
      request: NextRequest,
      context?: { params: Record<string, string> }
    ): Promise<NextResponse> => {
      try {
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());

        const result = schema.safeParse(queryParams);

        if (!result.success) {
          return NextResponse.json(formatZodError(result.error), { status: 400 });
        }

        return handler(request, result.data, context);
      } catch (error) {
        logger.error('Query validation error', { error });
        
        return NextResponse.json(
          {
            error: 'Internal validation error',
            code: 'VALIDATION_INTERNAL_ERROR',
          },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Validate route parameters (e.g., [id])
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string>,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse } {
  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(formatZodError(result.error), { status: 400 }),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Combined validation for both params and body
 */
export function withFullValidation<
  TParams extends ZodSchema,
  TBody extends ZodSchema
>(paramsSchema: TParams, bodySchema: TBody) {
  return (
    handler: (
      request: NextRequest,
      data: { params: z.infer<TParams>; body: z.infer<TBody> }
    ) => Promise<NextResponse>
  ) => {
    return async (
      request: NextRequest,
      context: { params: Record<string, string> }
    ): Promise<NextResponse> => {
      // Validate params
      const paramsResult = paramsSchema.safeParse(context.params);
      if (!paramsResult.success) {
        return NextResponse.json(formatZodError(paramsResult.error), { status: 400 });
      }

      // Validate body
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON', code: 'INVALID_JSON' },
          { status: 400 }
        );
      }

      const bodyResult = bodySchema.safeParse(body);
      if (!bodyResult.success) {
        return NextResponse.json(formatZodError(bodyResult.error), { status: 400 });
      }

      return handler(request, {
        params: paramsResult.data,
        body: bodyResult.data,
      });
    };
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Create a schema that sanitizes string outputs
 */
export function sanitizedString(options?: { min?: number; max?: number }) {
  let schema = z.string();
  
  if (options?.min) schema = schema.min(options.min);
  if (options?.max) schema = schema.max(options.max);
  
  return schema.transform(sanitizeString);
}

/**
 * Validate and parse ID from params
 */
export function parseId(params: { id?: string }): string | null {
  if (!params.id) return null;
  
  const result = schemas.uuid.safeParse(params.id);
  return result.success ? result.data : null;
}

export default {
  schemas,
  withValidation,
  withQueryValidation,
  withFullValidation,
  validateParams,
  sanitizeString,
  sanitizedString,
  parseId,
};
