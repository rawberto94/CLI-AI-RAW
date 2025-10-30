/**
 * Next.js Middleware
 * 
 * Applies global middleware to all requests:
 * - Security headers
 * - Rate limiting (optional, can be enabled per route)
 */

import { NextRequest, NextResponse } from 'next/server';
import { applySecurityHeaders } from '@/lib/middleware/security-headers.middleware';

export function middleware(request: NextRequest) {
  // Create response
  const response = NextResponse.next();

  // Apply security headers to all responses
  return applySecurityHeaders(response);
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
