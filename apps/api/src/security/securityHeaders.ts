/**
 * Enhanced Security Headers
 * Comprehensive security headers for protection against various attacks
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

export interface SecurityHeadersOptions {
  contentSecurityPolicy?: {
    directives?: Record<string, string | string[]>;
    reportOnly?: boolean;
  };
  strictTransportSecurity?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  customHeaders?: Record<string, string>;
  development?: boolean;
}

export class SecurityHeaders {
  private static readonly DEFAULT_CSP_DIRECTIVES = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'child-src': ["'none'"],
    'worker-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"]
  };

  /**
   * Generate Content Security Policy header value
   */
  private static generateCSPHeader(directives: Record<string, string | string[]>): string {
    return Object.entries(directives)
      .map(([directive, values]) => {
        const valueArray = Array.isArray(values) ? values : [values];
        return `${directive} ${valueArray.join(' ')}`;
      })
      .join('; ');
  }

  /**
   * Create security headers middleware
   */
  public static create(options: SecurityHeadersOptions = {}) {
    return async (_request: FastifyRequest, reply: FastifyReply) => {
      const isDevelopment = options.development || process.env['NODE_ENV'] === 'development';
      
      // Core security headers
      const headers: Record<string, string> = {
        // Prevent MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        
        // Prevent clickjacking
        'X-Frame-Options': 'DENY',
        
        // Enable XSS protection
        'X-XSS-Protection': '1; mode=block',
        
        // Control referrer information
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        
        // Prevent Adobe Flash and PDF plugins from loading
        'X-Permitted-Cross-Domain-Policies': 'none',
        
        // Remove server information
        'X-Powered-By': 'Contract Intelligence System',
        
        // Prevent DNS prefetching
        'X-DNS-Prefetch-Control': 'off',
        
        // Download options for IE
        'X-Download-Options': 'noopen',
        
        // Cache control for sensitive content
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      // Strict Transport Security (HTTPS only)
      if (!isDevelopment) {
        const stsOptions = options.strictTransportSecurity || {};
        const maxAge = stsOptions.maxAge || 31536000; // 1 year
        let stsValue = `max-age=${maxAge}`;
        
        if (stsOptions.includeSubDomains !== false) {
          stsValue += '; includeSubDomains';
        }
        
        if (stsOptions.preload) {
          stsValue += '; preload';
        }
        
        headers['Strict-Transport-Security'] = stsValue;
      }

      // Content Security Policy
      const cspOptions = options.contentSecurityPolicy || {};
      const cspDirectives = {
        ...this.DEFAULT_CSP_DIRECTIVES,
        ...(cspOptions.directives || {})
      };

      // Relax CSP in development
      if (isDevelopment) {
        cspDirectives['script-src'] = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
        cspDirectives['connect-src'] = ["'self'", 'ws:', 'wss:', 'http:', 'https:'];
      }

      const cspHeaderName = cspOptions.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
      headers[cspHeaderName] = this.generateCSPHeader(cspDirectives);

      // Feature Policy / Permissions Policy
      headers['Permissions-Policy'] = [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
        'ambient-light-sensor=()',
        'encrypted-media=()',
        'sync-xhr=()',
        'midi=()',
        'picture-in-picture=()'
      ].join(', ');

      // Cross-Origin policies
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Resource-Policy'] = 'same-origin';

      // Apply custom headers
      if (options.customHeaders) {
        Object.assign(headers, options.customHeaders);
      }

      // Set all headers
      reply.headers(headers);
    };
  }

  /**
   * Security headers for API endpoints
   */
  public static apiHeaders() {
    return this.create({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'none'"],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"]
        }
      },
      customHeaders: {
        'X-API-Version': '1.0',
        'X-Response-Time': new Date().toISOString()
      }
    });
  }

  /**
   * Security headers for file upload endpoints
   */
  public static uploadHeaders() {
    return this.create({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'none'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"]
        }
      },
      customHeaders: {
        'X-Content-Disposition': 'attachment'
      }
    });
  }

  /**
   * Security headers for health check endpoints
   */
  public static healthHeaders() {
    return this.create({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'none'"]
        }
      },
      customHeaders: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'active'
      }
    });
  }
}

// Predefined header configurations
export const securityHeaders = {
  default: SecurityHeaders.create(),
  api: SecurityHeaders.apiHeaders(),
  upload: SecurityHeaders.uploadHeaders(),
  health: SecurityHeaders.healthHeaders(),
  
  // Development mode with relaxed policies
  development: SecurityHeaders.create({
    development: true,
    strictTransportSecurity: {
      maxAge: 0 // Disable HSTS in development
    }
  })
};