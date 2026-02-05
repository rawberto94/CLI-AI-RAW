/**
 * Google Drive OAuth Callback Handler
 * 
 * GET /api/auth/callback/google-drive - Handle OAuth callback from Google
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  getGoogleUserInfo,
  storeGoogleDriveConnection,
} from '@/lib/integrations/google-drive';
import { getTenantContext } from '@/lib/tenant-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const _state = searchParams.get('state');

  // Handle error from Google
  if (error) {
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(
      new URL('/integrations?error=no_code', request.url)
    );
  }

  try {
    // Get tenant and user from session
    const { tenantId, userId } = await getTenantContext();

    if (!tenantId || !userId) {
      return NextResponse.redirect(
        new URL('/login?error=session_expired&redirect=/integrations', request.url)
      );
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info
    const userInfo = await getGoogleUserInfo(tokens.accessToken);

    // Store connection in database
    await storeGoogleDriveConnection(tenantId, userId, tokens, userInfo);

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      new URL('/integrations?connected=google-drive', request.url)
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/integrations?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
