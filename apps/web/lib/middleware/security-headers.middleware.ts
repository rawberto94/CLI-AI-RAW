/**
 * Security Headers Middleware
 * 
 * Implements security best practices through HTTP headers:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - Referrer-Policy
 * - Permissions-Policy
 */

import { NextResponse } from 'next/server';

// =========================================================================
// SECURITY HEADER CONFIGURATIONS
// =========================================================================

/**
 * Content Security Policy (CSP) configuration
 * Prevents XSS attacks by controlling which resources can be loaded
 */
export const CSP_DIRECTIVES = {
  // Default source for all content types
  'default-src': ["'self'"],
  
  // Script sources - allow self and specific trusted domains
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Next.js
    "'unsafe-eval'", // Required for development
    'https://vercel.live',
    'https://va.vercel-scripts.com',
  ],
  
  // Style sources
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled-components and CSS-in-JS
    'https://fonts.googleapis.com',
  ],
  
  // Font sources
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
    'data:',
  ],
  
  // Image sources
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https:',
  ],
  
  // Media sources (audio/video)
  'media-src': ["'self'"],
  
  // Object sources (plugins like Flash)
  'object-src': ["'none'"],
  
  // Frame sources (iframes)
  'frame-src': [
    "'self'",
    'https://vercel.live',
  ],
  
  // Connect sources (AJAX, WebSocket, EventSource)
  'connect-src': [
    "'self'",
    'https://vercel.live',
    'https://va.vercel-scripts.com',
    'wss://*.vercel.live',
  ],
  
  // Worker sources
  'worker-src': [
    "'self'",
    'blob:',
  ],
  
  // Form action sources
  'form-action': ["'self'"],
  
  // Frame ancestors (who can embed this site)
  'frame-ancestors': ["'none'"],
  
  // Base URI
  'base-uri': ["'self'"],
  
  // Upgrade insecure requests
  'upgrade-insecure-requests': [],
};

/**
 * Build CSP header value from directives
 */
function buildCSPHeader(directives: typeof CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) {
        return key;
      }
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Permissions Policy configuration
 * Controls which browser features can be used
 */
export const PERMISSIONS_POLICY = {
  camera: [],
  microphone: [],
  geolocation: [],
  'interest-cohort': [], // Disable FLoC
  payment: ['self'],
  usb: [],
  'display-capture': [],
  'document-domain': [],
  'encrypted-media': [],
  fullscreen: ['self'],
  magnetometer: [],
  midi: [],
  'picture-in-picture': ['self'],
  'publickey-credentials-get': ['self'],
  'screen-wake-lock': [],
  'sync-xhr': [],
  'xr-spatial-tracking': [],
};

/**
 * Build Permissions Policy header value
 */
function buildPermissionsPolicyHeader(policy: typeof PERMISSIONS_POLICY): string {
  return Object.entries(policy)
    .map(([key, values]) => {
      if (values.length === 0) {
        return `${key}=()`;
      }
      return `${key}=(${values.join(' ')})`;
    })
    .join(', ');
}

// =========================================================================
// SECURITY HEADERS
// =========================================================================

/**
 * Get all security headers
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    // Content Security Policy
    'Content-Security-Policy': buildCSPHeader(CSP_DIRECTIVES),
    
    // HTTP Strict Transport Security (HSTS)
    // Enforces HTTPS for 1 year, including subdomains
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // X-Frame-Options
    // Prevents clickjacking by disallowing the page to be framed
    'X-Frame-Options': 'DENY',
    
    // X-Content-Type-Options
    // Prevents MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // X-XSS-Protection
    // Enables XSS filter in older browsers
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer-Policy
    // Controls how much referrer information is sent
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions-Policy
    // Controls which browser features can be used
    'Permissions-Policy': buildPermissionsPolicyHeader(PERMISSIONS_POLICY),
    
    // X-DNS-Prefetch-Control
    // Controls DNS prefetching
    'X-DNS-Prefetch-Control': 'on',
    
    // X-Download-Options
    // Prevents IE from executing downloads in site's context
    'X-Download-Options': 'noopen',
    
    // X-Permitted-Cross-Domain-Policies
    // Controls cross-domain policies for Adobe products
    'X-Permitted-Cross-Domain-Policies': 'none',
  };
}

/**
 * Get development-friendly security headers
 * Relaxes some restrictions for local development
 */
