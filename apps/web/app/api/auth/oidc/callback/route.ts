/**
 * Tenant OIDC callback
 * GET /api/auth/oidc/callback?code=&state=
 *
 * Exchanges code (PKCE), loads userinfo, maps tenant, sets bridge cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { loadSsoProvider } from '@/lib/auth/sso-provider-store';
import { resolveSSOSignInMapping } from '@/lib/sso-access';
import { samlTokenStore } from '@/lib/auth/saml-token-store';
import {
  SSO_BRIDGE_COOKIE,
  decodeSsoState,
  isSecureCookieRequest,
  safeCallbackUrl,
} from '@/lib/auth/sso-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function discoverTokenAndUserinfo(issuer: string): Promise<{
  token_endpoint: string;
  userinfo_endpoint?: string;
}> {
  const base = issuer.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/.well-known/openid-configuration`);
    if (res.ok) {
      const doc = (await res.json()) as {
        token_endpoint?: string;
        userinfo_endpoint?: string;
      };
      if (doc.token_endpoint) {
        return {
          token_endpoint: doc.token_endpoint,
          userinfo_endpoint: doc.userinfo_endpoint,
        };
      }
    }
  } catch {
    // fall through
  }
  return {
    token_endpoint: `${base}/oauth2/v2.0/token`,
    userinfo_endpoint: `${base}/oidc/userinfo`,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const stateRaw = searchParams.get('state');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      logger.warn('[OIDC] Provider returned error', { oauthError });
      return NextResponse.redirect(new URL(`/auth/error?error=OIDCProviderError`, request.url));
    }

    if (!code || !stateRaw) {
      return NextResponse.redirect(new URL('/auth/error?error=OIDCMissingCode', request.url));
    }

    const state = decodeSsoState(stateRaw);
    if (!state?.tenantId || !state.providerId || !state.codeVerifier) {
      return NextResponse.redirect(new URL('/auth/error?error=OIDCStateInvalid', request.url));
    }

    const provider = await loadSsoProvider(state.tenantId, state.providerId, 'oidc');
    if (!provider?.clientId || !provider.issuer) {
      return NextResponse.redirect(new URL('/auth/error?error=OIDCConfigMissing', request.url));
    }

    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const redirectUri = `${baseUrl}/api/auth/oidc/callback`;
    const endpoints = await discoverTokenAndUserinfo(provider.issuer);

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: provider.clientId,
      code_verifier: state.codeVerifier,
    });
    if (provider.clientSecret) {
      tokenBody.set('client_secret', provider.clientSecret);
    }

    const tokenRes = await fetch(endpoints.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      logger.error('[OIDC] Token exchange failed', { status: tokenRes.status, errText: errText.slice(0, 300) });
      return NextResponse.redirect(new URL('/auth/error?error=OIDCTokenExchangeFailed', request.url));
    }

    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      id_token?: string;
    };

    let email = '';
    let firstName = '';
    let lastName = '';
    let groups: string[] | undefined;

    // Prefer userinfo
    if (tokens.access_token && endpoints.userinfo_endpoint) {
      try {
        const ui = await fetch(endpoints.userinfo_endpoint, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (ui.ok) {
          const profile = (await ui.json()) as Record<string, unknown>;
          email = String(profile.email || profile.preferred_username || '').toLowerCase();
          firstName = String(profile.given_name || profile.name || '').split(' ')[0] || '';
          lastName = String(profile.family_name || '');
          if (Array.isArray(profile.groups)) {
            groups = profile.groups.map(String);
          }
        }
      } catch {
        // fall through to id_token
      }
    }

    // Decode id_token payload (signature already validated by TLS+code exchange; optional verify later)
    if (!email && tokens.id_token) {
      try {
        const payload = tokens.id_token.split('.')[1];
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
        email = String(claims.email || claims.preferred_username || claims.upn || '').toLowerCase();
        firstName = String(claims.given_name || '').split(' ')[0] || '';
        lastName = String(claims.family_name || '');
        if (Array.isArray(claims.groups)) groups = claims.groups.map(String);
      } catch {
        // ignore
      }
    }

    if (!email || !email.includes('@')) {
      return NextResponse.redirect(new URL('/auth/error?error=OIDCEmailMissing', request.url));
    }

    const mapping = await resolveSSOSignInMapping(email, {
      preferredTenantId: state.tenantId,
      groups,
      allowedDomains: provider.allowedDomains,
      groupRoleMapping: provider.groupRoleMapping,
    });

    if (!mapping) {
      return NextResponse.redirect(new URL('/auth/error?error=SSOAccessDenied', request.url));
    }

    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          firstName: firstName || null,
          lastName: lastName || null,
          tenantId: mapping.tenantId,
          role: mapping.role,
          status: 'ACTIVE',
          emailVerified: true,
        },
        select: { id: true, firstName: true },
      });
      await prisma.teamInvitation.updateMany({
        where: { email, tenantId: mapping.tenantId, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      }).catch(() => {});
    }

    const bridgeToken = crypto.randomBytes(32).toString('hex');
    await samlTokenStore.set(bridgeToken, {
      email,
      name: firstName || user.firstName || email.split('@')[0],
      tenantId: mapping.tenantId,
      role: mapping.role,
    });

    const redirectUrl = new URL('/auth/saml/success', request.url);
    redirectUrl.searchParams.set('callbackUrl', safeCallbackUrl(state.callbackUrl));

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(SSO_BRIDGE_COOKIE, bridgeToken, {
      httpOnly: true,
      secure: isSecureCookieRequest(request.url),
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60,
    });
    return response;
  } catch (err) {
    logger.error('[OIDC] Callback error', { error: err });
    return NextResponse.redirect(new URL('/auth/error?error=OIDCCallbackFailed', request.url));
  }
}
