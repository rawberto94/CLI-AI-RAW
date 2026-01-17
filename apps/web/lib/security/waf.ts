/**
 * Web Application Firewall (WAF) Middleware
 *
 * Protects against common web attacks:
 * - SQL Injection
 * - XSS (Cross-Site Scripting)
 * - Path Traversal
 * - Command Injection
 * - SSRF (Server-Side Request Forgery)
 * - Header Injection
 * - XML/XXE attacks
 *
 * @example
 * // In middleware.ts
 * import { wafMiddleware } from '@/lib/security/waf';
 *
 * export async function middleware(request: NextRequest) {
 *   const wafResult = await wafMiddleware(request);
 *   if (wafResult.blocked) {
 *     return wafResult.response;
 *   }
 *   // Continue normal processing...
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditLog, AuditAction } from './audit';

// ============================================================================
// Types
// ============================================================================

export interface WAFConfig {
  /** Enable/disable WAF */
  enabled: boolean;
  /** Block or just log */
  mode: 'block' | 'detect';
  /** IP whitelist (bypass WAF) */
  ipWhitelist: string[];
  /** Path whitelist (bypass WAF) */
  pathWhitelist: string[];
  /** Custom rules */
  customRules?: WAFRule[];
  /** Rate limit settings */
  rateLimit?: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
}

export interface WAFRule {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (request: NextRequest, body?: string) => boolean;
  message: string;
}

export interface WAFResult {
  blocked: boolean;
  reason?: string;
  ruleId?: string;
  response?: NextResponse;
}

// ============================================================================
// Attack Detection Patterns
// ============================================================================

