/**
 * SAML Single Logout Service
 * GET/POST /api/auth/saml/slo
 *
 * Handles SAML SLO requests from the IdP.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const SAMLRequest = searchParams.get('SAMLRequest');
  const RelayState = searchParams.get('RelayState');

  // In a full implementation, validate the logout request and terminate the session
  // For now, redirect to the NextAuth signout page
  const redirectUrl = new URL('/auth/signout', request.url);
  if (RelayState) redirectUrl.searchParams.set('callbackUrl', RelayState);
  return NextResponse.redirect(redirectUrl);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const SAMLRequest = formData.get('SAMLRequest');
  const RelayState = formData.get('RelayState');

  // In a full implementation, validate the logout request and terminate the session
  const redirectUrl = new URL('/auth/signout', request.url);
  if (RelayState) redirectUrl.searchParams.set('callbackUrl', RelayState as string);
  return NextResponse.redirect(redirectUrl);
}
