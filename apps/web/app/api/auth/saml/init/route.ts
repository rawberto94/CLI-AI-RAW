/**
 * SAML Initiation Endpoint
 * GET /api/auth/saml/init?id={providerId}
 *
 * Redirects the browser to the configured IdP SSO URL with a SAML AuthnRequest.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import crypto from 'crypto';
import { deflateRawSync } from 'zlib';

export const dynamic = 'force-dynamic';

function buildAuthnRequest(entityId: string, acsUrl: string, idpSsoUrl: string): string {
  const id = `_${crypto.randomBytes(16).toString('hex')}`;
  const issueInstant = new Date().toISOString();

  const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${idpSsoUrl}"
  AssertionConsumerServiceURL="${acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${entityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true"/>
</samlp:AuthnRequest>`;

  const deflated = deflateRawSync(Buffer.from(requestXml, 'utf-8'));
  return deflated.toString('base64');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('id');
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

    if (!providerId) {
      return NextResponse.redirect(new URL('/auth/error?error=SAMLProviderIdMissing', request.url));
    }

    // For demo/bridge purposes, we use a generic redirect.
    // In a full implementation, load the provider config from tenantConfig,
    // build a signed AuthnRequest, and redirect to the IdP.
    const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
    const entityId = `${baseUrl}/api/auth/saml/metadata`;
    const acsUrl = `${baseUrl}/api/auth/saml/callback`;

    // Load provider config to get SSO URL
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const config = await prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { securitySettings: true },
    });

    const securitySettings = (config?.securitySettings || {}) as {
      ssoProviders?: Array<{
        id: string;
        ssoUrl?: string;
        protocol: 'saml' | 'oidc';
      }>;
    };

    const provider = securitySettings.ssoProviders?.find(p => p.id === providerId && p.protocol === 'saml');
    const idpSsoUrl = provider?.ssoUrl;

    if (!idpSsoUrl) {
      logger.warn('[SAML] No SSO URL configured for provider', { providerId });
      return NextResponse.redirect(new URL('/auth/error?error=SAMLConfigMissing', request.url));
    }

    const samlRequest = buildAuthnRequest(entityId, acsUrl, idpSsoUrl);

    // Build redirect URL with SAMLRequest and RelayState
    const redirectUrl = new URL(idpSsoUrl);
    redirectUrl.searchParams.set('SAMLRequest', encodeURIComponent(samlRequest));
    redirectUrl.searchParams.set('RelayState', callbackUrl);

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    logger.error('[SAML] Init error', { error: err });
    return NextResponse.redirect(new URL('/auth/error?error=SAMLInitFailed', request.url));
  }
}
