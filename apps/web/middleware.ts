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

import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { Redis } from "@upstash/redis";

// Edge-compatible auth wrapper (no Prisma/DB dependencies)
const { auth } = NextAuth(authConfig);

// Edge-compatible HMAC-SHA256 using Web Crypto API
async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Edge-compatible constant-time string comparison
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// CSRF constants (inline to avoid server-only import chain)
const CSRF_TOKEN_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_EXPIRY = 8 * 60 * 60 * 1000; // 8 hours — generous window for long onboarding sessions

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
  '/api/contracts/upload',   // File uploads use multipart/form-data (no CSRF token in body)
  '/api/agents/sse',           // Internal broadcast endpoint (auth-protected, no browser form)
];

/**
 * Verify CSRF token signature and expiry (Edge-compatible implementation)
 */
async function verifyCSRFToken(token: string, userId?: string): Promise<boolean> {
  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.CSRF_SECRET;
    if (!secret) return false;

    const decoded = atob(token);
    const dotIndex = decoded.lastIndexOf('.');
    if (dotIndex === -1) return false;

    const data = decoded.substring(0, dotIndex);
    const signature = decoded.substring(dotIndex + 1);
    if (!data || !signature) return false;

    const expectedSignature = await hmacSha256Hex(secret, data);

    if (!constantTimeEqual(signature, expectedSignature)) {
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
const RATE_LIMIT_MAX_ENTRIES = 1000;

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

// Upstash Redis REST client — Edge Runtime compatible (HTTP-based, no TCP)
let rateLimitRedis: Redis | null = null;
try {
  if (process.env.REDIS_URL && process.env.REDIS_TOKEN) {
    rateLimitRedis = new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    });
  }
} catch {
  // Redis init failed — will fall back to in-memory
}

