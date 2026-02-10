import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// GET /api/admin/sso — List SSO provider configurations
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  // In production, this reads from DB (SSOProvider table)
  // For now, return mock data structure
  return createSuccessResponse(ctx, {
    providers: [],
    spMetadata: {
      entityId: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/saml/metadata`,
      acsUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/saml/callback`,
      sloUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/saml/slo`,
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    },
  });
});

// POST /api/admin/sso — Create a new SSO provider
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  const { name, protocol, entityId, ssoUrl, sloUrl, certificate, clientId, clientSecret, discoveryUrl, allowedDomains, attributeMapping, autoProvision, defaultRole, groupMapping, jitProvisioning } = body;

  if (!name || !protocol) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Name and protocol are required', 400);
  }

  if (protocol === 'saml' && (!ssoUrl || !certificate)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'SAML providers require SSO URL and certificate', 400);
  }

  if (protocol === 'oidc' && (!clientId || !discoveryUrl)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'OIDC providers require client ID and discovery URL', 400);
  }

  // In production, save to DB
  const provider = {
    id: 'sso_' + Date.now().toString(36),
    name,
    protocol,
    status: 'inactive',
    entityId,
    ssoUrl,
    sloUrl,
    certificate: certificate ? '[REDACTED]' : undefined,
    clientId,
    clientSecret: clientSecret ? '[REDACTED]' : undefined,
    discoveryUrl,
    allowedDomains: allowedDomains || [],
    attributeMapping: attributeMapping || { email: 'email' },
    autoProvision: autoProvision ?? true,
    defaultRole: defaultRole || 'viewer',
    groupMapping: groupMapping || [],
    jitProvisioning: jitProvisioning ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return createSuccessResponse(ctx, { provider }, 201);
});

// PUT /api/admin/sso — Update an existing SSO provider
export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  if (!body.id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Provider ID is required', 400);
  }

  // In production, update in DB
  return createSuccessResponse(ctx, {
    provider: { ...body, updatedAt: new Date().toISOString() },
  });
});

// DELETE /api/admin/sso — Delete an SSO provider
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Provider ID is required', 400);
  }

  // In production, delete from DB
  return createSuccessResponse(ctx, { deleted: true, id });
});
