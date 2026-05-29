/**
 * SAML Initiation Endpoint
 * GET /api/auth/saml/init?id={providerId}
 *
 * Creates a signed AuthnRequest (via samlify) and redirects to the IdP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { loadSamlProvider, createLoginRequest } from '@/lib/auth/saml-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('id');
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

    if (!providerId) {
      return NextResponse.redirect(new URL('/auth/error?error=SAMLProviderIdMissing', request.url));
    }

    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const provider = await loadSamlProvider(tenantId, providerId);

    if (!provider) {
      logger.warn('[SAML] No provider config found', { tenantId, providerId });
      return NextResponse.redirect(new URL('/auth/error?error=SAMLConfigMissing', request.url));
    }

    const { context } = await createLoginRequest(provider);

    // Encode provider info into RelayState
    const relayState = Buffer.from(JSON.stringify({ providerId, callbackUrl })).toString('base64');

    const redirectUrl = new URL(context);
    redirectUrl.searchParams.set('RelayState', relayState);

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    logger.error('[SAML] Init error', { error: err });
    return NextResponse.redirect(new URL('/auth/error?error=SAMLInitFailed', request.url));
  }
}
