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

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
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
    await setCSRFCookie(userId);
    
    return NextResponse.json(
      { success: true, message: 'CSRF token set' },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('CSRF token generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
}
