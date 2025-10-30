/**
 * Data Sanitization Middleware
 * 
 * Automatically sanitizes all user inputs to prevent XSS and injection attacks
 */

import { NextRequest } from 'next/server';
import { dataSanitizationService } from '../../../packages/data-orchestration/src/services/data-sanitization.service';

// =========================================================================
// TYPES
// =========================================================================

export interface SanitizationOptions {
  sanitizeBody?: boolean;
  sanitizeQuery?: boolean;
  sanitizeHeaders?: boolean;
  maxLength?: number;
  allowHTML?: boolean;
}

export interface SanitizedRequest {
  body?: any;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}

// =========================================================================
// SANITIZATION MIDDLEWARE
// =========================================================================

/**
 * Sanitize request body
 */
export async function sanitizeRequestBody(
  request: NextRequest,
  options: SanitizationOptions = {}
): Promise<any> {
  try {
    const body = await request.json();
    return sanitizeObject(body, options);
  } catch (error) {
    // If body is not JSON, return null
    return null;
  }
}

/**
 * Sanitize query parameters
 */
export function sanitizeQueryParams(
  request: NextRequest,
  options: SanitizationOptions = {}
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  request.nextUrl.searchParams.forEach((value, key) => {
    const result = dataSanitizationService.sanitizeText(value, {
      maxLength: options.maxLength,
      trim: true,
    });
    sanitized[key] = result.sanitized;
  });

  return sanitized;
}

/**
 * Sanitize headers
 */
export function sanitizeHeaders(
  request: NextRequest,
  options: SanitizationOptions = {}
): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const headersToSanitize = ['user-agent', 'referer', 'origin'];

  request.headers.forEach((value, key) => {
    if (headersToSanitize.includes(key.toLowerCase())) {
      const result = dataSanitizationService.sanitizeText(value, {
        maxLength: options.maxLength || 500,
        trim: true,
      });
      sanitized[key] = result.sanitized;
    } else {
      sanitized[key] = value;
    }
  });

  return sanitized;
}

/**
 * Sanitize entire request
 */
export async function sanitizeRequest(
  request: NextRequest,
  options: SanitizationOptions = {}
): Promise<SanitizedRequest> {
  const result: SanitizedRequest = {};

  if (options.sanitizeBody !== false) {
    result.body = await sanitizeRequestBody(request, options);
  }

  if (options.sanitizeQuery !== false) {
    result.query = sanitizeQueryParams(request, options);
  }

  if (options.sanitizeHeaders) {
    result.headers = sanitizeHeaders(request, options);
  }

  return result;
}

// =========================================================================
// OBJECT SANITIZATION
// =========================================================================

/**
 * Sanitize an object recursively
 */
export function sanitizeObject(
  obj: any,
  options: SanitizationOptions = {}
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj, options);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, options));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key], options);
      }
    }

    return sanitized;
  }

  return obj;
}

/**
 * Sanitize a string value
 */
export function sanitizeString(
  value: string,
  options: SanitizationOptions = {}
): string {
  // Check for dangerous patterns
  const dangerCheck = dataSanitizationService.containsDangerousPatterns(value);

  if (dangerCheck.dangerous) {
    // If HTML is allowed, sanitize HTML
    if (options.allowHTML) {
      const result = dataSanitizationService.sanitizeHTML(value, {
        maxLength: options.maxLength,
        trim: true,
      });
      return result.sanitized;
    }

    // Otherwise, strip all HTML
    return dataSanitizationService.stripHTMLTags(value);
  }

  // Normal text sanitization
  const result = dataSanitizationService.sanitizeText(value, {
    maxLength: options.maxLength,
    trim: true,
  });

  return result.sanitized;
}

// =========================================================================
// FIELD-SPECIFIC SANITIZATION
// =========================================================================

/**
 * Sanitize email field
 */
export function sanitizeEmail(email: string): string {
  const result = dataSanitizationService.sanitizeEmail(email);
  return result.sanitized;
}

/**
 * Sanitize phone field
 */
export function sanitizePhone(phone: string): string {
  const result = dataSanitizationService.sanitizePhone(phone);
  return result.sanitized;
}

