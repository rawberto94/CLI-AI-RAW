/**
 * Tenant OIDC initiation
 * GET /api/auth/oidc/init?id={providerId}&tenantId={tenantId}&callbackUrl=/dashboard
 *
 * Starts Authorization Code + PKCE flow against a tenant-configured OIDC IdP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { loadSsoProvider } from '@/lib/auth/sso-provider-store';
import {
  encodeSsoState,
  generatePkcePair,
  safeCallbackUrl,
} from '@/lib/auth/sso-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('id');
    const tenantId =
      searchParams.get('tenantId') ||
      searchParams.get('tenant') ||
      request.headers.get('x-tenant-id') ||
      '';
    const callbackUrl = safeCallbackUrl(searchParams.get('callbackUrl'));

    if (!providerId) {
      return NextResponse.redirect(new URL('/auth/error?error=OIDCProviderIdMissing', request.url));
    }
    if (!tenantId || tenantId === 'default') {
      return NextResponse.redirect(new URL('/auth/error?error=OIDCTenantMissing', request.url));
    }

    const provider = await loadSsoProvider(tenantId, providerId, 'oidc');
    if (!provider?.clientId || !provider.issuer) {
      return NextResponse.redirect(new URL('/auth/error?error=OIDCConfigMissing', request.url));
    }

    const issuer = provider.issuer.replace(/\/$/, '');
    const { codeVerifier, codeChallenge } = generatePkcePair();

    const state = encodeSsoState({
      tenantId,
      providerId,
      callbackUrl,
      protocol: 'oidc',
      codeVerifier,
    });

    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const redirectUri = `${baseUrl}/api/auth/oidc/callback`;

    // Discover endpoints — prefer standard OIDC paths; allow issuer as authorize base
    let authorizationEndpoint = `${issuer}/oauth2/v2.0/authorize`;
    try {
      const discovery = await fetch(`${issuer}/.well-known/openid-configuration`, {
        next: { revalidate: 3600 },
      });
      if (discovery.ok) {
        const doc = (await discovery.json()) as { authorization_endpoint?: string };
        if (doc.authorization_endpoint) {
          authorizationEndpoint = doc.authorization_endpoint;
        }
      }
    } catch {
      // Azure-style fallback already set; generic OIDC often uses /authorize
      authorizationEndpoint = `${issuer}/authorize`;
    }

    const authUrl = new URL(authorizationEndpoint);
    authUrl.searchParams.set('client_id', provider.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return NextResponse.redirect(authUrl);
  } catch (err) {
    logger.error('[OIDC] Init error', { error: err });
    return NextResponse.redirect(new URL('/auth/error?error=OIDCInitFailed', request.url));
  }
}
