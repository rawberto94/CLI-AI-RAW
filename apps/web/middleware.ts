/**
 * Next.js Middleware with NextAuth v5
 * 
 * Applies global middleware to all requests:
 * - Authentication check
 * - Rate limiting
 * - Security headers
 * - Tenant ID injection
 * - Request tracing (X-Request-ID)
 * - Performance timing
 */

// Using Node.js runtime for full Node.js API support
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createHmac, timingSafeEqual } from 'node:crypto';

// CSRF constants (inline to avoid server-only import chain)
const CSRF_TOKEN_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

// Safe HTTP methods that don't need CSRF validation
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// API routes exempt from CSRF enforcement
const CSRF_EXEMPT_PATHS = [
  '/api/auth/callback',      // NextAuth OAuth callbacks need to work without CSRF header
  '/api/auth/session',       // NextAuth session endpoint
  '/api/auth/csrf',          // NextAuth CSRF token endpoint  
  '/api/auth/signin',        // NextAuth signin handler
  '/api/auth/signout',       // NextAuth signout handler
  '/api/auth/providers',     // NextAuth providers list
  '/api/auth/error',         // NextAuth error handler
  '/api/auth/mfa',           // MFA verify during login (half-authenticated state)
  '/api/health',
  '/api/monitoring/health',
  '/api/webhooks',
  '/api/csrf',
  '/api/cron',
];

/**
 * Verify CSRF token signature and expiry (inline implementation)
 */
function verifyCSRFToken(token: string, userId?: string): boolean {
  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.CSRF_SECRET;
    if (!secret) return false;

    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const dotIndex = decoded.lastIndexOf('.');
    if (dotIndex === -1) return false;

    const data = decoded.substring(0, dotIndex);
    const signature = decoded.substring(dotIndex + 1);
    if (!data || !signature) return false;

    const expectedSignature = createHmac('sha256', secret)
      .update(data)
      .digest('hex');

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return false;
    }

    const payload = JSON.parse(data);
    if (Date.now() - payload.timestamp > CSRF_TOKEN_EXPIRY) return false;
    if (userId && payload.userId && payload.userId !== userId) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a unique request ID for tracing
 * Format: prefix_timestamp_random (e.g., req_1703097600000_a1b2c3d4)
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `req_${timestamp}_${random}`;
}

// Rate limiting configuration
// Uses Redis for multi-instance deployments; falls back to in-memory
const RATE_LIMIT_WINDOW = 60; // 1 minute (seconds for Redis TTL)
const RATE_LIMIT_MAX = 100; // requests per window for general users
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000;
const RATE_LIMIT_MAX_ENTRIES = 10000;

// In-memory fallback store (used when Redis is unavailable)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = Date.now();
function cleanupRateLimitStore() {
  const now = Date.now();
  if (now - lastCleanup < RATE_LIMIT_CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
  if (rateLimitStore.size > RATE_LIMIT_MAX_ENTRIES) {
    const excess = rateLimitStore.size - RATE_LIMIT_MAX_ENTRIES;
    const keys = rateLimitStore.keys();
    for (let i = 0; i < excess; i++) {
      const { value } = keys.next();
      if (value) rateLimitStore.delete(value);
    }
  }
}

// Redis rate limiter — lazy-initialized singleton
let redisClient: import('ioredis').default | null = null;
let redisUnavailable = false;

async function getRedisClient(): Promise<import('ioredis').default | null> {
  if (redisUnavailable) return null;
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    redisUnavailable = true;
    return null;
  }

  try {
    const Redis = (await import('ioredis')).default;
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    await redisClient.connect();
    redisClient.on('error', () => {
      // Silently degrade to in-memory on connection loss
      redisUnavailable = true;
      redisClient = null;
    });
    return redisClient;
  } catch {
    redisUnavailable = true;
    return null;
  }
}

