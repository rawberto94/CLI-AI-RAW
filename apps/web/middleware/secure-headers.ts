/**
 * Secure Headers Middleware
 * Adds security headers to all responses
 * 
 * @example
 * // In middleware.ts
 * import { withSecureHeaders } from './middleware/secure-headers';
 * 
 * export default withSecureHeaders(yourMiddleware);
 */

import { NextResponse, type NextRequest } from 'next/server';

// ============================================================================
// Types
// ============================================================================

export interface SecurityHeadersConfig {
  /**
   * Content Security Policy
   * Controls which resources can be loaded
   */
  contentSecurityPolicy?: ContentSecurityPolicy | string | false;

  /**
   * Permissions Policy (formerly Feature Policy)
   * Controls browser features
   */
  permissionsPolicy?: PermissionsPolicy | string | false;

  /**
   * Strict Transport Security
   * Forces HTTPS connections
   */
  strictTransportSecurity?: StrictTransportSecurity | string | false;

  /**
   * Referrer Policy
   * Controls how much referrer info is sent
   */
  referrerPolicy?: ReferrerPolicy | false;

  /**
   * X-Frame-Options
   * Prevents clickjacking
   */
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;

  /**
   * X-Content-Type-Options
   * Prevents MIME type sniffing
   */
  contentTypeOptions?: boolean;

  /**
   * X-XSS-Protection
   * Legacy XSS protection (mostly deprecated)
   */
  xssProtection?: boolean;

  /**
   * X-DNS-Prefetch-Control
   * Controls DNS prefetching
   */
  dnsPrefetchControl?: boolean;

  /**
   * Cross-Origin-Embedder-Policy
   */
  crossOriginEmbedderPolicy?: 'require-corp' | 'credentialless' | 'unsafe-none' | false;

  /**
   * Cross-Origin-Opener-Policy
   */
  crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none' | false;

  /**
   * Cross-Origin-Resource-Policy
   */
  crossOriginResourcePolicy?: 'same-origin' | 'same-site' | 'cross-origin' | false;
}

export interface ContentSecurityPolicy {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'frame-src'?: string[];
  'frame-ancestors'?: string[];
  'form-action'?: string[];
  'base-uri'?: string[];
  'worker-src'?: string[];
  'manifest-src'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
  'report-uri'?: string;
  'report-to'?: string;
}

export interface PermissionsPolicy {
  accelerometer?: string[];
  'ambient-light-sensor'?: string[];
  autoplay?: string[];
  battery?: string[];
  camera?: string[];
  'cross-origin-isolated'?: string[];
  'display-capture'?: string[];
  'document-domain'?: string[];
  'encrypted-media'?: string[];
  'execution-while-not-rendered'?: string[];
  'execution-while-out-of-viewport'?: string[];
  fullscreen?: string[];
  geolocation?: string[];
  gyroscope?: string[];
  'keyboard-map'?: string[];
  magnetometer?: string[];
  microphone?: string[];
  midi?: string[];
  'navigation-override'?: string[];
  payment?: string[];
  'picture-in-picture'?: string[];
  'publickey-credentials-get'?: string[];
  'screen-wake-lock'?: string[];
  'sync-xhr'?: string[];
  usb?: string[];
  'web-share'?: string[];
  'xr-spatial-tracking'?: string[];
}

export interface StrictTransportSecurity {
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

// ============================================================================
// Default Configuration
// ============================================================================

const isDevelopment = process.env.NODE_ENV === 'development';

export const defaultCSP: ContentSecurityPolicy = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-eval'", // Required for Next.js dev
    "'unsafe-inline'", // Required for some frameworks
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': [
    "'self'",
    ...(isDevelopment 
      ? ['ws://localhost:*', 'http://localhost:*'] 
      : []
    ),
  ],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'upgrade-insecure-requests': !isDevelopment,
};

export const defaultPermissionsPolicy: PermissionsPolicy = {
  accelerometer: [],
  'ambient-light-sensor': [],
  autoplay: ["'self'"],
  battery: [],
  camera: [],
  'display-capture': [],
  'document-domain': [],
  'encrypted-media': ["'self'"],
  fullscreen: ["'self'"],
  geolocation: [],
  gyroscope: [],
  magnetometer: [],
  microphone: [],
  midi: [],
  payment: [],
  'picture-in-picture': ["'self'"],
  'publickey-credentials-get': ["'self'"],
  'screen-wake-lock': [],
  'sync-xhr': ["'self'"],
  usb: [],
  'web-share': ["'self'"],
  'xr-spatial-tracking': [],
};

