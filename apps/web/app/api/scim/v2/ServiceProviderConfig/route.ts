import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// GET /api/scim/v2/ServiceProviderConfig
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  return createSuccessResponse(ctx, {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://docs.contigo.app/scim',
    patch: {
      supported: true,
    },
    bulk: {
      supported: false,
      maxOperations: 0,
      maxPayloadSize: 0,
    },
    filter: {
      supported: false,
      maxResults: 0,
    },
    changePassword: {
      supported: false,
    },
    sort: {
      supported: false,
    },
    etag: {
      supported: false,
    },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using the OAuth Bearer Token Standard',
        specUri: 'https://www.rfc-editor.org/rfc/rfc6750',
        documentationUri: 'https://docs.contigo.app/scim/auth',
        primary: true,
      },
    ],
    meta: {
      resourceType: 'ServiceProviderConfig',
      location: '/ServiceProviderConfig',
    },
  });
});