async function checkRateLimitRedis(
  identifier: string,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number } | null> {
  const redis = await getRedisClient();
  if (!redis) return null; // Signal caller to use fallback

  try {
    const key = `rl:${identifier}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }
    const allowed = current <= maxRequests;
    return { allowed, remaining: Math.max(0, maxRequests - current) };
  } catch {
    return null; // Fallback to in-memory
  }
}

function checkRateLimitMemory(identifier: string, maxRequests: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  const limit = maxRequests || RATE_LIMIT_MAX;

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - entry.count };
}

async function checkRateLimit(
  identifier: string,
  maxRequests?: number
): Promise<{ allowed: boolean; remaining: number }> {
  const limit = maxRequests || RATE_LIMIT_MAX;
  // Try Redis first, fall back to in-memory
  const redisResult = await checkRateLimitRedis(identifier, limit);
  if (redisResult) return redisResult;
  return checkRateLimitMemory(identifier, limit);
}

// Tiered rate limits by endpoint type and user role
const RATE_LIMITS: Record<string, { anonymous: number; user: number; admin: number }> = {
  'auth': { anonymous: 10, user: 20, admin: 50 },      // M14: Strict auth rate limits
  'ai': { anonymous: 10, user: 50, admin: 200 },
  'upload': { anonymous: 5, user: 20, admin: 100 },
  'export': { anonymous: 5, user: 30, admin: 100 },
  'contracts': { anonymous: 50, user: 200, admin: 500 },
  'default': { anonymous: 50, user: 100, admin: 300 },
};

function getEndpointCategory(pathname: string): string {
  if (pathname.startsWith('/api/auth/')) return 'auth'; // M14: Auth-specific rate limits
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

// Paths that don't require authentication (only auth-related pages)
// IMPORTANT: Use exact paths or paths that won't prefix-match unrelated routes.
// "/" MUST be exact-matched to avoid matching every route.
const publicPaths = [
  "/about",         // About page
  "/pricing",       // Pricing page
  "/features",      // Features page
  "/contact",       // Contact page
  "/auth/signin",
  "/auth/signup", 
  "/auth/error",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/auth/mfa-verify",   // MFA verification page (user is half-authenticated)
  "/api/auth",
];

// Exact-match paths (no prefix matching)
const publicExactPaths = new Set([
  "/",              // Landing page only — must NOT prefix-match other routes
]);

// API routes that don't require authentication (health checks only)
const publicApiPaths = [
  "/api/health",
  "/api/monitoring/health",
  "/api/auth",
  "/api/cron", // Allow cron endpoints (protected by CRON_SECRET)
  "/api/csrf", // CSRF token must be obtainable before/during login
  "/api/taxonomy/presets", // Industry preset templates (read-only, public)
];

// Static/public assets that bypass auth
const staticPaths = [
  "/_next",
  "/favicon",
  "/icons",
  "/images",
  "/fonts",
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

export default auth(async (req) => {
  const { pathname } = req.nextUrl;
  const startTime = Date.now();
  
  // Generate or use existing request ID for tracing
  const requestId = req.headers.get('x-request-id') || generateRequestId();

  // Rate limiting for API routes with tiered limits
  // Skip rate limiting for NextAuth internal routes (session, csrf, callback, providers)
  // These are called multiple times per page load and during login flows
  const isNextAuthInternal = pathname.startsWith("/api/auth/");
  if (pathname.startsWith("/api/") && !isNextAuthInternal) {
    // Periodically prune expired entries
    cleanupRateLimitStore();
    
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
    
    const rateLimit = await checkRateLimit(identifier, maxRequests);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded', requestId },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(maxRequests), // M15: Show actual tiered limit, not global
            'X-RateLimit-Remaining': '0',
            'Retry-After': '60',
            'X-Request-ID': requestId,
          },
        }
      );
    }
  }

  // Helper to add tracing headers to responses
  const addTracingHeaders = (response: NextResponse): NextResponse => {
    response.headers.set('X-Request-ID', requestId);
    response.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
    // M10-M12 FIX: Apply security headers to ALL responses (API + pages)
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    // M11: HSTS — enforce HTTPS in production
    if (process.env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    // M12: Content-Security-Policy
    response.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));
    return response;
  };

  // Allow static assets
  if (staticPaths.some((path) => pathname.startsWith(path))) {
    return addTracingHeaders(NextResponse.next());
  }

  // Allow public paths (auth pages only)
  if (publicExactPaths.has(pathname) || publicPaths.some((path) => pathname.startsWith(path))) {
    return addTracingHeaders(NextResponse.next());
  }

  // Allow public API paths (health checks only)
  if (publicApiPaths.some((path) => pathname.startsWith(path))) {
    return addTracingHeaders(NextResponse.next());
  }

  // Check if user is authenticated - redirect to sign-in if not
  if (!req.auth) {
    // For API routes, return 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { error: "Unauthorized", message: "Authentication required", requestId },
        { status: 401 }
      );
      return addTracingHeaders(response);
    }
    // For pages, redirect to sign-in with callback URL
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // C1 FIX: MFA enforcement — redirect to MFA verify if required but not verified
  const mfaRequired = (req.auth.user as any)?.mfaRequired;
  const mfaVerified = (req.auth.user as any)?.mfaVerified;
  const mfaPendingPaths = ['/auth/mfa-verify', '/api/auth/mfa', '/api/auth/session', '/api/auth/signout', '/api/auth/csrf'];
  
  if (mfaRequired && !mfaVerified && !mfaPendingPaths.some(p => pathname.startsWith(p))) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { error: "MFA Required", message: "Multi-factor authentication verification required", code: "MFA_REQUIRED", requestId },
        { status: 403 }
      );
      return addTracingHeaders(response);
    }
    const mfaUrl = new URL("/auth/mfa-verify", req.url);
    mfaUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(mfaUrl);
  }

  // CSRF enforcement for state-changing API requests
  if (
    pathname.startsWith("/api/") &&
    !CSRF_SAFE_METHODS.has(req.method) &&
    !CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path))
  ) {
    const headerToken = req.headers.get(CSRF_HEADER_NAME);
    const cookieToken = req.cookies.get(CSRF_TOKEN_NAME)?.value;

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      const response = NextResponse.json(
        { error: "Forbidden", message: "CSRF validation failed", code: "CSRF_INVALID", requestId },
        { status: 403 }
      );
      return addTracingHeaders(response);
    }

    if (!verifyCSRFToken(headerToken, req.auth?.user?.id)) {
      const response = NextResponse.json(
        { error: "Forbidden", message: "Invalid or expired CSRF token", code: "CSRF_INVALID", requestId },
        { status: 403 }
      );
      return addTracingHeaders(response);
    }
  }

  // Check admin route access
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    // For /api/admin/* endpoints, check for Bearer token first
    if (pathname.startsWith("/api/admin")) {
      const authHeader = req.headers.get("authorization");
      const adminToken = process.env.ADMIN_API_TOKEN;

      // If admin token is configured, require it
      if (adminToken) {
        if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
          const response = NextResponse.json(
            {
              error: "Unauthorized",
              message: "Admin API token required. Provide Authorization: Bearer <token> header.",
              requestId,
            },
            { status: 401 }
          );
          return addTracingHeaders(response);
        }
        // Token valid, allow access
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set("x-request-id", requestId);
        if (req.auth.user?.tenantId) {
          requestHeaders.set("x-tenant-id", req.auth.user.tenantId);
        }
        if (req.auth.user?.id) {
          requestHeaders.set("x-user-id", req.auth.user.id);
        }
        const response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        return addTracingHeaders(response);
      }
    }

    // For /admin pages, check user role
    const userRole = (req.auth.user as any)?.role;
    if (!hasAdminAccess(userRole)) {
      // Return 403 for API routes, redirect for pages
      if (pathname.startsWith("/api/")) {
        const response = NextResponse.json(
          { error: "Forbidden", message: "Admin access required", requestId },
          { status: 403 }
        );
        return addTracingHeaders(response);
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Production mode: Require tenant ID
  const requireAuth = process.env.REQUIRE_AUTH === "true";
  if (requireAuth && !req.auth.user?.tenantId) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { error: "Unauthorized", message: "Tenant ID required", requestId },
        { status: 401 }
      );
      return addTracingHeaders(response);
    }
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  // Add tenant ID, user ID, and request ID to headers for API routes
  if (pathname.startsWith("/api/")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-request-id", requestId);
    if (req.auth.user?.tenantId) {
      requestHeaders.set("x-tenant-id", req.auth.user.tenantId);
    }
    if (req.auth.user?.id) {
      requestHeaders.set("x-user-id", req.auth.user.id);
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    return addTracingHeaders(response);
  }

  // Apply security headers to page responses
  const response = NextResponse.next();
  return addTracingHeaders(response);
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
