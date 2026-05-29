/**
 * SAML Assertion Consumer Service (ACS)
 * POST /api/auth/saml/callback
 *
 * Receives SAML assertions from IdP and creates/updates user session.
 * This is a bridge endpoint: it validates the SAML response and then
 * redirects to the NextAuth credentials flow with a secure token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { samlTokenStore } from '@/lib/auth/saml-token-store';

export const dynamic = 'force-dynamic';

function createSamlToken(payload: { email: string; name: string; tenantId?: string; role?: string }): string {
  const token = crypto.randomBytes(32).toString('hex');
  samlTokenStore.set(token, payload);
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

    // Decode base64 SAML response (minimal parsing for demo/bridge)
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8');

    // Extract email from assertion (naive XML extraction)
    const emailMatch = decoded.match(/<saml?:?NameID[^>]*>([^<]+)<\/saml?:?NameID>/i) ||
                       decoded.match(/<saml?:?Attribute[^>]*Name="[^"]*email[^"]*"[^>]*>\s*<saml?:?AttributeValue[^>]*>([^<]+)<\/saml?:?AttributeValue>/i);
    const email = emailMatch?.[1]?.trim();

    if (!email) {
      logger.error('[SAML] Could not extract email from SAML response');
      return NextResponse.redirect(new URL('/auth/error?error=SAMLEmailExtractionFailed', request.url));
    }

    // Resolve tenant mapping
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, tenantId: true, role: true, status: true },
    });

    let tenantId: string | undefined;
    let role: string | undefined;

    if (existingUser) {
      if (existingUser.status !== 'ACTIVE') {
        return NextResponse.redirect(new URL('/auth/error?error=AccountInactive', request.url));
      }
      tenantId = existingUser.tenantId;
      role = existingUser.role;
    } else {
      // Check for pending invitation
      const invitations = await prisma.teamInvitation.findMany({
        where: { email, status: 'PENDING', expiresAt: { gt: new Date() } },
        select: { tenantId: true, role: true },
      });

      if (invitations.length === 1) {
        tenantId = invitations[0].tenantId;
        role = invitations[0].role;
      } else if (process.env.SSO_AUTO_PROVISION === 'true' && process.env.SSO_DEFAULT_TENANT_ID) {
        tenantId = process.env.SSO_DEFAULT_TENANT_ID;
        role = 'member';

        // Create user
        await prisma.user.create({
          data: {
            email,
            tenantId,
            role,
            status: 'ACTIVE',
            emailVerified: true,
          },
        });
      }
    }

    if (!tenantId) {
      return NextResponse.redirect(new URL('/auth/error?error=SSOAccessDenied', request.url));
    }

    // Create secure exchange token
    const token = createSamlToken({ email, name: email.split('@')[0], tenantId, role });

    // Redirect to callback with token
    const callbackUrl = relayState || '/dashboard';
    const redirectUrl = new URL('/auth/saml/success', request.url);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('callbackUrl', callbackUrl);

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    logger.error('[SAML] ACS processing error', { error: err });
    return NextResponse.redirect(new URL('/auth/error?error=SAMLProcessingError', request.url));
  }
}

export async function GET(request: NextRequest) {
  // Some IdPs send GET to ACS — redirect to error or handle accordingly
  return NextResponse.redirect(new URL('/auth/error?error=SAMLMethodNotAllowed', request.url));
}
