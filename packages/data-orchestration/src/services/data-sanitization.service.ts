/**
 * Data Sanitization Service
 * 
 * Provides comprehensive data sanitization:
 * - HTML sanitization (XSS prevention)
 * - Filename sanitization (path traversal prevention)
 * - SQL injection prevention
 * - Input normalization
 * - Whitespace trimming
 */

import pino from 'pino';
import path from 'path';

const logger = pino({ name: 'data-sanitization-service' });

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface SanitizationOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  maxLength?: number;
  trim?: boolean;
  lowercase?: boolean;
  removeNullBytes?: boolean;
}

export interface SanitizationResult {
  original: string;
  sanitized: string;
  changed: boolean;
  removedPatterns?: string[];
}

// =========================================================================
// DATA SANITIZATION SERVICE
// =========================================================================

export class DataSanitizationService {
  private static instance: DataSanitizationService;

  // Dangerous patterns
  private readonly sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|;|\/\*|\*\/|xp_|sp_)/gi,
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(\bOR\b.*=.*)/gi,
  ];

  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /<embed\b/gi,
    /<object\b/gi,
  ];

  private readonly pathTraversalPatterns = [
    /\.\./g,
    /[\/\\]{2,}/g,
    /^[\/\\]/,
    /[<>:"|?*]/g,
  ];

  private constructor() {
    logger.info('Data Sanitization Service initialized');
  }

  static getInstance(): DataSanitizationService {
    if (!DataSanitizationService.instance) {
      DataSanitizationService.instance = new DataSanitizationService();
    }
    return DataSanitizationService.instance;
  }

  // =========================================================================
  // HTML SANITIZATION
  // =========================================================================

  /**
   * Sanitize HTML content to prevent XSS
   */
  sanitizeHTML(html: string, options: SanitizationOptions = {}): SanitizationResult {
    const original = html;
    let sanitized = html;
    const removedPatterns: string[] = [];

    // Remove dangerous tags and patterns
    for (const pattern of this.xssPatterns) {
      if (pattern.test(sanitized)) {
        removedPatterns.push(pattern.source);
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Remove null bytes
    if (options.removeNullBytes !== false) {
      sanitized = sanitized.replace(/\0/g, '');
    }

    // Encode special characters
    sanitized = this.encodeHTMLEntities(sanitized);

    // Trim if requested
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    // Apply max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    const changed = original !== sanitized;

    if (changed) {
      logger.debug(
        { removedPatterns, lengthBefore: original.length, lengthAfter: sanitized.length },
        'HTML sanitized'
      );
    }

    return {
      original,
      sanitized,
      changed,
      removedPatterns: removedPatterns.length > 0 ? removedPatterns : undefined,
    };
  }

  /**
   * Encode HTML entities
   */
  private encodeHTMLEntities(text: string): string {
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
   * Decode HTML entities
   */
  decodeHTMLEntities(text: string): string {
    const entityMap: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&#x2F;': '/',
    };

    return text.replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, (entity) => {
      return entityMap[entity.toLowerCase()] || entity;
    });
  }

  // =========================================================================
  // FILENAME SANITIZATION
  // =========================================================================

  /**
   * Sanitize filename to prevent path traversal
   */
  sanitizeFilename(filename: string, options: SanitizationOptions = {}): SanitizationResult {
    const original = filename;
    let sanitized = filename;
    const removedPatterns: string[] = [];

    // Remove path traversal patterns
    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(sanitized)) {
        removedPatterns.push(pattern.source);
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Replace spaces with underscores
    sanitized = sanitized.replace(/\s+/g, '_');

    // Remove multiple consecutive underscores
    sanitized = sanitized.replace(/_{2,}/g, '_');

    // Remove leading/trailing underscores and dots
    sanitized = sanitized.replace(/^[_\.]+|[_\.]+$/g, '');

    // Ensure filename is not empty
    if (sanitized.length === 0) {
      sanitized = 'unnamed_file';
    }

    // Apply max length (preserve extension)
    if (options.maxLength && sanitized.length > options.maxLength) {
      const ext = path.extname(sanitized);
      const nameWithoutExt = path.basename(sanitized, ext);
      const maxNameLength = options.maxLength - ext.length;
      sanitized = nameWithoutExt.substring(0, maxNameLength) + ext;
    }

    // Lowercase if requested
    if (options.lowercase) {
      sanitized = sanitized.toLowerCase();
    }

    const changed = original !== sanitized;

    if (changed) {
      logger.debug(
        { original, sanitized, removedPatterns },
        'Filename sanitized'
      );
    }

    return {
      original,
      sanitized,
      changed,
      removedPatterns: removedPatterns.length > 0 ? removedPatterns : undefined,
    };
  }

  // =========================================================================
  // SQL INJECTION PREVENTION
  // =========================================================================

  /**
   * Sanitize input to prevent SQL injection
   */
  sanitizeSQL(input: string, options: SanitizationOptions = {}): SanitizationResult {
    const original = input;
    let sanitized = input;
    const removedPatterns: string[] = [];

    // Check for SQL injection patterns
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(sanitized)) {
        removedPatterns.push(pattern.source);
        // For SQL, we escape rather than remove
        sanitized = this.escapeSQLString(sanitized);
        break; // Once we detect SQL patterns, escape the whole string
      }
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Trim if requested
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    const changed = original !== sanitized;

    if (changed) {
      logger.warn(
        { removedPatterns },
        'Potential SQL injection attempt detected and sanitized'
      );
    }

    return {
      original,
      sanitized,
      changed,
      removedPatterns: removedPatterns.length > 0 ? removedPatterns : undefined,
    };
  }

  /**
   * Escape SQL string
   */
  private escapeSQLString(str: string): string {
    return str
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\0/g, '\\0');
  }

  // =========================================================================
  // GENERAL SANITIZATION
  // =========================================================================

  /**
   * Sanitize general text input
   */
  sanitizeText(text: string, options: SanitizationOptions = {}): SanitizationResult {
    const original = text;
    let sanitized = text;

    // Remove null bytes
    if (options.removeNullBytes !== false) {
      sanitized = sanitized.replace(/\0/g, '');
    }

    // Trim whitespace
    if (options.trim !== false) {
      sanitized = sanitized.trim();
      // Normalize internal whitespace
      sanitized = sanitized.replace(/\s+/g, ' ');
    }

    // Remove control characters (except newlines and tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Apply max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Lowercase if requested
    if (options.lowercase) {
      sanitized = sanitized.toLowerCase();
    }

    const changed = original !== sanitized;

    return {
      original,
      sanitized,
      changed,
    };
  }

  /**
   * Sanitize email address
   */
  sanitizeEmail(email: string): SanitizationResult {
    const original = email;
    let sanitized = email.trim().toLowerCase();

    // Remove any characters that aren't valid in email
    sanitized = sanitized.replace(/[^a-z0-9@._\-+]/g, '');

    // Remove multiple @ symbols (keep only first)
    const parts = sanitized.split('@');
    if (parts.length > 2) {
      sanitized = parts[0] + '@' + parts.slice(1).join('');
    }

    const changed = original !== sanitized;

    return {
      original,
      sanitized,
      changed,
    };
  }

  /**
   * Sanitize phone number
   */
  sanitizePhone(phone: string): SanitizationResult {
    const original = phone;
    
    // Keep only digits, +, spaces, hyphens, and parentheses
    let sanitized = phone.replace(/[^\d\+\s\-\(\)]/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();

    const changed = original !== sanitized;

    return {
      original,
      sanitized,
      changed,
    };
  }

  /**
   * Sanitize URL
   */
  sanitizeURL(url: string): SanitizationResult {
    const original = url;
    let sanitized = url.trim();

    // Remove javascript: protocol
    sanitized = sanitized.replace(/^javascript:/gi, '');

    // Remove data: protocol (can be used for XSS)
    sanitized = sanitized.replace(/^data:/gi, '');

    // Ensure URL starts with http:// or https://
    if (!/^https?:\/\//i.test(sanitized)) {
      sanitized = 'https://' + sanitized;
    }

    const changed = original !== sanitized;

    return {
      original,
      sanitized,
      changed,
    };
  }

  // =========================================================================
  // BATCH SANITIZATION
  // =========================================================================

  /**
   * Sanitize object recursively
   */
  sanitizeObject(
    obj: any,
    options: SanitizationOptions = {}
  ): { sanitized: any; changed: boolean } {
    if (obj === null || obj === undefined) {
      return { sanitized: obj, changed: false };
    }

    if (typeof obj === 'string') {
      const result = this.sanitizeText(obj, options);
      return { sanitized: result.sanitized, changed: result.changed };
    }

    if (Array.isArray(obj)) {
      let changed = false;
      const sanitized = obj.map(item => {
        const result = this.sanitizeObject(item, options);
        if (result.changed) changed = true;
        return result.sanitized;
      });
      return { sanitized, changed };
    }

    if (typeof obj === 'object') {
      let changed = false;
      const sanitized: any = {};
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const result = this.sanitizeObject(obj[key], options);
          if (result.changed) changed = true;
          sanitized[key] = result.sanitized;
        }
      }
      
      return { sanitized, changed };
    }

    return { sanitized: obj, changed: false };
  }

  /**
   * Sanitize array of strings
   */
  sanitizeArray(
    items: string[],
    sanitizer: (item: string, options?: SanitizationOptions) => SanitizationResult,
    options: SanitizationOptions = {}
  ): { sanitized: string[]; changed: boolean } {
    let changed = false;
    
    const sanitized = items.map(item => {
      const result = sanitizer.call(this, item, options);
      if (result.changed) changed = true;
      return result.sanitized;
    });

    return { sanitized, changed };
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Check if string contains dangerous patterns
   */
  containsDangerousPatterns(text: string): {
    dangerous: boolean;
    patterns: string[];
  } {
    const patterns: string[] = [];

    // Check XSS patterns
    for (const pattern of this.xssPatterns) {
      if (pattern.test(text)) {
        patterns.push(`XSS: ${pattern.source}`);
      }
    }

    // Check SQL injection patterns
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(text)) {
        patterns.push(`SQL: ${pattern.source}`);
      }
    }

    // Check path traversal patterns
    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(text)) {
        patterns.push(`Path: ${pattern.source}`);
      }
    }

    return {
      dangerous: patterns.length > 0,
      patterns,
    };
  }

  /**
   * Remove all HTML tags
   */
  stripHTMLTags(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Normalize whitespace
   */
  normalizeWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '');
  }

  /**
   * Remove non-printable characters
   */
  removeNonPrintable(text: string): string {
    return text.replace(/[^\x20-\x7E\n\r\t]/g, '');
  }

  /**
   * Truncate text to max length
   */
  truncate(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const dataSanitizationService = DataSanitizationService.getInstance();
