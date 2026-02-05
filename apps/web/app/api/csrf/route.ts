/**
 * CSRF Token API Endpoint
 * 
 * Issues CSRF tokens for client-side protection.
 * Tokens are set as cookies and must be included in request headers.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { setCSRFCookie } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;
    
    // Generate and set CSRF token
    const _token = await setCSRFCookie(userId);
    
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
