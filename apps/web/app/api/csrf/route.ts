/**
 * CSRF Token API Endpoint
 * 
 * Issues CSRF tokens for client-side protection.
 * Tokens are set as cookies and must be included in request headers.
 * 
 * NOTE: This route does NOT require authentication. The CSRF token must be
 * obtainable before or during login so that subsequent mutation requests
 * (which ARE auth-protected) can include the token in headers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { setCSRFCookie } from '@/lib/csrf';
import { getPublicApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = getPublicApiContext(request);
  try {
    // Optionally bind token to user if authenticated
    let userId: string | undefined;
    try {
      const session = await getServerSession();
      userId = session?.user?.id;
    } catch {
      // Not authenticated — that's fine, issue an unbound token
    }
    
    // Generate and set CSRF token cookie
    const token = await setCSRFCookie(userId);
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours, matches cookie/middleware expiry
    
    return createSuccessResponse(ctx, { token, expiresAt }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    logger.error('CSRF token generation failed:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate CSRF token', 500);
  }
}