async function checkRateLimitRedis(
  identifier: string,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number } | null> {
  if (!rateLimitRedis) return null;
  try {
    const key = `rl:${identifier}`;
    const count = await rateLimitRedis.incr(key);
    if (count === 1) {
      // First request in window — set TTL
      await rateLimitRedis.expire(key, RATE_LIMIT_WINDOW);
    }
    const remaining = Math.max(0, maxRequests - count);
    return { allowed: count <= maxRequests, remaining };
  } catch {
    // Redis error — fall back to in-memory
    return null;
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
  'upload': { anonymous: 15, user: 60, admin: 200 },
  'export': { anonymous: 5, user: 30, admin: 100 },
  'contracts': { anonymous: 50, user: 200, admin: 500 },
  'read': { anonymous: 100, user: 300, admin: 600 },    // Read-heavy polling endpoints
  'default': { anonymous: 50, user: 150, admin: 400 },
};

// Endpoints completely exempt from rate limiting (health checks, monitoring, SSE streams)
const RATE_LIMIT_EXEMPT = [
  '/api/health',
  '/api/monitoring/health',
  '/api/csrf',
];

// Patterns for SSE/streaming endpoints that have their own dedicated rate limiters
const RATE_LIMIT_EXEMPT_PATTERNS = [
  '/artifacts/stream',  // SSE stream endpoint has its own connection limiter
];

function getEndpointCategory(pathname: string): string {
  if (pathname.startsWith('/api/auth/')) return 'auth'; // M14: Auth-specific rate limits
  if (pathname.includes('/ai/')) return 'ai';
  if (pathname.includes('/upload')) return 'upload';
  if (pathname.includes('/export')) return 'export';
  if (pathname.includes('/extraction/')) return 'read';  // Polling endpoints
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
  // Only skip rate limiting for NextAuth's own internal routes (session, csrf, callback, providers)
  // Custom auth endpoints (addin-login, mfa/verify-login, signup, forgot-password) MUST be rate-limited
  const NEXTAUTH_INTERNAL_PREFIXES = [
    '/api/auth/session', '/api/auth/csrf', '/api/auth/providers',
    '/api/auth/callback', '/api/auth/signin', '/api/auth/signout',
    '/api/auth/error',
  ];
  const isNextAuthInternal = NEXTAUTH_INTERNAL_PREFIXES.some(p => pathname.startsWith(p));
  const isRateLimitExempt = RATE_LIMIT_EXEMPT.some(p => pathname.startsWith(p))
    || RATE_LIMIT_EXEMPT_PATTERNS.some(p => pathname.includes(p));
  if (pathname.startsWith("/api/") && !isNextAuthInternal && !isRateLimitExempt) {
    // Periodically prune expired entries
    cleanupRateLimitStore();
    
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0] ?? 'unknown';
    const userId = req.auth?.user?.id;
    const tenantId = req.auth?.user?.tenantId;
    const userRole = (req.auth?.user as any)?.role;
    
    // Use tenant+user+category for rate limit grouping (per-category, per-tenant limits)
    const category = getEndpointCategory(pathname);
    const baseId = tenantId 
      ? `tenant:${tenantId}:${userId || ip}`
      : userId || `ip:${ip}`;
    const identifier = `${category}:${baseId}`;
    
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
    // M12: Content-Security-Policy — defined in next.config.mjs headers(), not duplicated here
    // to avoid the middleware's version overriding the stricter config CSP
    return response;
  };

  // Allow static assets
  if (staticPaths.some((path) => pathname.startsWith(path))) {
    return addTracingHeaders(NextResponse.next());
  }

  // Allow public paths (auth pages only)
  if (publicExactPaths.has(pathname) || publicPaths.some((path) => pathname.startsWith(path))) {
    // Authenticated users hitting "/" should be redirected to /dashboard
    if (pathname === "/" && req.auth) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
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
  // Security: We verify the cryptographic HMAC signature on the token itself.
  // This is sufficient because only the server can sign valid tokens.
  // We intentionally do NOT compare header vs cookie (Double Submit pattern)
  // because that causes race conditions during token refresh in bulk uploads.
  //
  // File upload routes (multipart/form-data) are exempt because the global
  // fetch interceptor may fail to attach the CSRF cookie on some Azure
  // proxy/domain configurations. These routes are still protected by session auth.
  const isFileUploadRoute = pathname.includes('/signed-copy');
  const isCSRFExempt = CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path));

  // Diagnostic logging for upload requests
  if (pathname.includes('/upload') || pathname.includes('/contract')) {
    console.log(`[MW-DIAG] ${req.method} ${pathname} | auth=${!!req.auth} | userId=${req.auth?.user?.id || 'none'} | tenantId=${req.auth?.user?.tenantId || 'none'} | csrfExempt=${isCSRFExempt} | isFileUpload=${isFileUploadRoute} | reqId=${requestId}`);
  }

  if (
    pathname.startsWith("/api/") &&
    !CSRF_SAFE_METHODS.has(req.method) &&
    !isCSRFExempt &&
    !isFileUploadRoute
  ) {
    const headerToken = req.headers.get(CSRF_HEADER_NAME);

    if (!headerToken) {
      console.log(`[MW-DIAG] CSRF BLOCKED (missing) ${req.method} ${pathname} | reqId=${requestId}`);
      const response = NextResponse.json(
        { error: "Forbidden", message: "CSRF token missing", code: "CSRF_MISSING", requestId },
        { status: 403 }
      );
      return addTracingHeaders(response);
    }

    if (!(await verifyCSRFToken(headerToken, req.auth?.user?.id))) {
      console.log(`[MW-DIAG] CSRF BLOCKED (invalid) ${req.method} ${pathname} | reqId=${requestId}`);
      const response = NextResponse.json(
        { error: "Forbidden", message: "Invalid or expired CSRF token", code: "CSRF_EXPIRED", requestId },
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
    // ALWAYS set x-tenant-id from session (overwriting any client-sent value)
    // to prevent tenant mismatch between stale localStorage and auth session.
    // If session has no tenantId, clear any client-sent header to force API fallback.
    if (req.auth.user?.tenantId) {
      requestHeaders.set("x-tenant-id", req.auth.user.tenantId);
    } else {
      requestHeaders.delete("x-tenant-id");
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
     * - _dev-* (dev-mode asset prefix for cache busting)
     * - favicon.ico / favicon.svg
     * - Static assets (logo-*, grid.svg, etc.)
     * - public folder
     */
    "/((?!_next/static|_next/image|_dev-|favicon\\.ico|favicon\\.svg|logo-|grid\\.svg|public).*)",
  ],
};
