/**
 * SAML Single Logout Service
 * GET/POST /api/auth/saml/slo
 *
 * Best-effort NameID extraction, clears local UserSessions, redirects to sign-out.
 * Full signed LogoutRequest validation is available when SP signing keys are configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { decodeSsoState, safeCallbackUrl } from '@/lib/auth/sso-utils';
import { extractNameIdFromLogoutRequest } from '@/lib/auth/saml-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function clearSessionsForEmail(email: string | undefined) {
  if (!email || !email.includes('@')) return;
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true },
    });
    if (!user) return;
    await prisma.userSession.deleteMany({ where: { userId: user.id } });
    logger.info('[SAML SLO] Cleared local sessions', { userId: user.id });
  } catch (err) {
    logger.warn('[SAML SLO] session cleanup failed', { error: err });
  }
}

async function handleSlo(request: NextRequest, binding: 'redirect' | 'post') {
  let nameID: string | undefined;
  let relayState: string | null = null;

  try {
    if (binding === 'redirect') {
      const { searchParams } = new URL(request.url);
      relayState = searchParams.get('RelayState');
      nameID = extractNameIdFromLogoutRequest(searchParams.get('SAMLRequest'));
    } else {
      const formData = await request.formData();
      relayState = (formData.get('RelayState') as string) || null;
      nameID = extractNameIdFromLogoutRequest(formData.get('SAMLRequest') as string | null);
    }
  } catch (err) {
    logger.warn('[SAML SLO] parse error — continuing with local logout', { error: err });
  }

  await clearSessionsForEmail(nameID);

  const redirectUrl = new URL('/auth/signout', request.url);
  // Only treat RelayState as a path callback if it is a relative path (not signed state)
  if (relayState?.startsWith('/')) {
    redirectUrl.searchParams.set('callbackUrl', safeCallbackUrl(relayState, '/auth/signin'));
  } else {
    const decoded = decodeSsoState(relayState);
    if (decoded?.callbackUrl) {
      redirectUrl.searchParams.set('callbackUrl', safeCallbackUrl(decoded.callbackUrl, '/auth/signin'));
    } else {
      redirectUrl.searchParams.set('callbackUrl', '/auth/signin');
    }
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set('authjs.session-token', '', { path: '/', maxAge: 0 });
  response.cookies.set('__Secure-authjs.session-token', '', {
    path: '/',
    maxAge: 0,
    secure: true,
  });
  return response;
}

export async function GET(request: NextRequest) {
  return handleSlo(request, 'redirect');
}

export async function POST(request: NextRequest) {
  return handleSlo(request, 'post');
}
