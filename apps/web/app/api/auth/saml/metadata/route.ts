/**
 * SAML Service Provider Metadata
 * GET /api/auth/saml/metadata
 *
 * Returns SP metadata XML for IdP configuration.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function buildMetadata(baseUrl: string): string {
  const entityId = `${baseUrl}/api/auth/saml/metadata`;
  const acsUrl = `${baseUrl}/api/auth/saml/callback`;
  const sloUrl = `${baseUrl}/api/auth/saml/slo`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${sloUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;
  const metadata = buildMetadata(baseUrl);

  return new NextResponse(metadata, {
    headers: {
      'Content-Type': 'application/samlmetadata+xml',
      'Cache-Control': 'no-store',
    },
  });
}
