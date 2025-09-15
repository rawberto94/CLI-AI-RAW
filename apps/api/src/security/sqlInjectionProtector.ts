/**
 * SQL Injection Protection Module
 * Advanced SQL injection detection and prevention
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors';

export interface SQLProtectionOptions {
  enabled?: boolean;
  strict?: boolean;
  logAttempts?: boolean;
  blockOnDetection?: boolean;
  allowedPatterns?: RegExp[];
}

export class SQLInjectionProtector {
  private static readonly SQL_KEYWORDS = [
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
    'UNION', 'JOIN', 'WHERE', 'FROM', 'ORDER', 'GROUP', 'HAVING', 'INTO',
    'VALUES', 'SET', 'TABLE', 'DATABASE', 'SCHEMA', 'INDEX', 'VIEW', 'PROCEDURE',
    'FUNCTION', 'TRIGGER', 'EXEC', 'EXECUTE', 'DECLARE', 'CAST', 'CONVERT',
    'SUBSTRING', 'CONCAT', 'CHAR', 'VARCHAR', 'NCHAR', 'NVARCHAR'
  ];

  // SQL operators for advanced detection patterns (future use)
  // private static readonly SQL_OPERATORS = [
  //   '=', '<>', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'BETWEEN', 'IS', 'NOT',
  //   'AND', 'OR', 'XOR', 'EXISTS', 'ALL', 'ANY', 'SOME'
  // ];

  // SQL functions for advanced detection patterns (future use)
  // private static readonly SQL_FUNCTIONS = [
  //   'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'LEN', 'LENGTH', 'UPPER', 'LOWER',
  //   'TRIM', 'LTRIM', 'RTRIM', 'SUBSTRING', 'REPLACE', 'REVERSE', 'COALESCE',
  //   'ISNULL', 'NULLIF', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
  // ];

  private static readonly DANGEROUS_PATTERNS = [
    // Classic SQL injection patterns
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
    
    // Union-based injection
    /(UNION\s+(ALL\s+)?SELECT)/i,
    
    // Comment-based injection
    /(-{2}|\/\*|\*\/|#)/,
    
    // Information schema access
    /(INFORMATION_SCHEMA|sys\.|mysql\.|pg_)/i,
    
    // Time-based injection
    /(WAITFOR\s+DELAY|SLEEP\(|BENCHMARK\()/i,
    
    // Boolean-based injection
    /(\b(TRUE|FALSE)\b.*(\bAND|\bOR)\b.*\b(TRUE|FALSE)\b)/i,
    
    // Stacked queries
    /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)/i,
    
    // Error-based injection
    /(CAST\(.*AS\s+INT\)|CONVERT\(INT,)/i,
    
    // SQL functions that could be exploited
    /(CHAR\(|ASCII\(|ORD\(|HEX\(|UNHEX\()/i,
    
    // Database-specific injection patterns
    /(@@VERSION|@@SERVERNAME|USER\(\)|DATABASE\(\)|VERSION\(\))/i,
    
    // Blind injection patterns
    /(\bLIKE\s+['"].*%.*['"])/i,
    
    // Subquery injection
    /(\(\s*SELECT\s+.*\s+FROM\s+)/i
  ];

  private static readonly ENCODING_PATTERNS = [
    // URL encoded patterns
    /%27|%22|%20|%3D|%3C|%3E|%2D|%2F|%5C/i,
    
    // Double URL encoding
    /%25|%2527|%2522/i,
    
    // Hex encoding
    /0x[0-9a-f]+/i,
    
    // Unicode encoding
    /\\u[0-9a-f]{4}/i
  ];

  /**
   * Check if string contains SQL injection patterns
   */
  public static detectSQLInjection(input: string, options: SQLProtectionOptions = {}): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const normalizedInput = input.toLowerCase().trim();
    
    // Skip if input is too short to be meaningful
    if (normalizedInput.length < 3) {
      return false;
    }

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        return true;
      }
    }

    // Check for encoded injection attempts
    for (const pattern of this.ENCODING_PATTERNS) {
      if (pattern.test(input)) {
        // Decode and check again
        try {
          const decoded = decodeURIComponent(input);
          if (this.detectSQLInjection(decoded, options)) {
            return true;
          }
        } catch {
          // If decoding fails, it might be malicious
          return true;
        }
      }
    }

    // Strict mode: check for any SQL keywords
    if (options.strict) {
      const words = normalizedInput.split(/\s+/);
      for (const word of words) {
        if (this.SQL_KEYWORDS.includes(word.toUpperCase())) {
          return true;
        }
      }
    }

    // Check for allowed patterns
    if (options.allowedPatterns) {
      for (const pattern of options.allowedPatterns) {
        if (pattern.test(input)) {
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Scan entire request for SQL injection attempts
   */
  public static scanRequest(request: FastifyRequest, options: SQLProtectionOptions = {}): Array<{
    location: string;
    field: string;
    value: string;
    threat: string;
  }> {
    const threats: Array<{
      location: string;
      field: string;
      value: string;
      threat: string;
    }> = [];

    const scanValue = (value: any, location: string, field: string) => {
      if (typeof value === 'string') {
        if (this.detectSQLInjection(value, options)) {
          threats.push({
            location,
            field,
            value: value.slice(0, 100), // Limit logged value length
            threat: 'SQL_INJECTION'
          });
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          scanValue(item, location, `${field}[${index}]`);
        });
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([key, val]) => {
          scanValue(val, location, field ? `${field}.${key}` : key);
        });
      }
    };

    // Scan different parts of the request
    if (request.body) {
      scanValue(request.body, 'body', '');
    }
    
    if (request.query) {
      scanValue(request.query, 'query', '');
    }
    
    if (request.params) {
      scanValue(request.params, 'params', '');
    }

    // Scan specific headers that might contain user input
    const suspiciousHeaders = ['x-user-data', 'x-custom-field', 'x-search-query'];
    for (const header of suspiciousHeaders) {
      const value = request.headers[header];
      if (value) {
        scanValue(value, 'headers', header);
      }
    }

    return threats;
  }

  /**
   * Create SQL injection protection middleware
   */
  public static createProtector(options: SQLProtectionOptions = {}) {
    const defaultOptions: SQLProtectionOptions = {
      enabled: true,
      strict: false,
      logAttempts: true,
      blockOnDetection: true,
      ...options
    };

    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!defaultOptions.enabled) {
        return;
      }

      const threats = this.scanRequest(request, defaultOptions);

      if (threats.length > 0) {
        // Log the attempt
        if (defaultOptions.logAttempts) {
          request.log.warn({
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            url: request.url,
            method: request.method,
            threats: threats,
            timestamp: new Date().toISOString()
          }, 'SQL injection attempt detected');
        }

        // Block the request if configured to do so
        if (defaultOptions.blockOnDetection) {
          throw new AppError(
            400,
            'Request blocked due to security policy violation',
            true,
            {
              reason: 'SQL_INJECTION_DETECTED',
              threats: threats.map(t => ({
                location: t.location,
                field: t.field,
                threat: t.threat
              }))
            }
          );
        }
      }
    };
  }

  /**
   * Sanitize input by removing SQL injection patterns
   */
  public static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') {
      return input;
    }

    let sanitized = input;

    // Remove SQL comments
    sanitized = sanitized.replace(/(-{2}.*$|\/\*[\s\S]*?\*\/)/gm, '');

    // Remove dangerous SQL keywords in suspicious contexts
    for (const keyword of this.SQL_KEYWORDS) {
      const pattern = new RegExp(`\\b${keyword}\\b(?=\\s*(;|$|\\s+SELECT|\\s+FROM|\\s+WHERE))`, 'gi');
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove obviously malicious patterns
    sanitized = sanitized.replace(/(\bOR\s+\d+\s*=\s*\d+|\bAND\s+\d+\s*=\s*\d+)/gi, '');
    sanitized = sanitized.replace(/(UNION\s+(ALL\s+)?SELECT)/gi, '');

    return sanitized.trim();
  }
}

// Pre-configured protectors
export const sqlProtection = {
  // Standard protection for most endpoints
  standard: SQLInjectionProtector.createProtector({
    enabled: true,
    strict: false,
    logAttempts: true,
    blockOnDetection: true
  }),

  // Strict protection for sensitive endpoints
  strict: SQLInjectionProtector.createProtector({
    enabled: true,
    strict: true,
    logAttempts: true,
    blockOnDetection: true
  }),

  // Monitoring only (don't block, just log)
  monitor: SQLInjectionProtector.createProtector({
    enabled: true,
    strict: false,
    logAttempts: true,
    blockOnDetection: false
  }),

  // Disabled for endpoints that need to handle SQL-like content
  disabled: SQLInjectionProtector.createProtector({
    enabled: false
  })
};