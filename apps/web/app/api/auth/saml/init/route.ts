/**
 * SAML Initiation Endpoint
 * GET /api/auth/saml/init?id={providerId}&tenantId={tenantId}&callbackUrl=/dashboard
 *
 * Creates AuthnRequest (via samlify) and redirects to the IdP with signed RelayState.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { loadSamlProvider, createLoginRequest } from '@/lib/auth/saml-service';
import { encodeSsoState, safeCallbackUrl } from '@/lib/auth/sso-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('id');
    const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));
    const tenantId =
      searchParams.get('tenantId') ||
      searchParams.get('tenant') ||
      request.headers.get('x-tenant-id') ||
      '';

    if (!providerId) {
      return NextResponse.redirect(new URL('/auth/error?error=SAMLProviderIdMissing', request.url));
    }

    if (!tenantId || tenantId === 'default') {
      logger.warn('[SAML] Init missing tenantId');
      return NextResponse.redirect(new URL('/auth/error?error=SAMLTenantMissing', request.url));
    }

    const provider = await loadSamlProvider(tenantId, providerId);

    if (!provider) {
      logger.warn('[SAML] No provider config found', { tenantId, providerId });
      return NextResponse.redirect(new URL('/auth/error?error=SAMLConfigMissing', request.url));
    }

    if (!provider.ssoUrl) {
      return NextResponse.redirect(new URL('/auth/error?error=SAMLSsoUrlMissing', request.url));
    }

    const { context } = await createLoginRequest(provider);

    const relayState = encodeSsoState({
      tenantId,
      providerId,
      callbackUrl,
      protocol: 'saml',
    });

    const redirectUrl = new URL(context);
    redirectUrl.searchParams.set('RelayState', relayState);

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    logger.error('[SAML] Init error', { error: err });
    return NextResponse.redirect(new URL('/auth/error?error=SAMLInitFailed', request.url));
  }
}
