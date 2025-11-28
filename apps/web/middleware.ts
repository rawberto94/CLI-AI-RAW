/**
 * Next.js Middleware with NextAuth v5
 * 
 * Applies global middleware to all requests:
 * - Authentication check
 * - Rate limiting
 * - Security headers
 * - Tenant ID injection
 */

export const runtime = 'nodejs'; // Force nodejs runtime for middleware

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Rate limiting configuration (in-memory for middleware)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Paths that don't require authentication
const publicPaths = [
  "/auth/signin",
  "/auth/signup", 
  "/auth/error",
  "/api/auth",
  "/upload", // Allow upload page for testing
  "/test-upload", // Allow test upload page
  "/contracts", // Allow contracts pages for development
];

// API routes that don't require authentication  
const publicApiPaths = [
  "/api/health",
  "/api/healthz",
  "/api/web-health",
  "/api/auth",
  "/api/events", // Allow SSE endpoint for real-time updates
  "/api/contracts", // Allow contract endpoints (includes artifact streams)
  "/api/dashboard/stats", // Allow dashboard stats for testing (remove in production if needed)
  "/api/dashboard/renewals", // Allow dashboard renewals for testing
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0] ?? 'unknown';
    const userId = req.auth?.user?.id;
    const identifier = userId || `ip:${ip}`;
    
    const rateLimit = checkRateLimit(identifier);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
          },
        }
      );
    }
  }

  // Allow public paths
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow public API paths
  if (publicApiPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check if user is authenticated
  if (!req.auth) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Add tenant ID and user ID to headers for API routes
  if (pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(req.headers);
    if (req.auth.user?.tenantId) {
      requestHeaders.set("x-tenant-id", req.auth.user.tenantId);
    }
    if (req.auth.user?.id) {
      requestHeaders.set("x-user-id", req.auth.user.id);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Apply security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');

  return response;
});

// Configure which routes require authentication
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
