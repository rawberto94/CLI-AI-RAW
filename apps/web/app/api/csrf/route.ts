/**
 * CSRF Token API Endpoint
 * 
 * Issues CSRF tokens for client-side protection.
 * Tokens are set as cookies and must be included in request headers.
 */

import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { setCSRFCookie } from '@/lib/csrf';
import { withApiHandler, createSuccessResponse, createErrorResponse, getApiContext} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const session = await getServerSession();
    const userId = session?.user?.id;
    
    // Generate and set CSRF token
    const _token = await setCSRFCookie(userId);
    
    return createSuccessResponse(
      ctx,
      { success: true, message: 'CSRF token set' },
      { 
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('CSRF token generation failed:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate CSRF token', 500);
  }
});
