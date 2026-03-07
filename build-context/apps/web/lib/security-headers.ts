/**
 * Security Headers Configuration
 * 
 * Comprehensive security headers for production deployment.
 * These should be applied via middleware or next.config.
 */

import { NextResponse } from 'next/server';

// ============================================================================
// Types
// ============================================================================

export interface SecurityHeadersConfig {
  /** Enable Content Security Policy */
  csp: boolean;
  /** CSP report-only mode (for testing) */
  cspReportOnly: boolean;
  /** CSP report URI for violation reporting */
  cspReportUri?: string;
  /** Additional CSP directives */
  cspDirectives?: Partial<CSPDirectives>;
  /** Enable HSTS */
  hsts: boolean;
  /** HSTS max age in seconds */
  hstsMaxAge: number;
  /** Include subdomains in HSTS */
  hstsIncludeSubDomains: boolean;
  /** Enable HSTS preload */
  hstsPreload: boolean;
  /** Allowed frame ancestors (for embedding) */
  frameAncestors: string[];
  /** Permissions Policy features to disable */
  disabledFeatures: string[];
}

export interface CSPDirectives {
  'default-src': string[];
  'script-src': string[];
  'style-src': string[];
  'img-src': string[];
  'font-src': string[];
  'connect-src': string[];
  'frame-src': string[];
  'frame-ancestors': string[];
  'object-src': string[];
  'base-uri': string[];
  'form-action': string[];
  'upgrade-insecure-requests': boolean;
  'report-uri': string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  csp: true,
  cspReportOnly: false,
  cspDirectives: {},
  hsts: true,
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubDomains: true,
  hstsPreload: false, // Enable only after testing
  frameAncestors: ["'self'"],
  disabledFeatures: ['camera', 'microphone', 'geolocation', 'payment'],
};

// ============================================================================
// CSP Builder
// ============================================================================

function buildCSP(config: SecurityHeadersConfig): string {
  const isDev = process.env.NODE_ENV === 'development';
  
  const directives: CSPDirectives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      // Allow inline scripts in development for HMR
      ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
      // Vercel Analytics
      'https://vercel.live',
      'https://va.vercel-scripts.com',
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind and styled-jsx
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https:', // Allow HTTPS images
    ],
    'font-src': [
      "'self'",
      'data:',
    ],
    'connect-src': [
      "'self'",
      // API endpoints
      'https://api.openai.com',
      'https://api.mistral.ai',
      'https://api.anthropic.com',
      // Vercel
      'https://vercel.live',
      'https://vitals.vercel-insights.com',
      // WebSocket for development
      ...(isDev ? ['ws://localhost:*', 'wss://localhost:*'] : []),
    ],
    'frame-src': [
      "'self'",
      'https://vercel.live',
    ],
    'frame-ancestors': config.frameAncestors,
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': !isDev,
    'report-uri': config.cspReportUri ? [config.cspReportUri] : [],
    // Apply custom directives
    ...config.cspDirectives,
  };
  
  return Object.entries(directives)
    .filter(([, values]) => {
      if (typeof values === 'boolean') return values;
      return Array.isArray(values) && values.length > 0;
    })
    .map(([key, values]) => {
      if (typeof values === 'boolean') return key;
      return `${key} ${(values as string[]).join(' ')}`;
    })
    .join('; ');
}

// ============================================================================
// Permissions Policy Builder
// ============================================================================

function buildPermissionsPolicy(disabledFeatures: string[]): string {
  const policies = disabledFeatures.map(feature => `${feature}=()`);
  return policies.join(', ');
}

// ============================================================================
// Security Headers Application
// ============================================================================

/**
 * Apply security headers to a NextResponse
 */
export function applySecurityHeaders(
  response: NextResponse,
  config: Partial<SecurityHeadersConfig> = {}
): NextResponse {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Content Security Policy
  if (finalConfig.csp) {
    const csp = buildCSP(finalConfig);
    const headerName = finalConfig.cspReportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy';
    response.headers.set(headerName, csp);
  }
  
  // HTTP Strict Transport Security
  if (finalConfig.hsts && process.env.NODE_ENV === 'production') {
    let hstsValue = `max-age=${finalConfig.hstsMaxAge}`;
    if (finalConfig.hstsIncludeSubDomains) hstsValue += '; includeSubDomains';
    if (finalConfig.hstsPreload) hstsValue += '; preload';
    response.headers.set('Strict-Transport-Security', hstsValue);
  }
  
  // X-Frame-Options (legacy, but still useful)
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  
  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // X-XSS-Protection (legacy, but doesn't hurt)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy
  if (finalConfig.disabledFeatures.length > 0) {
    const policy = buildPermissionsPolicy(finalConfig.disabledFeatures);
    response.headers.set('Permissions-Policy', policy);
  }
  
  // Cross-Origin policies
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  return response;
}

/**
 * Get security headers as a plain object (for next.config.js)
 */
export function getSecurityHeaders(
  config: Partial<SecurityHeadersConfig> = {}
): Array<{ key: string; value: string }> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const headers: Array<{ key: string; value: string }> = [];
  
  if (finalConfig.csp) {
    headers.push({
      key: finalConfig.cspReportOnly 
        ? 'Content-Security-Policy-Report-Only' 
        : 'Content-Security-Policy',
      value: buildCSP(finalConfig),
    });
  }
  
  if (finalConfig.hsts) {
    let hstsValue = `max-age=${finalConfig.hstsMaxAge}`;
    if (finalConfig.hstsIncludeSubDomains) hstsValue += '; includeSubDomains';
    if (finalConfig.hstsPreload) hstsValue += '; preload';
    headers.push({ key: 'Strict-Transport-Security', value: hstsValue });
  }
  
  headers.push(
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-XSS-Protection', value: '1; mode=block' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }
  );
  
  if (finalConfig.disabledFeatures.length > 0) {
    headers.push({
      key: 'Permissions-Policy',
      value: buildPermissionsPolicy(finalConfig.disabledFeatures),
    });
  }
  
  return headers;
}

// ============================================================================
// Export
// ============================================================================

export { DEFAULT_CONFIG as defaultSecurityConfig };
