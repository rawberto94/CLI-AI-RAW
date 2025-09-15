/**
 * XSS (Cross-Site Scripting) Protection Module
 * Advanced XSS detection and prevention
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../errors';

export interface XSSProtectionOptions {
  enabled?: boolean;
  strict?: boolean;
  logAttempts?: boolean;
  blockOnDetection?: boolean;
  sanitizeInput?: boolean;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

export class XSSProtector {
  private static readonly DANGEROUS_TAGS = [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select',
    'button', 'link', 'meta', 'style', 'base', 'frame', 'frameset', 'noframes',
    'applet', 'audio', 'video', 'source', 'track', 'canvas', 'svg', 'math'
  ];

  private static readonly DANGEROUS_ATTRIBUTES = [
    'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout', 'onfocus',
    'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect', 'onkeydown',
    'onkeyup', 'onkeypress', 'ondblclick', 'oncontextmenu', 'ondrag',
    'ondrop', 'onscroll', 'onresize', 'onhashchange', 'onpageshow',
    'onpagehide', 'onpopstate', 'onstorage', 'onunload', 'onbeforeunload'
  ];

  private static readonly DANGEROUS_PROTOCOLS = [
    'javascript:', 'vbscript:', 'data:', 'about:', 'chrome:', 'file:',
    'ftp:', 'jar:', 'mailto:', 'ms-help:', 'news:', 'res:', 'shell:',
    'view-source:', 'vnd.ms-excel:', 'mhtml:'
  ];

  private static readonly XSS_PATTERNS = [
    // Script tags
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    
    // Event handlers
    /on\w+\s*=\s*['"][^'"]*['"]?/gi,
    /on\w+\s*=\s*[^>\s]+/gi,
    
    // JavaScript protocols
    /javascript\s*:/gi,
    /vbscript\s*:/gi,
    
    // Data URLs with scripts
    /data:text\/html\s*,\s*<script/gi,
    /data:text\/javascript/gi,
    
    // CSS expressions (IE)
    /expression\s*\(/gi,
    /behavior\s*:/gi,
    
    // Import statements
    /@import\s+/gi,
    
    // Embedded objects
    /<(object|embed|applet|iframe)\b/gi,
    
    // Form-related attacks
    /<form\b[^>]*>/gi,
    /<input\b[^>]*>/gi,
    
    // Meta refresh attacks
    /<meta\b[^>]*refresh/gi,
    
    // Link tag attacks
    /<link\b[^>]*stylesheet/gi,
    
    // Base tag attacks
    /<base\b[^>]*>/gi,
    
    // SVG-based XSS
    /<svg\b[^>]*>/gi,
    /<g\b[^>]*onload/gi,
    
    // Math ML XSS
    /<math\b[^>]*>/gi,
    
    // Comment-based XSS
    /<!--[\s\S]*?-->/g,
    
    // CSS injection
    /style\s*=\s*['"][^'"]*expression/gi,
    /style\s*=\s*['"][^'"]*javascript/gi,
    
    // Document methods
    /document\.(write|writeln|createElement|getElementById)/gi,
    /window\.(location|open|eval|setTimeout|setInterval)/gi,
    
    // String manipulation that could lead to XSS
    /\.innerHTML\s*=/gi,
    /\.outerHTML\s*=/gi,
    /\.insertAdjacentHTML/gi,
    
    // Template literal XSS
    /`[\s\S]*\${[\s\S]*}[\s\S]*`/g
  ];

  private static readonly ENCODED_PATTERNS = [
    // HTML entities
    /&(#\d+|#x[0-9a-f]+|[a-z]+);/gi,
    
    // URL encoding
    /%[0-9a-f]{2}/gi,
    
    // Unicode encoding
    /\\u[0-9a-f]{4}/gi,
    
    // CSS encoding
    /\\[0-9a-f]{1,6}\s?/gi
  ];

  /**
   * Detect XSS patterns in input
   */
  public static detectXSS(input: string, options: XSSProtectionOptions = {}): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    // Check raw input
    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        return true;
      }
    }

    // Check for dangerous protocols
    for (const protocol of this.DANGEROUS_PROTOCOLS) {
      if (input.toLowerCase().includes(protocol)) {
        return true;
      }
    }

    // Check for encoded attacks
    for (const pattern of this.ENCODED_PATTERNS) {
      if (pattern.test(input)) {
        try {
          // Try to decode and check again
          let decoded = input;
          
          // HTML entity decoding
          decoded = decoded.replace(/&lt;/gi, '<')
                          .replace(/&gt;/gi, '>')
                          .replace(/&quot;/gi, '"')
                          .replace(/&#x27;/gi, "'")
                          .replace(/&#39;/gi, "'")
                          .replace(/&amp;/gi, '&');
          
          // URL decoding
          try {
            decoded = decodeURIComponent(decoded);
          } catch {
            // If decoding fails, treat as suspicious
            return true;
          }
          
          // Check decoded content
          if (this.detectXSS(decoded, options)) {
            return true;
          }
        } catch {
          // Decoding errors might indicate malicious content
          return true;
        }
      }
    }

    // Strict mode: check for any HTML tags
    if (options.strict) {
      const htmlTagPattern = /<\/?[a-z][\s\S]*>/gi;
      if (htmlTagPattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Scan request for XSS attempts
   */
  public static scanRequest(request: FastifyRequest, options: XSSProtectionOptions = {}): Array<{
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
        if (this.detectXSS(value, options)) {
          threats.push({
            location,
            field,
            value: value.slice(0, 100), // Limit logged value length
            threat: 'XSS'
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

    // Scan headers that might contain user input
    const userHeaders = ['x-custom-header', 'x-user-data', 'referer', 'user-agent'];
    for (const header of userHeaders) {
      const value = request.headers[header];
      if (value) {
        scanValue(value, 'headers', header);
      }
    }

    return threats;
  }

  /**
   * Sanitize input by removing XSS patterns
   */
  public static sanitizeInput(input: string, _options: XSSProtectionOptions = {}): string {
    if (!input || typeof input !== 'string') {
      return input;
    }

    let sanitized = input;

    // Remove script tags completely
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Remove dangerous tags
    for (const tag of this.DANGEROUS_TAGS) {
      const pattern = new RegExp(`<\/?${tag}\b[^>]*>`, 'gi');
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove event handlers
    for (const attr of this.DANGEROUS_ATTRIBUTES) {
      const pattern = new RegExp(`\\s${attr}\\s*=\\s*['"][^'"]*['"]?`, 'gi');
      sanitized = sanitized.replace(pattern, '');
    }

    // Remove dangerous protocols
    for (const protocol of this.DANGEROUS_PROTOCOLS) {
      const pattern = new RegExp(protocol.replace(':', '\\s*:'), 'gi');
      sanitized = sanitized.replace(pattern, '');
    }

    // HTML entity encoding for remaining content
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return sanitized;
  }

  /**
   * Create XSS protection middleware
   */
  public static createProtector(options: XSSProtectionOptions = {}) {
    const defaultOptions: XSSProtectionOptions = {
      enabled: true,
      strict: false,
      logAttempts: true,
      blockOnDetection: true,
      sanitizeInput: false,
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
          }, 'XSS attempt detected');
        }

        // Sanitize input if configured
        if (defaultOptions.sanitizeInput) {
          if (request.body && typeof request.body === 'object') {
            request.body = this.sanitizeObject(request.body, defaultOptions);
          }
          if (request.query && typeof request.query === 'object') {
            request.query = this.sanitizeObject(request.query, defaultOptions);
          }
        }

        // Block the request if configured to do so
        if (defaultOptions.blockOnDetection) {
          throw new AppError(
            400,
            'Request blocked due to security policy violation',
            true,
            {
              reason: 'XSS_DETECTED',
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
   * Recursively sanitize object properties
   */
  private static sanitizeObject(obj: any, options: XSSProtectionOptions): any {
    if (typeof obj === 'string') {
      return this.sanitizeInput(obj, options);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, options));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value, options);
      }
      return sanitized;
    }
    
    return obj;
  }
}

// Pre-configured protectors
export const xssProtection = {
  // Standard protection for most endpoints
  standard: XSSProtector.createProtector({
    enabled: true,
    strict: false,
    logAttempts: true,
    blockOnDetection: true,
    sanitizeInput: false
  }),

  // Strict protection for sensitive endpoints
  strict: XSSProtector.createProtector({
    enabled: true,
    strict: true,
    logAttempts: true,
    blockOnDetection: true,
    sanitizeInput: false
  }),

  // Sanitizing protection (clean instead of block)
  sanitizing: XSSProtector.createProtector({
    enabled: true,
    strict: false,
    logAttempts: true,
    blockOnDetection: false,
    sanitizeInput: true
  }),

  // Monitoring only (don't block, just log)
  monitor: XSSProtector.createProtector({
    enabled: true,
    strict: false,
    logAttempts: true,
    blockOnDetection: false,
    sanitizeInput: false
  }),

  // Disabled for endpoints that need to handle HTML content
  disabled: XSSProtector.createProtector({
    enabled: false
  })
};