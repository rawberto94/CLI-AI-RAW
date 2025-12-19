/**
 * Security Headers Middleware
 * 
 * Comprehensive HTTP security headers for:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 * - Permissions-Policy
 * - Cross-Origin policies
 */

import { NextRequest, NextResponse } from 'next/server';

interface SecurityHeadersConfig {
  /** Content Security Policy configuration */
  csp?: CSPConfig;
  /** Enable HSTS with max-age in seconds */
  hsts?: HSTSConfig;
  /** X-Frame-Options value */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | { allowFrom: string };
  /** Referrer-Policy value */
  referrerPolicy?: ReferrerPolicy;
  /** Permissions-Policy configuration */
  permissionsPolicy?: PermissionsPolicyConfig;
  /** Cross-Origin-Opener-Policy */
  coopPolicy?: 'unsafe-none' | 'same-origin' | 'same-origin-allow-popups';
  /** Cross-Origin-Embedder-Policy */
  coepPolicy?: 'unsafe-none' | 'require-corp' | 'credentialless';
  /** Cross-Origin-Resource-Policy */
  corpPolicy?: 'same-site' | 'same-origin' | 'cross-origin';
  /** Expect-CT configuration (deprecated but still used) */
  expectCT?: ExpectCTConfig;
}

interface CSPConfig {
  directives: Partial<CSPDirectives>;
  reportOnly?: boolean;
  reportUri?: string;
}

interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'media-src': string[];
  'object-src': string[];
  'frame-src': string[];
  'frame-ancestors': string[];
  'form-action': string[];
  'base-uri': string[];
  'manifest-src': string[];
  'worker-src': string[];
  'child-src': string[];
  'navigate-to': string[];
  'require-trusted-types-for': string[];
  'trusted-types': string[];
  'upgrade-insecure-requests': boolean;
  'block-all-mixed-content': boolean;
  'report-uri': string[];
  'report-to': string[];
}

interface HSTSConfig {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

type ReferrerPolicy =
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

interface PermissionsPolicyConfig {
  accelerometer?: string[];
  'ambient-light-sensor'?: string[];
  autoplay?: string[];
  battery?: string[];
  camera?: string[];
  'display-capture'?: string[];
  'document-domain'?: string[];
  'encrypted-media'?: string[];
  fullscreen?: string[];
  geolocation?: string[];
  gyroscope?: string[];
  'layout-animations'?: string[];
  magnetometer?: string[];
  microphone?: string[];
  midi?: string[];
  'navigation-override'?: string[];
  payment?: string[];
  'picture-in-picture'?: string[];
  'publickey-credentials-get'?: string[];
  'screen-wake-lock'?: string[];
  speaker?: string[];
  'sync-xhr'?: string[];
  usb?: string[];
  'web-share'?: string[];
  'xr-spatial-tracking'?: string[];
}

interface ExpectCTConfig {
  maxAge: number;
  enforce?: boolean;
  reportUri?: string;
}

/**
 * Default strict security headers configuration
 */
export const strictSecurityHeaders: SecurityHeadersConfig = {
  csp: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'strict-dynamic'"],
      'style-src': ["'self'", "'unsafe-inline'"], // Required for many CSS-in-JS
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true,
    },
    reportOnly: false,
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameOptions: 'DENY',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    accelerometer: [],
    'ambient-light-sensor': [],
    autoplay: [],
    battery: [],
    camera: [],
    'display-capture': [],
    geolocation: [],
    gyroscope: [],
    magnetometer: [],
    microphone: [],
    midi: [],
    payment: [],
    usb: [],
    'xr-spatial-tracking': [],
  },
  coopPolicy: 'same-origin',
  coepPolicy: 'require-corp',
  corpPolicy: 'same-origin',
};

/**
 * Relaxed configuration for development or specific needs
 */
