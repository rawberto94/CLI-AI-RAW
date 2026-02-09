/**
 * CSRF Protection (Server-only)
 * 
 * Provides CSRF token generation and validation for state-changing operations.
 * Uses the Double Submit Cookie pattern for stateless CSRF protection.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { CSRF_CONSTANTS } from './csrf-constants';

const CSRF_TOKEN_NAME = CSRF_CONSTANTS.TOKEN_NAME;
const CSRF_HEADER_NAME = CSRF_CONSTANTS.HEADER_NAME;
const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

interface CSRFTokenPayload {
  token: string;
  timestamp: number;
  userId?: string;
}

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Create a signed CSRF token with timestamp
 */
export function createSignedToken(userId?: string): string {
  const payload: CSRFTokenPayload = {
    token: generateCSRFToken(),
    timestamp: Date.now(),
    userId,
  };
  
  const secret = process.env.NEXTAUTH_SECRET || process.env.CSRF_SECRET;
  if (!secret) {
    throw new Error('CSRF_SECRET or NEXTAUTH_SECRET must be set');
  }
  
  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');
  
  return Buffer.from(`${data}.${signature}`).toString('base64');
}

/**
 * Verify a signed CSRF token
 */
export function verifySignedToken(token: string, userId?: string): boolean {
  try {
    const secret = process.env.NEXTAUTH_SECRET || process.env.CSRF_SECRET;
    if (!secret) return false;
    
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [data, signature] = decoded.split('.');
    
    if (!data || !signature) return false;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return false;
    }
    
    // Verify payload
    const payload: CSRFTokenPayload = JSON.parse(data);
    
    // Check expiry
    if (Date.now() - payload.timestamp > CSRF_TOKEN_EXPIRY) {
      return false;
    }
    
    // Check user binding if provided
    if (userId && payload.userId && payload.userId !== userId) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Set CSRF token in cookie (for client to read)
 */
export async function setCSRFCookie(userId?: string): Promise<string> {
  const token = createSignedToken(userId);
  const cookieStore = await cookies();
  
  cookieStore.set(CSRF_TOKEN_NAME, token, {
    httpOnly: false, // Client needs to read this
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
  });
  
  return token;
}

/**
 * Get CSRF token from cookie
 */
export async function getCSRFTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value;
}

/**
 * Validate CSRF token from request
 * Compares header token with cookie token
 */
export async function validateCSRFToken(
  request: NextRequest,
  userId?: string
): Promise<{ valid: boolean; error?: string }> {
  // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(request.method)) {
    return { valid: true };
  }
  
  // Get token from header
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) {
    return { valid: false, error: 'Missing CSRF token header' };
  }
  
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_TOKEN_NAME)?.value;
  if (!cookieToken) {
    return { valid: false, error: 'Missing CSRF token cookie' };
  }
  
  // Tokens must match (double submit pattern)
  if (headerToken !== cookieToken) {
    return { valid: false, error: 'CSRF token mismatch' };
  }
  
  // Verify token signature and expiry
  if (!verifySignedToken(headerToken, userId)) {
    return { valid: false, error: 'Invalid or expired CSRF token' };
  }
  
  return { valid: true };
}

/**
 * CSRF middleware for API routes
 */
export function withCSRFProtection(
  handler: (request: NextRequest, context: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context: any): Promise<NextResponse> => {
    // Skip for public API routes
    const publicRoutes = ['/api/auth', '/api/health', '/api/monitoring/health', '/api/webhooks'];
    const isPublicRoute = publicRoutes.some(route => 
      request.nextUrl.pathname.startsWith(route)
    );
    
    if (isPublicRoute) {
      return handler(request, context);
    }
    
    const validation = await validateCSRFToken(request);
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'CSRF validation failed', 
          message: validation.error,
          code: 'CSRF_INVALID'
        },
        { status: 403 }
      );
    }
    
    return handler(request, context);
  };
}

/**
 * React hook helper - returns CSRF token for forms
 */
export function getCSRFHeaders(token: string): Record<string, string> {
  return {
    [CSRF_HEADER_NAME]: token,
  };
}

// Re-export constants for backwards compatibility (server-side only)
export { CSRF_CONSTANTS } from './csrf-constants';