export const defaultConfig: SecurityHeadersConfig = {
  contentSecurityPolicy: defaultCSP,
  permissionsPolicy: defaultPermissionsPolicy,
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
  frameOptions: 'DENY',
  contentTypeOptions: true,
  xssProtection: true,
  dnsPrefetchControl: true,
  crossOriginEmbedderPolicy: false, // Can break some features
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
};

// ============================================================================
// Header Builders
// ============================================================================

function buildCSPHeader(csp: ContentSecurityPolicy): string {
  const directives: string[] = [];

  for (const [directive, value] of Object.entries(csp)) {
    if (value === true) {
      directives.push(directive);
    } else if (Array.isArray(value) && value.length > 0) {
      directives.push(`${directive} ${value.join(' ')}`);
    } else if (typeof value === 'string') {
      directives.push(`${directive} ${value}`);
    }
  }

  return directives.join('; ');
}

function buildPermissionsPolicyHeader(policy: PermissionsPolicy): string {
  const directives: string[] = [];

  for (const [feature, allowList] of Object.entries(policy)) {
    if (Array.isArray(allowList)) {
      if (allowList.length === 0) {
        directives.push(`${feature}=()`);
      } else {
        const values = allowList.map(v => 
          v === "'self'" ? 'self' : v
        ).join(' ');
        directives.push(`${feature}=(${values})`);
      }
    }
  }

  return directives.join(', ');
}

function buildHSTSHeader(hsts: StrictTransportSecurity): string {
  let header = `max-age=${hsts.maxAge}`;
  if (hsts.includeSubDomains) header += '; includeSubDomains';
  if (hsts.preload) header += '; preload';
  return header;
}

// ============================================================================
// Apply Headers
// ============================================================================

export function applySecurityHeaders(
  response: NextResponse,
  config: SecurityHeadersConfig = defaultConfig
): NextResponse {
  // Content Security Policy
  if (config.contentSecurityPolicy !== false) {
    const csp = typeof config.contentSecurityPolicy === 'string'
      ? config.contentSecurityPolicy
      : buildCSPHeader(config.contentSecurityPolicy ?? defaultCSP);
    
    // Use Report-Only in development for easier debugging
    const headerName = isDevelopment
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';
    
    response.headers.set(headerName, csp);
  }

  // Permissions Policy
  if (config.permissionsPolicy !== false) {
    const pp = typeof config.permissionsPolicy === 'string'
      ? config.permissionsPolicy
      : buildPermissionsPolicyHeader(config.permissionsPolicy ?? defaultPermissionsPolicy);
    response.headers.set('Permissions-Policy', pp);
  }

  // Strict Transport Security (HTTPS only)
  if (config.strictTransportSecurity !== false && !isDevelopment) {
    const hsts = typeof config.strictTransportSecurity === 'string'
      ? config.strictTransportSecurity
      : buildHSTSHeader(config.strictTransportSecurity ?? { maxAge: 31536000 });
    response.headers.set('Strict-Transport-Security', hsts);
  }

  // Referrer Policy
  if (config.referrerPolicy !== false) {
    response.headers.set('Referrer-Policy', config.referrerPolicy ?? 'strict-origin-when-cross-origin');
  }

  // X-Frame-Options
  if (config.frameOptions !== false) {
    response.headers.set('X-Frame-Options', config.frameOptions ?? 'DENY');
  }

  // X-Content-Type-Options
  if (config.contentTypeOptions !== false) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }

  // X-XSS-Protection
  if (config.xssProtection !== false) {
    response.headers.set('X-XSS-Protection', '1; mode=block');
  }

  // X-DNS-Prefetch-Control
  if (config.dnsPrefetchControl !== false) {
    response.headers.set('X-DNS-Prefetch-Control', 'on');
  }

  // Cross-Origin-Embedder-Policy
  if (config.crossOriginEmbedderPolicy !== false && config.crossOriginEmbedderPolicy) {
    response.headers.set('Cross-Origin-Embedder-Policy', config.crossOriginEmbedderPolicy);
  }

  // Cross-Origin-Opener-Policy
  if (config.crossOriginOpenerPolicy !== false && config.crossOriginOpenerPolicy) {
    response.headers.set('Cross-Origin-Opener-Policy', config.crossOriginOpenerPolicy);
  }

  // Cross-Origin-Resource-Policy
  if (config.crossOriginResourcePolicy !== false && config.crossOriginResourcePolicy) {
    response.headers.set('Cross-Origin-Resource-Policy', config.crossOriginResourcePolicy);
  }

  return response;
}

