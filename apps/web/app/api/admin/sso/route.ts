import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

interface SSOProvider {
  id: string;
  name: string;
  protocol: 'saml' | 'oidc';
  entityId?: string;
  metadataUrl?: string;
  ssoUrl?: string;
  certificate?: string;
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  attributeMappings: {
    email: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SecuritySettings {
  ssoProviders?: SSOProvider[];
  [key: string]: unknown;
}

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

async function getSecuritySettings(tenantId: string): Promise<SecuritySettings> {
  const prisma = await getPrisma();
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { securitySettings: true },
  });
  return (config?.securitySettings as SecuritySettings) || {};
}

async function saveSecuritySettings(tenantId: string, settings: SecuritySettings) {
  const prisma = await getPrisma();
  await prisma.tenantConfig.upsert({
    where: { tenantId },
    update: { securitySettings: settings as any },
    create: { tenantId, securitySettings: settings as any },
  });
}

// GET /api/admin/sso — List SSO provider configurations
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    return createErrorResponse(ctx, 'CONFIGURATION_ERROR', 'NEXTAUTH_URL environment variable must be configured', 500);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const providers = (settings.ssoProviders || []).map(({ certificate: _cert, clientSecret: _secret, ...p }) => p);

  return createSuccessResponse(ctx, {
    providers,
    spMetadata: {
      entityId: `${baseUrl}/api/auth/saml/metadata`,
      acsUrl: `${baseUrl}/api/auth/saml/callback`,
      sloUrl: `${baseUrl}/api/auth/saml/slo`,
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
  const { name, protocol, entityId, metadataUrl, ssoUrl, certificate, clientId, clientSecret, issuer, attributeMappings } = body;

  if (!name || !protocol) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'name and protocol are required', 400);
  }
  if (!['saml', 'oidc'].includes(protocol)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'protocol must be saml or oidc', 400);
  }
  if (protocol === 'saml' && !entityId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'entityId is required for SAML providers', 400);
  }
  if (protocol === 'oidc' && (!clientId || !issuer)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'clientId and issuer are required for OIDC providers', 400);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const providers = settings.ssoProviders || [];

  const now = new Date().toISOString();
  const newProvider: SSOProvider = {
    id: crypto.randomUUID(),
    name,
    protocol,
    entityId,
    metadataUrl,
    ssoUrl,
    certificate,
    clientId,
    clientSecret,
    issuer,
    attributeMappings: attributeMappings || { email: 'email' },
    enabled: false,
    createdAt: now,
    updatedAt: now,
  };

  providers.push(newProvider);
  settings.ssoProviders = providers;
  await saveSecuritySettings(ctx.tenantId, settings);

  const { certificate: _cert, clientSecret: _secret, ...safeProvider } = newProvider;
  return createSuccessResponse(ctx, { provider: safeProvider }, { status: 201 });
});

// PUT /api/admin/sso — Update an existing SSO provider
export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Provider id is required', 400);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const providers = settings.ssoProviders || [];
  const index = providers.findIndex(p => p.id === id);

  if (index === -1) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'SSO provider not found', 404);
  }

  const allowedFields = ['name', 'entityId', 'metadataUrl', 'ssoUrl', 'certificate', 'clientId', 'clientSecret', 'issuer', 'attributeMappings', 'enabled'];
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key)) {
      (providers[index] as any)[key] = updates[key];
    }
  }
  providers[index].updatedAt = new Date().toISOString();

  settings.ssoProviders = providers;
  await saveSecuritySettings(ctx.tenantId, settings);

  const { certificate: _cert, clientSecret: _secret, ...safeProvider } = providers[index];
  return createSuccessResponse(ctx, { provider: safeProvider });
});

// DELETE /api/admin/sso — Delete an SSO provider
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Provider id query parameter is required', 400);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const providers = settings.ssoProviders || [];
  const index = providers.findIndex(p => p.id === id);

  if (index === -1) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'SSO provider not found', 404);
  }

  providers.splice(index, 1);
  settings.ssoProviders = providers;
  await saveSecuritySettings(ctx.tenantId, settings);

  return createSuccessResponse(ctx, { deleted: true });
});
