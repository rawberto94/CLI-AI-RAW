/**
 * Enhanced Input Validation System
 * Comprehensive input validation and sanitization with schema support
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppError } from '../errors';

interface ValidationRule {
  schema: z.ZodSchema;
  path: 'body' | 'query' | 'params' | 'headers';
  required?: boolean;
}

interface ValidationOptions {
  stripUnknown?: boolean;
  sanitizeStrings?: boolean;
  maxDepth?: number;
}

export class InputValidator {
  private static readonly DEFAULT_OPTIONS: ValidationOptions = {
    stripUnknown: true,
    sanitizeStrings: true,
    maxDepth: 10
  };

  /**
   * Sanitize string input to prevent XSS and injection attacks
   */
  private static sanitizeString(input: string): string {
    return input
      // Remove script tags completely
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove javascript: protocols
      .replace(/javascript:/gi, '')
      // Remove on* event handlers
      .replace(/\son\w+\s*=/gi, '')
      // Encode HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      // Remove null bytes
      .replace(/\0/g, '')
      // Limit length to prevent DoS
      .slice(0, 10000);
  }

  /**
   * Deep sanitize object recursively
   */
  private static sanitizeValue(value: any, depth = 0, options: ValidationOptions): any {
    // Prevent infinite recursion
    if (depth > (options.maxDepth || 10)) {
      return value;
    }

    if (typeof value === 'string' && options.sanitizeStrings) {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item, depth + 1, options));
    }

    if (typeof value === 'object' && value !== null) {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        // Sanitize key names too
        const cleanKey = options.sanitizeStrings ? this.sanitizeString(key) : key;
        sanitized[cleanKey] = this.sanitizeValue(val, depth + 1, options);
      }
      return sanitized;
    }

    return value;
  }

  /**
   * Validate and sanitize request data against schema
   */
  public static createValidator(rules: ValidationRule[], options?: ValidationOptions) {
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };

    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const errors: Array<{ path: string; message: string; value?: any }> = [];

      for (const rule of rules) {
        try {
          const data = (request as any)[rule.path];
          
          // Skip validation if data is missing and not required
          if (!data && !rule.required) {
            continue;
          }

          if (!data && rule.required) {
            errors.push({
              path: rule.path,
              message: `${rule.path} is required but was not provided`
            });
            continue;
          }

          // Sanitize data first
          const sanitizedData = this.sanitizeValue(data, 0, mergedOptions);
          
          // Validate against schema
          const result = rule.schema.safeParse(sanitizedData);
          
          if (!result.success) {
            errors.push({
              path: rule.path,
              message: `Validation failed for ${rule.path}`,
              value: result.error.errors
            });
          } else {
            // Update request with sanitized and validated data
            (request as any)[rule.path] = result.data;
          }

        } catch (error) {
          errors.push({
            path: rule.path,
            message: `Validation error for ${rule.path}: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      if (errors.length > 0) {
        throw new AppError(400, 'Validation failed', true, { validationErrors: errors });
      }
    };
  }

  /**
   * SQL injection pattern detection
   */
  public static detectSQLInjection(value: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(INFORMATION_SCHEMA|sys\.)/i,
      /(-{2}|\/\*|\*\/)/,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+[\w\s]*\s*=\s*[\w\s]*)/i,
      /(CAST\(|CONVERT\()/i,
      /(CHAR\(|NCHAR\(|VARCHAR\()/i,
      /(\|\||CONCAT)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Advanced XSS pattern detection
   */
  public static detectXSS(value: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /vbscript:/i,
      /onload|onerror|onclick|onmouseover|onfocus|onblur/i,
      /<iframe|<object|<embed|<form/i,
      /expression\s*\(/i,
      /url\s*\(/i,
      /@import/i,
      /\.innerhtml|\.outerhtml/i
    ];

    return xssPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Path traversal detection
   */
  public static detectPathTraversal(value: string): boolean {
    const pathPatterns = [
      /\.\./,
      /\/\.\.\//,
      /\\\.\.\\/,
      /%2e%2e/i,
      /%252e%252e/i,
      /\.\.%2f/i,
      /\.\.%5c/i
    ];

    return pathPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Comprehensive security scan
   */
  public static securityScan(data: any): Array<{ type: string; path: string; value: string }> {
    const threats: Array<{ type: string; path: string; value: string }> = [];

    const scanValue = (value: any, path: string) => {
      if (typeof value === 'string') {
        if (this.detectSQLInjection(value)) {
          threats.push({ type: 'SQL_INJECTION', path, value });
        }
        if (this.detectXSS(value)) {
          threats.push({ type: 'XSS', path, value });
        }
        if (this.detectPathTraversal(value)) {
          threats.push({ type: 'PATH_TRAVERSAL', path, value });
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => scanValue(item, `${path}[${index}]`));
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([key, val]) => {
          scanValue(val, path ? `${path}.${key}` : key);
        });
      }
    };

    scanValue(data, '');
    return threats;
  }
}

// Common validation schemas
export const commonSchemas = {
  tenantId: z.string()
    .min(1, 'Tenant ID is required')
    .max(50, 'Tenant ID too long')
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Tenant ID contains invalid characters'),

  contractId: z.string()
    .regex(/^doc-\d{13}-[a-f0-9]{6}$/, 'Invalid contract ID format'),

  filename: z.string()
    .min(1, 'Filename is required')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9\-_.() ]+$/, 'Filename contains invalid characters'),

  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email too long'),

  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20)
  }),

  textContent: z.string()
    .max(1000000, 'Text content too long')
    .refine(val => !InputValidator.detectSQLInjection(val), 'Content contains potential SQL injection')
    .refine(val => !InputValidator.detectXSS(val), 'Content contains potential XSS'),

  safeString: z.string()
    .max(1000, 'String too long')
    .refine(val => !InputValidator.detectSQLInjection(val), 'String contains potential SQL injection')
    .refine(val => !InputValidator.detectXSS(val), 'String contains potential XSS')
    .refine(val => !InputValidator.detectPathTraversal(val), 'String contains path traversal attempt')
};

// Pre-built validators for common use cases
export const validators = {
  tenantHeader: InputValidator.createValidator([
    { schema: commonSchemas.tenantId, path: 'headers', required: false }
  ]),

  contractParams: InputValidator.createValidator([
    { schema: z.object({ contractId: commonSchemas.contractId }), path: 'params', required: true }
  ]),

  paginationQuery: InputValidator.createValidator([
    { schema: commonSchemas.pagination, path: 'query', required: false }
  ]),

  fileUpload: InputValidator.createValidator([
    {
      schema: z.object({
        filename: commonSchemas.filename,
        mimetype: z.enum(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
        size: z.number().max(100 * 1024 * 1024, 'File size exceeds 100MB limit')
      }),
      path: 'body',
      required: true
    }
  ])
};