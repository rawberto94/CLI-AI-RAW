/**
 * Next.js Middleware
 * 
 * Applies global middleware to all requests:
 * - Security headers
 * - Rate limiting (optional, can be enabled per route)
 */

import { NextRequest, NextResponse } from 'next/server';
// import { applySecurityHeaders } from '@/lib/middleware/security-headers.middleware';

// Force nodejs runtime to avoid edge runtime issues with CommonJS modules
export const runtime = 'nodejs';

export function middleware(request: NextRequest) {
  // Create response - temporarily disabled security headers due to edge runtime issues
  const response = NextResponse.next();

  // Apply basic security headers inline
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  
  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
