/**
 * SAML Assertion Consumer Service (ACS)
 * POST /api/auth/saml/callback
 *
 * Verifies assertion, maps user → tenant/role, sets HttpOnly bridge cookie, redirects to success.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { samlTokenStore } from '@/lib/auth/saml-token-store';
import { loadSamlProvider, parseSamlResponse } from '@/lib/auth/saml-service';
import { resolveSSOSignInMapping } from '@/lib/sso-access';
import {
  SSO_BRIDGE_COOKIE,
  decodeSsoState,
  isSecureCookieRequest,
  safeCallbackUrl,
} from '@/lib/auth/sso-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function createBridgeToken(payload: {
  email: string;
  name: string;
  tenantId?: string;
  role?: string;
}): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await samlTokenStore.set(token, payload);
  return token;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const samlResponse = formData.get('SAMLResponse') as string | null;
    const relayState = formData.get('RelayState') as string | null;

    if (!samlResponse) {
      return NextResponse.redirect(new URL('/auth/error?error=SAMLResponseMissing', request.url));
    }

    const relayData = decodeSsoState(relayState);
    if (!relayData?.providerId || !relayData?.tenantId) {
      logger.error('[SAML] Invalid or missing signed RelayState');
      return NextResponse.redirect(new URL('/auth/error?error=SAMLRelayStateInvalid', request.url));
    }

    const { tenantId, providerId } = relayData;
    const provider = await loadSamlProvider(tenantId, providerId);
    if (!provider) {
      logger.error('[SAML] Provider not found', { tenantId, providerId });
      return NextResponse.redirect(new URL('/auth/error?error=SAMLProviderNotFound', request.url));
    }

    const assertion = await parseSamlResponse(samlResponse, provider);
    const email = assertion.email.toLowerCase().trim();

    const mapping = await resolveSSOSignInMapping(email, {
      preferredTenantId: tenantId,
      groups: assertion.groups,
      allowedDomains: provider.allowedDomains,
      groupRoleMapping: provider.groupRoleMapping,
    });

    if (!mapping) {
      return NextResponse.redirect(new URL('/auth/error?error=SSOAccessDenied', request.url));
    }

    // JIT provision when user does not exist yet
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          firstName: assertion.firstName || null,
          lastName: assertion.lastName || null,
          tenantId: mapping.tenantId,
          role: mapping.role,
          status: 'ACTIVE',
          emailVerified: true,
        },
        select: { id: true, firstName: true, lastName: true },
      });

      // Mark matching invitation accepted
      await prisma.teamInvitation.updateMany({
        where: {
          email,
          tenantId: mapping.tenantId,
          status: 'PENDING',
        },
        data: { status: 'ACCEPTED' },
      }).catch(() => {});
    }

    const token = await createBridgeToken({
      email,
      name: assertion.firstName || user.firstName || email.split('@')[0],
      tenantId: mapping.tenantId,
      role: mapping.role,
    });

    const callbackUrl = safeCallbackUrl(relayData.callbackUrl);
    const redirectUrl = new URL('/auth/saml/success', request.url);
    redirectUrl.searchParams.set('callbackUrl', callbackUrl);

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(SSO_BRIDGE_COOKIE, token, {
      httpOnly: true,
      secure: isSecureCookieRequest(request.url),
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60,
    });

    return response;
  } catch (error) {
    logger.error('[SAML] ACS processing error', { error });
    return NextResponse.redirect(new URL('/auth/error?error=SAMLProcessingError', request.url));
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/auth/error?error=SAMLMethodNotAllowed', request.url));
}
