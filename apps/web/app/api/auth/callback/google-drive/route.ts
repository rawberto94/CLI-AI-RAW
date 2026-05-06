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
  validateGoogleDriveOAuthState,
} from '@/lib/integrations/google-drive';
import { getTenantContext } from '@/lib/tenant-server';
import { withApiHandler } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

function buildCallbackRedirectUrl(request: NextRequest, path: string): URL {
  const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (publicAppUrl) {
    return new URL(path, publicAppUrl);
  }

  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '') || 'http';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
  return new URL(path, `${protocol}://${host}`);
}

export const GET = withApiHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Handle error from Google
  if (error) {
    return NextResponse.redirect(
      buildCallbackRedirectUrl(request, `/integrations?error=${encodeURIComponent(error)}`)
    );
  }

  // Validate code
  if (!code) {
    return NextResponse.redirect(
      buildCallbackRedirectUrl(request, '/integrations?error=no_code')
    );
  }

  try {
    // Get tenant and user from session
    const { tenantId, userId } = await getTenantContext();

    if (!tenantId || !userId) {
      return NextResponse.redirect(
        buildCallbackRedirectUrl(request, '/login?error=session_expired&redirect=/integrations')
      );
    }

    if (!state || !validateGoogleDriveOAuthState(state, tenantId, userId)) {
      logger.warn('[Google Drive OAuth] Invalid or missing callback state', {
        hasState: Boolean(state),
        tenantId,
        userId,
      });
      return NextResponse.redirect(
        buildCallbackRedirectUrl(request, '/integrations?error=invalid_state')
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
      buildCallbackRedirectUrl(request, '/integrations?connected=google-drive')
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.redirect(
      buildCallbackRedirectUrl(request, `/integrations?error=${encodeURIComponent(message)}`)
    );
  }
});