// ============================================================================
// Middleware Wrapper
// ============================================================================

type MiddlewareFunction = (
  request: NextRequest,
  event?: unknown
) => Promise<NextResponse> | NextResponse;

/**
 * Wrap existing middleware with security headers
 */
export function withSecureHeaders(
  middleware?: MiddlewareFunction,
  config?: SecurityHeadersConfig
): MiddlewareFunction {
  return async (request: NextRequest, event?: unknown) => {
    // Call existing middleware if provided
    let response: NextResponse;
    
    if (middleware) {
      const result = await middleware(request, event);
      response = result instanceof NextResponse ? result : NextResponse.next();
    } else {
      response = NextResponse.next();
    }

    // Apply security headers
    return applySecurityHeaders(response, config);
  };
}

// ============================================================================
// Nonce Generator for CSP
// ============================================================================

const NONCE_CACHE = new WeakMap<NextRequest, string>();

/**
 * Generate or retrieve a nonce for inline scripts
 */
export function generateNonce(request: NextRequest): string {
  let nonce = NONCE_CACHE.get(request);
  
  if (!nonce) {
    // Generate random nonce
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    nonce = Buffer.from(array).toString('base64');
    NONCE_CACHE.set(request, nonce);
  }
  
  return nonce;
}

/**
 * Create CSP with nonce for inline scripts
 */
export function createCSPWithNonce(
  nonce: string,
  additionalDirectives?: Partial<ContentSecurityPolicy>
): ContentSecurityPolicy {
  return {
    ...defaultCSP,
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    ...additionalDirectives,
  };
}

// ============================================================================
// Reporting Endpoint
// ============================================================================

export interface CSPViolationReport {
  'blocked-uri': string;
  'column-number'?: number;
  'disposition': 'enforce' | 'report';
  'document-uri': string;
  'effective-directive': string;
  'line-number'?: number;
  'original-policy': string;
  'referrer': string;
  'script-sample'?: string;
  'source-file'?: string;
  'status-code': number;
  'violated-directive': string;
}

/**
 * Handle CSP violation reports
 * Use in a API route: /api/csp-report
 */
export async function handleCSPReport(
  report: CSPViolationReport
): Promise<void> {
  // Log the violation
  console.warn('CSP Violation:', {
    blockedUri: report['blocked-uri'],
    violatedDirective: report['violated-directive'],
    documentUri: report['document-uri'],
    sourceFile: report['source-file'],
    lineNumber: report['line-number'],
  });

  // In production, you might want to:
  // - Send to error tracking service (Sentry, etc.)
  // - Store in database for analysis
  // - Alert security team for suspicious patterns
}

// ============================================================================
// Presets
// ============================================================================

export const presets = {
  /**
   * Strict security - maximum protection
   */
  strict: {
    contentSecurityPolicy: {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'"],
      'img-src': ["'self'"],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'base-uri': ["'self'"],
      'object-src': ["'none'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true,
    },
    frameOptions: 'DENY',
    crossOriginEmbedderPolicy: 'require-corp',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
  } as SecurityHeadersConfig,

  /**
   * Balanced security - good protection with some flexibility
   */
  balanced: defaultConfig,

  /**
   * Relaxed security - minimal restrictions (development)
   */
  relaxed: {
    contentSecurityPolicy: false,
    permissionsPolicy: false,
    strictTransportSecurity: false,
    frameOptions: 'SAMEORIGIN',
    contentTypeOptions: true,
    xssProtection: true,
    dnsPrefetchControl: true,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
  } as SecurityHeadersConfig,

  /**
   * API-optimized - for API routes
   */
  api: {
    contentSecurityPolicy: false,
    permissionsPolicy: false,
    strictTransportSecurity: defaultConfig.strictTransportSecurity,
    referrerPolicy: 'no-referrer',
    frameOptions: 'DENY',
    contentTypeOptions: true,
    xssProtection: false, // Not needed for JSON APIs
    dnsPrefetchControl: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: 'same-origin',
  } as SecurityHeadersConfig,
};