export function getDevSecurityHeaders(): Record<string, string> {
  const devCSP = {
    ...CSP_DIRECTIVES,
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https://vercel.live',
      'https://va.vercel-scripts.com',
    ],
    'connect-src': [
      "'self'",
      'http://localhost:*',
      'ws://localhost:*',
      'https://vercel.live',
      'wss://*.vercel.live',
    ],
  };

  return {
    'Content-Security-Policy': buildCSPHeader(devCSP),
    'X-Frame-Options': 'SAMEORIGIN', // Allow framing in dev
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

// =========================================================================
// MIDDLEWARE FUNCTIONS
// =========================================================================

/**
 * Apply security headers to a response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const headers = isDevelopment ? getDevSecurityHeaders() : getSecurityHeaders();

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Create a response with security headers
 */
export function createSecureResponse(
  body: any,
  init?: ResponseInit
): NextResponse {
  const response = NextResponse.json(body, init);
  return applySecurityHeaders(response);
}

/**
 * Apply security headers to an existing response
 */
export function withSecurityHeaders(response: Response): NextResponse {
  const nextResponse = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  return applySecurityHeaders(nextResponse);
}

// =========================================================================
// CUSTOM CSP CONFIGURATIONS
// =========================================================================

/**
 * Create custom CSP configuration for specific routes
 */
export function createCustomCSP(
  customDirectives: Partial<typeof CSP_DIRECTIVES>
): string {
  const mergedDirectives = {
    ...CSP_DIRECTIVES,
    ...customDirectives,
  };

  return buildCSPHeader(mergedDirectives);
}

/**
 * CSP configuration for pages with embedded content
 */
export function getEmbedCSP(): string {
  return createCustomCSP({
    'frame-src': [
      "'self'",
      'https://vercel.live',
      'https://www.youtube.com',
      'https://player.vimeo.com',
    ],
  });
}

/**
 * CSP configuration for pages with external scripts
 */
export function getExternalScriptCSP(domains: string[]): string {
  return createCustomCSP({
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      ...domains,
    ],
  });
}

// =========================================================================
// SECURITY HEADER VALIDATION
// =========================================================================

/**
 * Validate that security headers are present
 */
export function validateSecurityHeaders(headers: Headers): {
  valid: boolean;
  missing: string[];
} {
  const requiredHeaders = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
  ];

  const missing = requiredHeaders.filter(
    (header) => !headers.has(header)
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Check if response has security headers
 */
export function hasSecurityHeaders(response: Response): boolean {
  const { valid } = validateSecurityHeaders(response.headers);
  return valid;
}

// =========================================================================
// USAGE EXAMPLES
// =========================================================================

/**
 * Example: Apply security headers to an API route
 * 
 * ```typescript
 * import { createSecureResponse } from '@/lib/middleware/security-headers.middleware';
 * 
 * export async function GET(request: NextRequest) {
 *   const data = { message: 'Hello, World!' };
 *   return createSecureResponse(data);
 * }
 * ```
 * 
 * Example: Apply security headers to an existing response
 * 
 * ```typescript
 * import { applySecurityHeaders } from '@/lib/middleware/security-headers.middleware';
 * 
 * export async function POST(request: NextRequest) {
 *   const response = NextResponse.json({ success: true });
 *   return applySecurityHeaders(response);
 * }
 * ```
 * 
 * Example: Use custom CSP for specific route
 * 
 * ```typescript
 * import { createCustomCSP } from '@/lib/middleware/security-headers.middleware';
 * 
 * export async function GET(request: NextRequest) {
 *   const response = NextResponse.json({ data: [] });
 *   
 *   const customCSP = createCustomCSP({
 *     'script-src': ["'self'", 'https://trusted-cdn.com'],
 *   });
 *   
 *   response.headers.set('Content-Security-Policy', customCSP);
 *   return response;
 * }
 * ```
 */
