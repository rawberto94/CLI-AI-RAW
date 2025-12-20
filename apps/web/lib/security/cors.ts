/**
 * CORS Utility
 * 
 * Provides consistent CORS handling across API routes.
 * Uses CORS_ALLOWED_ORIGINS environment variable in production.
 */

import { NextRequest, NextResponse } from 'next/server';

// Get allowed origins from environment or use defaults
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim());
  }
  
  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    return ['http://localhost:3000', 'http://localhost:3005', 'http://127.0.0.1:3000'];
  }
  
  // In production with no config, be restrictive
  return [];
};

/**
 * Check if origin is allowed for CORS
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  
  const allowedOrigins = getAllowedOrigins();
  
  // In development, allow all if no specific origins configured
  if (process.env.NODE_ENV === 'development' && allowedOrigins.length === 0) {
    return true;
  }
  
  return allowedOrigins.includes(origin);
}

/**
 * Get the CORS origin header value
 * Returns the request origin if allowed, otherwise null
 */
export function getCorsOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  
  // In development, be permissive
  if (process.env.NODE_ENV === 'development') {
    return origin || '*';
  }
  
  // In production, only return if origin is allowed
  if (origin && isOriginAllowed(origin)) {
    return origin;
  }
  
  return null;
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(
  response: NextResponse,
  request: NextRequest,
  methods: string = 'GET, POST, PUT, DELETE, OPTIONS'
): NextResponse {
  const corsOrigin = getCorsOrigin(request);
  
  if (corsOrigin) {
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Methods', methods);
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id, x-data-mode, x-request-id');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
  
  return response;
}

/**
 * Create an OPTIONS response for CORS preflight
 */
export function corsOptionsResponse(
  request: NextRequest,
  methods: string = 'GET, POST, PUT, DELETE, OPTIONS'
): NextResponse {
  const corsOrigin = getCorsOrigin(request);
  
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin || '',
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id, x-data-mode, x-request-id',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * CORS middleware for API routes
 * Use in OPTIONS handlers and wrap responses
 */
export const cors = {
  isOriginAllowed,
  getCorsOrigin,
  addCorsHeaders,
  optionsResponse: corsOptionsResponse,
};

export default cors;
