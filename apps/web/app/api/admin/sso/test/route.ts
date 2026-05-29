import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { IdentityProvider, ServiceProvider, setSchemaValidator } from 'samlify';

export const runtime = 'nodejs';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  const { protocol, ssoUrl, certificate, entityId, discoveryUrl, clientId, clientSecret } = body;

  if (protocol === 'saml') {
    if (!ssoUrl || !certificate) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'SSO URL and certificate are required for SAML', 400);
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const validator = require('@authenio/samlify-xsd-schema-validator');
      setSchemaValidator(validator);

      const sp = ServiceProvider({
        entityID: `${process.env.NEXTAUTH_URL}/api/auth/saml/metadata`,
        assertionConsumerService: [{
          Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
          Location: `${process.env.NEXTAUTH_URL}/api/auth/saml/callback`,
        }],
      });

      const idp = IdentityProvider({
        entityID: entityId || ssoUrl,
        singleSignOnService: [{
          Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
          Location: ssoUrl,
        }],
        signingCert: certificate,
      });

      const { context } = sp.createLoginRequest(idp, 'redirect');
      if (!context) {
        return createErrorResponse(ctx, 'TEST_FAILED', 'Failed to generate SAML AuthnRequest', 400);
      }

      return createSuccessResponse(ctx, {
        success: true,
        message: 'SAML configuration validated successfully. AuthnRequest generated.',
        authnRequestUrl: context,
      });
    } catch (err: any) {
      return createErrorResponse(ctx, 'TEST_FAILED', `SAML validation failed: ${err.message}`, 400);
    }
  }

  if (protocol === 'oidc') {
    if (!discoveryUrl || !clientId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Discovery URL and Client ID are required for OIDC', 400);
    }

    try {
      const res = await fetch(discoveryUrl, { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        return createErrorResponse(ctx, 'TEST_FAILED', `Discovery URL returned ${res.status}`, 400);
      }
      const config = await res.json();
      if (!config.authorization_endpoint || !config.token_endpoint) {
        return createErrorResponse(ctx, 'TEST_FAILED', 'Invalid OIDC discovery document', 400);
      }
      return createSuccessResponse(ctx, {
        success: true,
        message: 'OIDC configuration validated successfully. Discovery document parsed.',
        authorizationEndpoint: config.authorization_endpoint,
      });
    } catch (err: any) {
      return createErrorResponse(ctx, 'TEST_FAILED', `OIDC validation failed: ${err.message}`, 400);
    }
  }

  return createErrorResponse(ctx, 'VALIDATION_ERROR', 'protocol must be saml or oidc', 400);
});
