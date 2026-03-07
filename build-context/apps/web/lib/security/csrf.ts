/**
 * CSRF Protection
 * Cross-Site Request Forgery prevention utilities
 * 
 * @example
 * // Generate token on page load
 * const token = await generateCsrfToken();
 * 
 * // Include in form
 * <input type="hidden" name="csrf_token" value={token} />
 * 
 * // Validate on submission
 * const isValid = await validateCsrfToken(req);
 */

import { cookies } from 'next/headers';

// ============================================================================
// Configuration
// ============================================================================

const CSRF_COOKIE_NAME = 'csrf_token'; // L20 FIX: Aligned with middleware and csrf-constants.ts
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_FORM_FIELD = 'csrf_token';
const TOKEN_LENGTH = 32;
const TOKEN_MAX_AGE = 3600; // 1 hour

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generate a cryptographically secure random token
 */
function generateRandomToken(length: number = TOKEN_LENGTH): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array)
    .map(byte => chars[byte % chars.length])
    .join('');
}

/**
 * Hash token for storage
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Server-Side CSRF (Cookie-based)
// ============================================================================

/**
 * Generate CSRF token and set cookie
 * Call this in your layout or page component
 */
export async function generateCsrfToken(): Promise<string> {
  const token = generateRandomToken();
  const hashedToken = await hashToken(token);
  
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, hashedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });
  
  return token;
}

/**
 * Get existing CSRF token from cookie, or generate new one
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existingHash = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  if (existingHash) {
    // Return a new token that hashes to the same value
    // In practice, we need to generate a new token and update the cookie
    return generateCsrfToken();
  }
  
  return generateCsrfToken();
}

/**
 * Validate CSRF token from request
 */
export async function validateCsrfToken(req: Request): Promise<boolean> {
  // Get token from header or body
  let token = req.headers.get(CSRF_HEADER_NAME);
  
  if (!token) {
    // Try to get from form body
    try {
      const contentType = req.headers.get('content-type') ?? '';
      
      if (contentType.includes('application/json')) {
        const body = await req.clone().json();
        token = body[CSRF_FORM_FIELD];
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const body = await req.clone().formData();
        token = body.get(CSRF_FORM_FIELD) as string;
      }
    } catch {
      // Ignore parsing errors
    }
  }
  
  if (!token) {
    return false;
  }
  
  // Get hash from cookie
  const cookieStore = await cookies();
  const storedHash = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  
  if (!storedHash) {
    return false;
  }
  
  // Compare hashes
  const tokenHash = await hashToken(token);
  return timingSafeEqual(tokenHash, storedHash);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// ============================================================================
// Double Submit Cookie Pattern
// ============================================================================

/**
 * Alternative: Double submit cookie pattern
 * Sets both a cookie and returns a token that must match
 */
export async function createDoubleSubmitToken(): Promise<string> {
  const token = generateRandomToken();
  
  const cookieStore = await cookies();
  cookieStore.set(`${CSRF_COOKIE_NAME}_double`, token, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_MAX_AGE,
    path: '/',
  });
  
  return token;
}

/**
 * Validate double submit token
 */
export async function validateDoubleSubmitToken(req: Request): Promise<boolean> {
  // Get token from header
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  
  if (!headerToken) {
    return false;
  }
  
  // Get token from cookie
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(`${CSRF_COOKIE_NAME}_double`)?.value;
  
  if (!cookieToken) {
    return false;
  }
  
  return timingSafeEqual(headerToken, cookieToken);
}

// ============================================================================
// Middleware Helper
// ============================================================================

export interface CsrfOptions {
  /** Cookie name */
  cookieName?: string;
  /** Header name */
  headerName?: string;
  /** Form field name */
  formField?: string;
  /** Methods to protect */
  methods?: string[];
  /** Paths to exclude */
  excludePaths?: string[];
}

const DEFAULT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * CSRF protection middleware for API routes
 */
export function withCsrfProtection(
  handler: (req: Request) => Promise<Response>,
  options: CsrfOptions = {}
) {
  const {
    methods = DEFAULT_METHODS,
    excludePaths = [],
  } = options;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    
    // Skip excluded paths
    if (excludePaths.some(path => url.pathname.startsWith(path))) {
      return handler(req);
    }
    
    // Skip safe methods
    if (!methods.includes(req.method)) {
      return handler(req);
    }
    
    // Validate CSRF token
    const isValid = await validateCsrfToken(req);
    
    if (!isValid) {
      return new Response(
        JSON.stringify({
          error: 'CSRF_VALIDATION_FAILED',
          message: 'Invalid or missing CSRF token',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    return handler(req);
  };
}

// ============================================================================
// React Hook for Client-Side
// ============================================================================

/**
 * Client-side token storage
 * Use this in a context provider
 */
export class CsrfTokenStore {
  private token: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    this.refreshPromise = this.fetchToken();
    this.token = await this.refreshPromise;
    this.refreshPromise = null;
    
    return this.token;
  }

  private async fetchToken(): Promise<string> {
    const response = await fetch('/api/csrf', {
      method: 'GET',
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    const data = await response.json();
    return data.token;
  }

  clearToken(): void {
    this.token = null;
  }
}

// ============================================================================
// Fetch Wrapper with CSRF
// ============================================================================

/**
 * Fetch wrapper that automatically includes CSRF token
 */
export function createCsrfFetch(tokenStore: CsrfTokenStore) {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const method = options.method?.toUpperCase() ?? 'GET';
    
    // Only add CSRF for mutating methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const token = await tokenStore.getToken();
      
      const headers = new Headers(options.headers);
      headers.set(CSRF_HEADER_NAME, token);
      
      return fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
    }
    
    return fetch(url, options);
  };
}

// ============================================================================
// API Route Handler
// ============================================================================

/**
 * API route to get CSRF token
 * Add this at /api/csrf/route.ts
 */
export async function handleCsrfRequest(): Promise<Response> {
  const token = await getCsrfToken();
  
  return new Response(
    JSON.stringify({ token }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// ============================================================================
// Exports
// ============================================================================

export {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_FORM_FIELD,
  TOKEN_LENGTH,
  TOKEN_MAX_AGE,
};