export const relaxedSecurityHeaders: SecurityHeadersConfig = {
  csp: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': ["'self'", 'https:', 'data:'],
      'connect-src': ["'self'", 'https:', 'wss:'],
      'frame-ancestors': ["'self'"],
    },
    reportOnly: true,
  },
  hsts: {
    maxAge: 86400, // 1 day for development
    includeSubDomains: false,
    preload: false,
  },
  frameOptions: 'SAMEORIGIN',
  referrerPolicy: 'origin-when-cross-origin',
  permissionsPolicy: {},
  coopPolicy: 'same-origin-allow-popups',
  coepPolicy: 'unsafe-none',
  corpPolicy: 'cross-origin',
};

/**
 * Generate nonce for CSP script-src
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

/**
 * Build CSP header value
 */
function buildCSPHeader(config: CSPConfig, nonce?: string): string {
  const parts: string[] = [];

  for (const [directive, values] of Object.entries(config.directives)) {
    if (typeof values === 'boolean') {
      if (values) {
        parts.push(directive);
      }
    } else if (Array.isArray(values) && values.length > 0) {
      const directiveValues = [...values];
      
      // Add nonce to script-src if provided
      if (directive === 'script-src' && nonce) {
        directiveValues.push(`'nonce-${nonce}'`);
      }
      
      parts.push(`${directive} ${directiveValues.join(' ')}`);
    }
  }

  if (config.reportUri) {
    parts.push(`report-uri ${config.reportUri}`);
  }

  return parts.join('; ');
}

/**
 * Build HSTS header value
 */
function buildHSTSHeader(config: HSTSConfig): string {
  let value = `max-age=${config.maxAge}`;
  
  if (config.includeSubDomains) {
    value += '; includeSubDomains';
  }
  
  if (config.preload) {
    value += '; preload';
  }
  
  return value;
}

/**
 * Build Permissions-Policy header value
 */
function buildPermissionsPolicyHeader(config: PermissionsPolicyConfig): string {
  const parts: string[] = [];

  for (const [feature, allowList] of Object.entries(config)) {
    if (allowList.length === 0) {
      parts.push(`${feature}=()`);
    } else {
      const origins = allowList.map((o: string) => o === 'self' ? 'self' : `"${o}"`).join(' ');
      parts.push(`${feature}=(${origins})`);
    }
  }

  return parts.join(', ');
}

/**
 * Security Headers Middleware
 */
export class SecurityHeadersMiddleware {
  private config: SecurityHeadersConfig;

  constructor(config: SecurityHeadersConfig = strictSecurityHeaders) {
    this.config = config;
  }