/**
 * Sanitize URL field
 */
export function sanitizeUrl(url: string): string {
  const result = dataSanitizationService.sanitizeURL(url);
  return result.sanitized;
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  const result = dataSanitizationService.sanitizeFilename(filename, {
    maxLength: 255,
    lowercase: false,
  });
  return result.sanitized;
}

// =========================================================================
// OUTPUT SANITIZATION
// =========================================================================

/**
 * Sanitize data before sending to client
 */
export function sanitizeOutput(data: any): any {
  return sanitizeObject(data, {
    allowHTML: false,
    maxLength: undefined,
  });
}

/**
 * Escape HTML entities in output
 */
export function escapeHTML(text: string): string {
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'\/]/g, (char) => entityMap[char] || char);
}

/**
 * Sanitize JSON output
 */
export function sanitizeJSON(obj: any): any {
  const json = JSON.stringify(obj);
  const sanitized = sanitizeString(json, { allowHTML: false });
  return JSON.parse(sanitized);
}

// =========================================================================
// VALIDATION + SANITIZATION
// =========================================================================

/**
 * Sanitize and validate data
 */
export function sanitizeAndValidate<T>(
  data: any,
  validator: (data: any) => T,
  options: SanitizationOptions = {}
): T {
  // First sanitize
  const sanitized = sanitizeObject(data, options);

  // Then validate
  return validator(sanitized);
}

// =========================================================================
// DANGEROUS PATTERN DETECTION
// =========================================================================

/**
 * Check if input contains dangerous patterns
 */
export function containsDangerousPatterns(input: string): boolean {
  const result = dataSanitizationService.containsDangerousPatterns(input);
  return result.dangerous;
}

/**
 * Get dangerous patterns found in input
 */
export function getDangerousPatterns(input: string): string[] {
  const result = dataSanitizationService.containsDangerousPatterns(input);
  return result.patterns;
}

/**
 * Reject request if dangerous patterns found
 */
export function rejectIfDangerous(input: string): void {
  const result = dataSanitizationService.containsDangerousPatterns(input);

  if (result.dangerous) {
    throw new Error(
      `Dangerous patterns detected: ${result.patterns.join(', ')}`
    );
  }
}

// =========================================================================
// MIDDLEWARE FACTORY
// =========================================================================

/**
 * Create sanitization middleware
 */
export function createSanitizationMiddleware(
  options: SanitizationOptions = {}
) {
  return async (request: NextRequest): Promise<SanitizedRequest> => {
    return await sanitizeRequest(request, options);
  };
}

// =========================================================================
// USAGE EXAMPLES
// =========================================================================

/**
 * Example: Sanitize request body in API route
 * 
 * ```typescript
 * import { sanitizeRequestBody } from '@/lib/middleware/sanitization.middleware';
 * 
 * export async function POST(request: NextRequest) {
 *   // Sanitize request body
 *   const sanitizedBody = await sanitizeRequestBody(request);
 *   
 *   // Use sanitized data
 *   const result = await processData(sanitizedBody);
 *   
 *   return NextResponse.json(result);
 * }
 * ```
 * 
 * Example: Sanitize query parameters
 * 
 * ```typescript
 * import { sanitizeQueryParams } from '@/lib/middleware/sanitization.middleware';
 * 
 * export async function GET(request: NextRequest) {
 *   // Sanitize query parameters
 *   const sanitizedQuery = sanitizeQueryParams(request);
 *   
 *   // Use sanitized parameters
 *   const results = await search(sanitizedQuery.q);
 *   
 *   return NextResponse.json(results);
 * }
 * ```
 * 
 * Example: Sanitize specific fields
 * 
 * ```typescript
 * import { sanitizeEmail, sanitizeUrl } from '@/lib/middleware/sanitization.middleware';
 * 
 * export async function POST(request: NextRequest) {
 *   const body = await request.json();
 *   
 *   const user = {
 *     email: sanitizeEmail(body.email),
 *     website: sanitizeUrl(body.website),
 *   };
 *   
 *   return NextResponse.json(user);
 * }
 * ```
 */
