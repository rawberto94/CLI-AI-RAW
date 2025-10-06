/**
 * Next.js Middleware
 * Implements response compression and caching headers
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add caching headers for static assets
  if (request.nextUrl.pathname.startsWith('/_next/static')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Add caching headers for API responses
  if (request.nextUrl.pathname.startsWith('/api')) {
    const url = request.nextUrl.pathname;
    
    // Cache GET requests for specific endpoints
    if (request.method === 'GET') {
      if (url.includes('/contracts/') && !url.includes('/status')) {
        response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      } else if (url.includes('/rate-cards')) {
        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      } else if (url.includes('/search')) {
        response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      }
    }
  }

  // Add compression hint
  response.headers.set('Accept-Encoding', 'gzip, deflate, br');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/image|favicon.ico).*)',
  ],
};
