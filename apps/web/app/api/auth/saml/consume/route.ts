/**
 * Consume SSO bridge cookie and return one-time token for NextAuth credentials exchange.
 * POST /api/auth/saml/consume
 *
 * Token never appears in the URL — only in HttpOnly cookie set by ACS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SSO_BRIDGE_COOKIE, isSecureCookieRequest } from '@/lib/auth/sso-utils';
import { samlTokenStore } from '@/lib/auth/saml-token-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SSO_BRIDGE_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_BRIDGE_TOKEN', message: 'SSO bridge cookie missing or expired' } },
      { status: 401 },
    );
  }

  const payload = await samlTokenStore.get(token);
  if (!payload) {
    const res = NextResponse.json(
      { success: false, error: { code: 'INVALID_BRIDGE_TOKEN', message: 'SSO bridge token invalid or expired' } },
      { status: 401 },
    );
    res.cookies.set(SSO_BRIDGE_COOKIE, '', {
      httpOnly: true,
      secure: isSecureCookieRequest(request.url),
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return res;
  }

  // Do not delete from Redis here — credentials authorize() consumes once.
  // Clear cookie so it cannot be replayed from the browser.
  const res = NextResponse.json({
    success: true,
    data: { samlToken: token },
  });
  res.cookies.set(SSO_BRIDGE_COOKIE, '', {
    httpOnly: true,
    secure: isSecureCookieRequest(request.url),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
