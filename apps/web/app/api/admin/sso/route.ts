import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { isElevatedAdminRole } from '@/lib/permissions';
import type { AttributeMapping } from '@/lib/auth/sso-utils';

interface SSOProvider {
  id: string;
  name: string;
  protocol: 'saml' | 'oidc';
  entityId?: string;
  metadataUrl?: string;
  ssoUrl?: string;
  sloUrl?: string;
  certificate?: string;
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  /** Canonical field — UI and runtime both use this */
  attributeMapping: AttributeMapping;
  /** @deprecated alias — still accepted on write, normalized to attributeMapping */
  attributeMappings?: AttributeMapping;
  allowedDomains?: string[];
  groupRoleMapping?: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SecuritySettings {
  ssoProviders?: SSOProvider[];
  ssoAllowedDomains?: string[];
  [key: string]: unknown;
}

function normalizeMapping(body: Record<string, unknown>): AttributeMapping {
  const raw =
    (body.attributeMapping as AttributeMapping | undefined) ||
    (body.attributeMappings as AttributeMapping | undefined) ||
    { email: 'email' };
  return {
    email: raw.email || 'email',
    firstName: raw.firstName,
    lastName: raw.lastName,
    groups: raw.groups,
  };
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
    update: { securitySettings: settings as never },
    create: { tenantId, securitySettings: settings as never },
  });
}

function toPublicProvider(p: SSOProvider) {
  const { certificate: _c, clientSecret: _s, attributeMappings: _am, ...rest } = p;
  return rest;
}

// GET /api/admin/sso — List SSO provider configurations
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!isElevatedAdminRole(ctx.userRole)) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const baseUrl = process.env.NEXTAUTH_URL;
  if (!baseUrl) {
    return createErrorResponse(ctx, 'CONFIGURATION_ERROR', 'NEXTAUTH_URL environment variable must be configured', 500);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const providers = (settings.ssoProviders || []).map((p) => {
    // Normalize legacy attributeMappings on read
    const mapping = p.attributeMapping || p.attributeMappings || { email: 'email' };
    return toPublicProvider({ ...p, attributeMapping: mapping });
  });

  return createSuccessResponse(ctx, {
    providers,
    ssoAllowedDomains: settings.ssoAllowedDomains || [],
    spMetadata: {
      entityId: `${baseUrl}/api/auth/saml/metadata`,
      acsUrl: `${baseUrl}/api/auth/saml/callback`,
      sloUrl: `${baseUrl}/api/auth/saml/slo`,
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      oidcCallbackUrl: `${baseUrl}/api/auth/oidc/callback`,
      initSaml: `${baseUrl}/api/auth/saml/init?tenantId=${ctx.tenantId}&id={providerId}`,
      initOidc: `${baseUrl}/api/auth/oidc/init?tenantId=${ctx.tenantId}&id={providerId}`,
    },
  });
});

// POST /api/admin/sso — Create a new SSO provider
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!isElevatedAdminRole(ctx.userRole)) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  const {
    name,
    protocol,
    entityId,
    metadataUrl,
    ssoUrl,
    sloUrl,
    certificate,
    clientId,
    clientSecret,
    issuer,
    allowedDomains,
    groupRoleMapping,
  } = body;

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
    sloUrl,
    certificate,
    clientId,
    clientSecret,
    issuer,
    attributeMapping: normalizeMapping(body),
    allowedDomains: Array.isArray(allowedDomains)
      ? allowedDomains.map((d: string) => String(d).toLowerCase().replace(/^@/, ''))
      : [],
    groupRoleMapping: groupRoleMapping && typeof groupRoleMapping === 'object' ? groupRoleMapping : {},
    enabled: false,
    createdAt: now,
    updatedAt: now,
  };

  providers.push(newProvider);
  settings.ssoProviders = providers;
  await saveSecuritySettings(ctx.tenantId, settings);

  return createSuccessResponse(ctx, { provider: toPublicProvider(newProvider) }, { status: 201 });
});

// PUT /api/admin/sso — Update an existing SSO provider
export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!isElevatedAdminRole(ctx.userRole)) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Provider id is required', 400);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const providers = settings.ssoProviders || [];
  const index = providers.findIndex((p) => p.id === id);

  if (index === -1) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'SSO provider not found', 404);
  }

  const allowedFields = [
    'name',
    'entityId',
    'metadataUrl',
    'ssoUrl',
    'sloUrl',
    'certificate',
    'clientId',
    'clientSecret',
    'issuer',
    'attributeMapping',
    'attributeMappings',
    'allowedDomains',
    'groupRoleMapping',
    'enabled',
  ];
  for (const key of Object.keys(updates)) {
    if (!allowedFields.includes(key)) continue;
    if (key === 'attributeMapping' || key === 'attributeMappings') {
      providers[index].attributeMapping = normalizeMapping(updates);
      delete providers[index].attributeMappings;
      continue;
    }
    if (key === 'allowedDomains' && Array.isArray(updates.allowedDomains)) {
      providers[index].allowedDomains = updates.allowedDomains.map((d: string) =>
        String(d).toLowerCase().replace(/^@/, ''),
      );
      continue;
    }
    (providers[index] as Record<string, unknown>)[key] = updates[key];
  }
  // Always ensure mapping is present
  providers[index].attributeMapping =
    providers[index].attributeMapping ||
    providers[index].attributeMappings ||
    { email: 'email' };
  delete providers[index].attributeMappings;
  providers[index].updatedAt = new Date().toISOString();

  settings.ssoProviders = providers;
  await saveSecuritySettings(ctx.tenantId, settings);

  return createSuccessResponse(ctx, { provider: toPublicProvider(providers[index]) });
});

// DELETE /api/admin/sso — Delete an SSO provider
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!isElevatedAdminRole(ctx.userRole)) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Provider id query parameter is required', 400);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const providers = settings.ssoProviders || [];
  const index = providers.findIndex((p) => p.id === id);

  if (index === -1) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'SSO provider not found', 404);
  }

  providers.splice(index, 1);
  settings.ssoProviders = providers;
  await saveSecuritySettings(ctx.tenantId, settings);

  return createSuccessResponse(ctx, { deleted: true });
});
