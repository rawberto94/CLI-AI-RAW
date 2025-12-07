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
const RATE_LIMIT_MAX = 100; // requests per window for general users

// Tiered rate limits by endpoint type and user role
const RATE_LIMITS: Record<string, { anonymous: number; user: number; admin: number }> = {
  'ai': { anonymous: 10, user: 50, admin: 200 },       // AI endpoints are expensive
  'upload': { anonymous: 5, user: 20, admin: 100 },   // Upload endpoints
  'export': { anonymous: 5, user: 30, admin: 100 },   // Export endpoints
  'contracts': { anonymous: 50, user: 200, admin: 500 }, // Contract CRUD
  'default': { anonymous: 50, user: 100, admin: 300 }, // Default limits
};

function getEndpointCategory(pathname: string): string {
  if (pathname.includes('/ai/')) return 'ai';
  if (pathname.includes('/upload')) return 'upload';
  if (pathname.includes('/export')) return 'export';
  if (pathname.includes('/contracts')) return 'contracts';
  return 'default';
}

function getRateLimit(pathname: string, role?: string): number {
  const category = getEndpointCategory(pathname);
  const limits = RATE_LIMITS[category] ?? RATE_LIMITS.default;
  
  if (role === 'admin' || role === 'owner') return limits?.admin ?? 300;
  if (role) return limits?.user ?? 100;
  return limits?.anonymous ?? 50;
}

function checkRateLimit(identifier: string, maxRequests?: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  const limit = maxRequests || RATE_LIMIT_MAX;
  
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: limit - 1 };
  }
  
  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }
  
  return { allowed: true, remaining: limit - entry.count };
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
  "/api/cron", // Allow cron endpoints (protected by CRON_SECRET)
  "/api/ai", // Allow AI chat endpoints
  "/api/events", // Allow SSE endpoint for real-time updates
  "/api/contracts", // Allow contract endpoints (includes artifact streams)
  "/api/dashboard/stats", // Allow dashboard stats for testing
  "/api/dashboard/renewals", // Allow dashboard renewals for testing
  "/api/renewals", // Allow renewals for testing
  "/api/approvals", // Allow approvals for testing
  "/api/governance", // Allow governance for testing
  "/api/intelligence", // Allow intelligence for testing
  "/api/workflows", // Allow workflows for testing
  "/api/sharing", // Allow sharing for testing
];

// Routes that require admin or owner role
const adminRoutes = [
  "/admin",
  "/api/admin",
  "/platform",
  "/api/platform",
];

// Check if user has admin permissions
function hasAdminAccess(role: string | undefined): boolean {
  return role === "owner" || role === "admin";
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rate limiting for API routes with tiered limits
  if (pathname.startsWith("/api/")) {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0] ?? 'unknown';
    const userId = req.auth?.user?.id;
    const tenantId = req.auth?.user?.tenantId;
    const userRole = (req.auth?.user as any)?.role;
    
    // Use tenant+user for rate limit grouping (per-tenant limits)
    const identifier = tenantId 
      ? `tenant:${tenantId}:${userId || ip}`
      : userId || `ip:${ip}`;
    
    // Get dynamic rate limit based on endpoint and role
    const maxRequests = getRateLimit(pathname, userRole);
    
    const rateLimit = checkRateLimit(identifier, maxRequests);
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

  // Check admin route access
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    const userRole = (req.auth.user as any)?.role;
    if (!hasAdminAccess(userRole)) {
      // Return 403 for API routes, redirect for pages
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden", message: "Admin access required" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Production mode: Require tenant ID
  const requireAuth = process.env.REQUIRE_AUTH === "true";
  if (requireAuth && !req.auth.user?.tenantId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Tenant ID required" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/auth/signin", req.url));
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
