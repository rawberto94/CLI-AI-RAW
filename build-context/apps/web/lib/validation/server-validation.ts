/**
 * Server-Side Validation for Next.js API Routes
 * 
 * Wraps the validation service for use in Next.js API routes
 */

import { NextRequest } from 'next/server';
import { ZodSchema } from 'zod';
import { 
  inputValidationService, 
  ValidationException,
  InputValidationResult as ValidationResult 
} from '../../../../packages/data-orchestration/src/services/input-validation.service';

// =========================================================================
// NEXT.JS REQUEST VALIDATION
// =========================================================================

/**
 * Validate request body
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    return inputValidationService.validate(schema, body);
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          field: 'body',
          message: 'Invalid JSON in request body',
          code: 'INVALID_JSON',
        },
      ],
    };
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  const params: Record<string, any> = {};

  // Extract query parameters
  request.nextUrl.searchParams.forEach((value, key) => {
    // Try to parse as JSON for complex types
    try {
      params[key] = JSON.parse(value);
    } catch {
      // Keep as string if not valid JSON
      params[key] = value;
    }
  });

  return inputValidationService.validate(schema, params);
}

/**
 * Validate headers
 */
export function validateHeaders<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): ValidationResult<T> {
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return inputValidationService.validate(schema, headers);
}

/**
 * Validate tenant ID from request
 */
export function validateTenantId(request: NextRequest): ValidationResult<string> {
  const tenantId =
    request.nextUrl.searchParams.get('tenantId') ||
    request.headers.get('X-Tenant-ID');

  return inputValidationService.validateTenantId(tenantId);
}

/**
 * Validate and extract data from request (throws on error)
 */
export async function validateRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  source: 'body' | 'query' = 'body'
): Promise<T> {
  const result =
    source === 'body'
      ? await validateRequestBody(request, schema)
      : validateQueryParams(request, schema);

  if (!result.success) {
    throw new ValidationException(result.errors || []);
  }

  return result.data!;
}

export { ValidationException };