const PATTERNS = {
  // SQL Injection patterns
  sqlInjection: [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /union.+select/i,
    /select.+from/i,
    /insert.+into/i,
    /delete.+from/i,
    /drop.+table/i,
    /update.+set/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /INFORMATION_SCHEMA/i,
    /sys(tables|columns|objects)/i,
    /0x[0-9a-f]+/i,
    /char\s*\(/i,
    /concat\s*\(/i,
    /benchmark\s*\(/i,
    /sleep\s*\(/i,
    /waitfor\s+delay/i,
  ],

  // XSS patterns
  xss: [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi, // onclick=, onerror=, etc.
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
    /<link[^>]*>/gi,
    /<meta[^>]*>/gi,
    /<base[^>]*>/gi,
    /<form[^>]*>/gi,
    /expression\s*\(/gi,
    /url\s*\(/gi,
    /&#x?[0-9a-f]+;?/gi, // HTML entities
    /%3C/gi, // < encoded
    /%3E/gi, // > encoded
    /data:/gi,
  ],

  // Path traversal patterns
  pathTraversal: [
    /\.\.\//g,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
    /\.\.\\+/g,
    /%2e%2e%2f/gi,
    /%2e%2e\//gi,
    /\.%2e\//gi,
    /%2e\.\//gi,
    /etc\/passwd/gi,
    /etc\/shadow/gi,
    /proc\/self/gi,
    /windows\/system32/gi,
    /boot\.ini/gi,
  ],

  // Command injection patterns
  commandInjection: [
    /[;&|`$]/,
    /\$\([^)]+\)/,
    /`[^`]+`/,
    /\|\s*\w+/,
    /;\s*\w+/,
    /&&\s*\w+/,
    /\|\|\s*\w+/,
    />\s*\/\w+/,
    /<\s*\/\w+/,
    /\beval\s*\(/i,
    /\bexec\s*\(/i,
    /\bsystem\s*\(/i,
    /\bpopen\s*\(/i,
    /\bpassthru\s*\(/i,
    /\bshell_exec\s*\(/i,
    /\/bin\/(bash|sh|zsh|ksh|csh)/i,
    /\bwget\s+/i,
    /\bcurl\s+/i,
    /\bnc\s+/i,
  ],

  // SSRF patterns
  ssrf: [
    /^https?:\/\/localhost/i,
    /^https?:\/\/127\./i,
    /^https?:\/\/0\.0\.0\.0/i,
    /^https?:\/\/\[::1\]/i,
    /^https?:\/\/10\./i,
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./i,
    /^https?:\/\/192\.168\./i,
    /^https?:\/\/169\.254\./i,
    /^file:\/\//i,
    /^gopher:\/\//i,
    /^dict:\/\//i,
    /^ftp:\/\//i,
    /^ldap:\/\//i,
    /metadata\.google/i,
    /169\.254\.169\.254/i, // AWS metadata
    /metadata\.azure/i,
  ],

  // Header injection patterns
  headerInjection: [
    /\r\n/,
    /\r/,
    /\n/,
    /%0d/gi,
    /%0a/gi,
    /%0D/gi,
    /%0A/gi,
  ],

  // XML/XXE patterns
  xxe: [
    /<!DOCTYPE[^>]*\[/i,
    /<!ENTITY/i,
    /SYSTEM\s+["']/i,
    /PUBLIC\s+["']/i,
  ],

  // Log injection patterns
  logInjection: [
    /\n.*\[/,
    /\r.*\[/,
  ],

  // Protocol abuse
  protocolAbuse: [
    /^(javascript|vbscript|data|file):/i,
  ],
};

// ============================================================================
// Default WAF Rules
// ============================================================================

const DEFAULT_RULES: WAFRule[] = [
  {
    id: 'SQL-001',
    name: 'SQL Injection',
    description: 'Detects SQL injection attempts in request parameters',
    severity: 'critical',
    check: (req, body) => {
      const url = req.url;
      const searchParams = new URL(url).searchParams.toString();
      const content = `${searchParams} ${body || ''}`;

      return PATTERNS.sqlInjection.some((pattern) => pattern.test(content));
    },
    message: 'Potential SQL injection detected',
  },
  {
    id: 'XSS-001',
    name: 'Cross-Site Scripting',
    description: 'Detects XSS attempts in request parameters',
    severity: 'high',
    check: (req, body) => {
      const url = req.url;
      const searchParams = new URL(url).searchParams.toString();
      const content = `${searchParams} ${body || ''}`;

      return PATTERNS.xss.some((pattern) => pattern.test(content));
    },
    message: 'Potential XSS attack detected',
  },
  {
    id: 'PATH-001',
    name: 'Path Traversal',
    description: 'Detects directory traversal attempts',
    severity: 'high',
    check: (req, body) => {
      const url = req.url;
      const path = new URL(url).pathname;
      const searchParams = new URL(url).searchParams.toString();
      const content = `${path} ${searchParams} ${body || ''}`;

      return PATTERNS.pathTraversal.some((pattern) => pattern.test(content));
    },
    message: 'Potential path traversal attack detected',
  },
  {
    id: 'CMD-001',
    name: 'Command Injection',
    description: 'Detects command injection attempts',
    severity: 'critical',
    check: (req, body) => {
      const url = req.url;
      const searchParams = new URL(url).searchParams.toString();
      const content = `${searchParams} ${body || ''}`;

      // Only check in certain contexts (query params, form data)
      return (
        PATTERNS.commandInjection.some((pattern) => pattern.test(content)) &&
        !content.includes('SELECT') // Reduce false positives with SQL
      );
    },
    message: 'Potential command injection detected',
  },
  {
    id: 'SSRF-001',
    name: 'Server-Side Request Forgery',
    description: 'Detects SSRF attempts via URL parameters',
    severity: 'critical',
    check: (req, body) => {
      const url = req.url;
      const searchParams = new URL(url).searchParams.toString();
      const content = `${searchParams} ${body || ''}`;

      // Look for URLs in content
      const urlPattern = /https?:\/\/[^\s"'<>]+/gi;
      const urls = content.match(urlPattern) || [];

      return urls.some((foundUrl) =>
        PATTERNS.ssrf.some((pattern) => pattern.test(foundUrl))
      );
    },
    message: 'Potential SSRF attack detected',
  },
  {
    id: 'HDR-001',
    name: 'Header Injection',
    description: 'Detects HTTP header injection attempts',
    severity: 'medium',
    check: (req, body) => {
      // Check URL for header injection
      const url = req.url;
      return PATTERNS.headerInjection.some((pattern) => pattern.test(url));
    },
    message: 'Potential header injection detected',
  },
  {
    id: 'XXE-001',
    name: 'XML External Entity',
    description: 'Detects XXE attacks in XML content',
    severity: 'critical',
    check: (req, body) => {
      if (!body) return false;
      const contentType = req.headers.get('content-type') || '';

      // Only check XML content
      if (!contentType.includes('xml')) return false;

      return PATTERNS.xxe.some((pattern) => pattern.test(body));
    },
    message: 'Potential XXE attack detected',
  },
  {
    id: 'PROTO-001',
    name: 'Protocol Abuse',
    description: 'Detects dangerous protocol usage',
    severity: 'high',
    check: (req, body) => {
      const url = req.url;
      const searchParams = new URL(url).searchParams.toString();
      const content = `${searchParams} ${body || ''}`;

      return PATTERNS.protocolAbuse.some((pattern) => pattern.test(content));
    },
    message: 'Dangerous protocol usage detected',
  },
  {
    id: 'SIZE-001',
    name: 'Request Size Limit',
    description: 'Blocks oversized requests',
    severity: 'medium',
    check: (req, body) => {
      const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
      const maxSize = 50 * 1024 * 1024; // 50MB
      return contentLength > maxSize;
    },
    message: 'Request size exceeds limit',
  },
  {
    id: 'UA-001',
    name: 'Suspicious User Agent',
    description: 'Blocks known malicious user agents',
    severity: 'low',
    check: (req) => {
      const userAgent = req.headers.get('user-agent') || '';
      const suspiciousAgents = [
        /sqlmap/i,
        /nikto/i,
        /nessus/i,
        /openvas/i,
        /nmap/i,
        /masscan/i,
        /zmap/i,
        /gobuster/i,
        /dirbuster/i,
        /wfuzz/i,
        /burpsuite/i,
        /havij/i,
        /arachni/i,
      ];

      return suspiciousAgents.some((pattern) => pattern.test(userAgent));
    },
    message: 'Suspicious user agent detected',
  },
];

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: WAFConfig = {
  enabled: true,
  mode: 'block',
  ipWhitelist: [],
  pathWhitelist: [
    '/_next/static',
    '/favicon.ico',
    '/api/health',
    '/api/webhooks', // Webhooks might have special content
  ],
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000, // 1 minute
  },
};

// ============================================================================
// In-Memory Rate Limiter (for WAF)
// ============================================================================

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  ip: string,
  config: NonNullable<WAFConfig['rateLimit']>
): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  record.count++;
  return record.count <= config.maxRequests;
}

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60000);

// ============================================================================
// WAF Middleware
// ============================================================================

let wafConfig = { ...DEFAULT_CONFIG };

/**
 * Configure WAF settings
 */
export function configureWAF(config: Partial<WAFConfig>): void {
  wafConfig = { ...wafConfig, ...config };
}

/**
 * Get client IP from request
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    // request.ip is not available on NextRequest in all environments
    'unknown'
  );
}

/**
 * Main WAF middleware function
 */
export async function wafMiddleware(
  request: NextRequest,
  config: Partial<WAFConfig> = {}
): Promise<WAFResult> {
  const mergedConfig = { ...wafConfig, ...config };

  // Check if WAF is enabled
  if (!mergedConfig.enabled) {
    return { blocked: false };
  }

  const ip = getClientIP(request);
  const path = new URL(request.url).pathname;

  // Check IP whitelist
  if (mergedConfig.ipWhitelist.includes(ip)) {
    return { blocked: false };
  }

  // Check path whitelist
  if (mergedConfig.pathWhitelist.some((p) => path.startsWith(p))) {
    return { blocked: false };
  }

  // Check rate limit
  if (mergedConfig.rateLimit?.enabled) {
    const withinLimit = checkRateLimit(ip, mergedConfig.rateLimit);
    if (!withinLimit) {
      await logWAFBlock(request, 'RATE-001', 'Rate limit exceeded');

      if (mergedConfig.mode === 'block') {
        return {
          blocked: true,
          reason: 'Rate limit exceeded',
          ruleId: 'RATE-001',
          response: new NextResponse(
            JSON.stringify({ error: 'Too many requests' }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60',
              },
            }
          ),
        };
      }
    }
  }

  // Get request body for POST/PUT/PATCH
  let body: string | undefined;
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    try {
      // Clone request to read body without consuming it
      const clonedRequest = request.clone();
      body = await clonedRequest.text();
    } catch {
      // Ignore body read errors
    }
  }

  // Run all rules
  const allRules = [...DEFAULT_RULES, ...(mergedConfig.customRules || [])];

  for (const rule of allRules) {
    try {
      const matches = rule.check(request, body);

      if (matches) {
        await logWAFBlock(request, rule.id, rule.message, rule.severity);

        if (mergedConfig.mode === 'block') {
          return {
            blocked: true,
            reason: rule.message,
            ruleId: rule.id,
            response: new NextResponse(
              JSON.stringify({
                error: 'Request blocked by security policy',
                code: rule.id,
              }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              }
            ),
          };
        }
      }
    } catch {
      // Rule evaluation error - continue with other rules
    }
  }

  return { blocked: false };
}

/**
 * Log WAF blocks to audit log
 */
async function logWAFBlock(
  request: NextRequest,
  ruleId: string,
  message: string,
  severity?: string
): Promise<void> {
  try {
    await auditLog({
      action: AuditAction.SUSPICIOUS_ACTIVITY,
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
      metadata: {
        ruleId,
        message,
        severity,
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
      },
      success: false,
      errorMessage: message,
    });
  } catch {
    // Don't fail request if audit logging fails
  }
}

// ============================================================================
// Helper: Create security headers
// ============================================================================

export function getSecurityHeaders(): Record<string, string> {
  return {
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // XSS protection
    'X-XSS-Protection': '1; mode=block',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=()',

    // HSTS (1 year, include subdomains, preload)
    'Strict-Transport-Security':
      'max-age=31536000; includeSubDomains; preload',

    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust for your needs
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' wss: https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  };
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders();

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

// ============================================================================
// Exports
// ============================================================================

export { DEFAULT_RULES, PATTERNS };
// Types are already exported at definition: WAFRule, WAFConfig, WAFResult