  /**
   * Apply security headers to response
   */
  applyHeaders(response: NextResponse, nonce?: string): NextResponse {
    const headers = response.headers;

    // Content-Security-Policy
    if (this.config.csp) {
      const cspValue = buildCSPHeader(this.config.csp, nonce);
      const headerName = this.config.csp.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      headers.set(headerName, cspValue);
    }

    // HTTP Strict Transport Security
    if (this.config.hsts) {
      headers.set('Strict-Transport-Security', buildHSTSHeader(this.config.hsts));
    }

    // X-Frame-Options
    if (this.config.frameOptions) {
      if (typeof this.config.frameOptions === 'string') {
        headers.set('X-Frame-Options', this.config.frameOptions);
      } else {
        headers.set('X-Frame-Options', `ALLOW-FROM ${this.config.frameOptions.allowFrom}`);
      }
    }

    // X-Content-Type-Options (always set)
    headers.set('X-Content-Type-Options', 'nosniff');

    // X-XSS-Protection (legacy but still useful)
    headers.set('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy
    if (this.config.referrerPolicy) {
      headers.set('Referrer-Policy', this.config.referrerPolicy);
    }

    // Permissions-Policy
    if (this.config.permissionsPolicy && Object.keys(this.config.permissionsPolicy).length > 0) {
      headers.set('Permissions-Policy', buildPermissionsPolicyHeader(this.config.permissionsPolicy));
    }

    // Cross-Origin-Opener-Policy
    if (this.config.coopPolicy) {
      headers.set('Cross-Origin-Opener-Policy', this.config.coopPolicy);
    }

    // Cross-Origin-Embedder-Policy
    if (this.config.coepPolicy) {
      headers.set('Cross-Origin-Embedder-Policy', this.config.coepPolicy);
    }

    // Cross-Origin-Resource-Policy
    if (this.config.corpPolicy) {
      headers.set('Cross-Origin-Resource-Policy', this.config.corpPolicy);
    }

    // Expect-CT
    if (this.config.expectCT) {
      let ctValue = `max-age=${this.config.expectCT.maxAge}`;
      if (this.config.expectCT.enforce) {
        ctValue += ', enforce';
      }
      if (this.config.expectCT.reportUri) {
        ctValue += `, report-uri="${this.config.expectCT.reportUri}"`;
      }
      headers.set('Expect-CT', ctValue);
    }

    // Remove potentially dangerous headers
    headers.delete('X-Powered-By');
    headers.delete('Server');

    return response;
  }

  /**
   * Create middleware handler
   */
  handler = (request: NextRequest): NextResponse => {
    const response = NextResponse.next();
    const nonce = generateNonce();
    
    // Store nonce in request for use in page rendering
    response.headers.set('x-nonce', nonce);
    
    return this.applyHeaders(response, nonce);
  };
}

/**
 * Create security headers middleware with custom config
 */
export function createSecurityHeadersMiddleware(
  config: SecurityHeadersConfig = strictSecurityHeaders
): SecurityHeadersMiddleware {
  return new SecurityHeadersMiddleware(config);
}

/**
 * Next.js middleware wrapper
 */
export function withSecurityHeaders(
  config: SecurityHeadersConfig = strictSecurityHeaders
) {
  const middleware = createSecurityHeadersMiddleware(config);
  
  return (request: NextRequest): NextResponse => {
    return middleware.handler(request);
  };
}

/**
 * API route wrapper with security headers
 */
export function withAPISecurityHeaders<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  config: SecurityHeadersConfig = strictSecurityHeaders
): T {
  const middleware = createSecurityHeadersMiddleware(config);

  return (async (...args: Parameters<T>): Promise<Response> => {
    const response = await handler(...args);
    
    // Clone response to modify headers
    const headers = new Headers(response.headers);
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    // Apply security headers (without CSP nonce for API routes)
    middleware.applyHeaders(NextResponse.next({ headers }));
    
    return newResponse;
  }) as T;
}

/**
 * Swiss/EU-specific security configuration
 */
export const swissComplianceHeaders: SecurityHeadersConfig = {
  ...strictSecurityHeaders,
  csp: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'strict-dynamic'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'"],
      // Restrict connections to Swiss/EU endpoints only
      'connect-src': [
        "'self'",
        'https://*.exoscale.com',      // Swiss cloud
        'https://*.infomaniak.com',     // Swiss cloud
        'https://*.azure.microsoft.com', // Azure Switzerland
        'https://switzerlandnorth.api.cognitive.microsoft.com',
        'https://switzerlandwest.api.cognitive.microsoft.com',
      ],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true,
    },
    reportOnly: false,
    reportUri: '/api/security/csp-report',
  },
  hsts: {
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: 'no-referrer', // Strictest for privacy
  coopPolicy: 'same-origin',
  coepPolicy: 'require-corp',
};

/**
 * CSP violation report handler
 */
export async function handleCSPReport(request: NextRequest): Promise<NextResponse> {
  try {
    const report = await request.json();
    
    console.log('[SecurityHeaders] CSP Violation:', JSON.stringify(report, null, 2));
    
    // In production, send to monitoring system
    // await sendToMonitoring('csp-violation', report);
    
    return NextResponse.json({ received: true }, { status: 204 });
  } catch (error) {
    console.error('[SecurityHeaders] Error processing CSP report:', error);
    return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  }
}

// Export types
export type {
  SecurityHeadersConfig,
  CSPConfig,
  CSPDirectives,
  HSTSConfig,
  ReferrerPolicy,
  PermissionsPolicyConfig,
  ExpectCTConfig,
};

// Default export
export default SecurityHeadersMiddleware;
