/**
 * SAML Assertion Consumer Service (ACS)
 * POST /api/auth/saml/callback
 *
 * Receives SAML assertions from IdP, verifies XML signatures,
 * extracts attributes, and creates/updates user session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { samlTokenStore } from '@/lib/auth/saml-token-store';
import { loadSamlProvider, parseSamlResponse } from '@/lib/auth/saml-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function createSamlToken(payload: { email: string; name: string; tenantId?: string; role?: string }): Promise<string> {
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

    // Determine tenant and provider from RelayState or headers
    // In production, the RelayState should contain encoded tenant+provider info
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    // For multi-tenant SAML, the providerId should be passed via RelayState
    const relayData = (() => {
      try {
        return relayState ? JSON.parse(Buffer.from(relayState, 'base64').toString()) : null;
      } catch {
        return null;
      }
    })();
    const providerId = relayData?.providerId;

    if (!providerId) {
      logger.error('[SAML] Provider ID missing from RelayState');
      return NextResponse.redirect(new URL('/auth/error?error=SAMLProviderMissing', request.url));
    }

    // Load provider config
    const provider = await loadSamlProvider(tenantId, providerId);
    if (!provider) {
      logger.error('[SAML] Provider not found', { tenantId, providerId });
      return NextResponse.redirect(new URL('/auth/error?error=SAMLProviderNotFound', request.url));
    }

    // Parse and verify SAML response using samlify
    const assertion = await parseSamlResponse(samlResponse, provider);

    if (!assertion.email) {
      logger.error('[SAML] Could not extract email from verified assertion');
      return NextResponse.redirect(new URL('/auth/error?error=SAMLEmailExtractionFailed', request.url));
    }

    const email = assertion.email.toLowerCase().trim();

    // Resolve tenant mapping
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true, role: true, status: true },
    });

    let userTenantId: string | undefined;
    let role: string | undefined;

    if (existingUser) {
      if (existingUser.status !== 'ACTIVE') {
        return NextResponse.redirect(new URL('/auth/error?error=AccountInactive', request.url));
      }
      userTenantId = existingUser.tenantId;
      role = existingUser.role;
    } else {
      const invitations = await prisma.teamInvitation.findMany({
        where: { email, status: 'PENDING', expiresAt: { gt: new Date() } },
        select: { tenantId: true, role: true },
      });

      if (invitations.length === 1) {
        userTenantId = invitations[0].tenantId;
        role = invitations[0].role;
      } else if (process.env.SSO_AUTO_PROVISION === 'true' && process.env.SSO_DEFAULT_TENANT_ID) {
        userTenantId = process.env.SSO_DEFAULT_TENANT_ID;
        role = 'member';

        await prisma.user.create({
          data: {
            email,
            firstName: assertion.firstName || null,
            lastName: assertion.lastName || null,
            tenantId: userTenantId,
            role,
            status: 'ACTIVE',
            emailVerified: true,
          },
        });
      }
    }

    if (!userTenantId) {
      return NextResponse.redirect(new URL('/auth/error?error=SSOAccessDenied', request.url));
    }

    // Create secure exchange token
    const token = await createSamlToken({
      email,
      name: assertion.firstName || email.split('@')[0],
      tenantId: userTenantId,
      role,
    });

    const callbackUrl = relayData?.callbackUrl || '/dashboard';
    const redirectUrl = new URL('/auth/saml/success', request.url);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('callbackUrl', callbackUrl);

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logger.error('[SAML] ACS processing error', { error });
    return NextResponse.redirect(new URL('/auth/error?error=SAMLProcessingError', request.url));
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/auth/error?error=SAMLMethodNotAllowed', request.url));
}
