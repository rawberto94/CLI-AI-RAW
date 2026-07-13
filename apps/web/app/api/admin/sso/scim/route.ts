import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';
import crypto from 'crypto';

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

async function getSecuritySettings(tenantId: string) {
  const prisma = await getPrisma();
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { securitySettings: true },
  });
  return (config?.securitySettings as Record<string, unknown>) || {};
}

async function saveSecuritySettings(tenantId: string, settings: Record<string, unknown>) {
  const prisma = await getPrisma();
  await prisma.tenantConfig.upsert({
    where: { tenantId },
    update: { securitySettings: settings as any },
    create: { tenantId, securitySettings: settings as any },
  });
}

function generateScimToken(): string {
  return `scim_${crypto.randomUUID().replace(/-/g, '')}`;
}

function hashToken(token: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(token, salt, 32).toString('hex');
  return { hash, salt };
}

function verifyToken(token: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(token, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(derived));
  } catch {
    return false;
  }
}

function tokenPreview(token: string): string {
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

/**
 * Migrate a plaintext scimToken to hashed format.
 */
async function migratePlaintextToken(tenantId: string, settings: Record<string, unknown>): Promise<void> {
  const plaintext = settings.scimToken as string | undefined;
  if (!plaintext) return;
  const { hash, salt } = hashToken(plaintext);
  settings.scimTokenHash = hash;
  settings.scimTokenSalt = salt;
  settings.scimTokenPreview = tokenPreview(plaintext);
  delete settings.scimToken;
  await saveSecuritySettings(tenantId, settings);
}

// GET /api/admin/sso/scim — Return SCIM base URL and token preview (generate if missing)
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const baseUrl = process.env.NEXTAUTH_URL || request.headers.get('origin') || '';
  if (!baseUrl) {
    return createErrorResponse(ctx, 'CONFIGURATION_ERROR', 'NEXTAUTH_URL environment variable must be configured', 500);
  }

  const settings = await getSecuritySettings(ctx.tenantId);

  // Migrate legacy plaintext token if present
  if (settings.scimToken) {
    await migratePlaintextToken(ctx.tenantId, settings);
  }

  const token = settings.scimTokenHash as string | undefined;

  if (!token) {
    const rawToken = generateScimToken();
    const { hash, salt } = hashToken(rawToken);
    settings.scimTokenHash = hash;
    settings.scimTokenSalt = salt;
    settings.scimTokenPreview = tokenPreview(rawToken);
    await saveSecuritySettings(ctx.tenantId, settings);

    await auditLog({
      action: AuditAction.API_KEY_CREATED,
      tenantId: ctx.tenantId,
      resourceType: 'scim_token',
      metadata: { source: 'admin' },
      request,
    });

    return createSuccessResponse(ctx, {
      baseUrl: `${baseUrl}/api/scim/v2`,
      token: rawToken, // Show once on creation
      preview: settings.scimTokenPreview,
    });
  }

  return createSuccessResponse(ctx, {
    baseUrl: `${baseUrl}/api/scim/v2`,
    token: null,
    preview: settings.scimTokenPreview,
  });
});

// POST /api/admin/sso/scim — Regenerate SCIM token
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const rawToken = generateScimToken();
  const { hash, salt } = hashToken(rawToken);
  settings.scimTokenHash = hash;
  settings.scimTokenSalt = salt;
  settings.scimTokenPreview = tokenPreview(rawToken);
  await saveSecuritySettings(ctx.tenantId, settings);

  await auditLog({
    action: AuditAction.API_KEY_CREATED,
    tenantId: ctx.tenantId,
    resourceType: 'scim_token',
    metadata: { source: 'admin', regenerated: true },
    request,
  });

  return createSuccessResponse(ctx, { token: rawToken, preview: settings.scimTokenPreview });
});

export { verifyToken };
