import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';

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

// GET /api/admin/sso/settings — Return global SSO settings
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const settings = await getSecuritySettings(ctx.tenantId);
  const globalSettings = (settings.globalSettings as Record<string, unknown>) || {};

  return createSuccessResponse(ctx, {
    passwordFallback: globalSettings.passwordFallback ?? true,
    enforceSSO: globalSettings.enforceSSO ?? false,
    sessionDuration: globalSettings.sessionDuration ?? '24h',
  });
});

// PUT /api/admin/sso/settings — Update global SSO settings
export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'superadmin') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  const { passwordFallback, enforceSSO, sessionDuration } = body;

  const settings = await getSecuritySettings(ctx.tenantId);
  settings.globalSettings = {
    passwordFallback: typeof passwordFallback === 'boolean' ? passwordFallback : (settings.globalSettings as any)?.passwordFallback ?? true,
    enforceSSO: typeof enforceSSO === 'boolean' ? enforceSSO : (settings.globalSettings as any)?.enforceSSO ?? false,
    sessionDuration: sessionDuration || (settings.globalSettings as any)?.sessionDuration || '24h',
  };

  await saveSecuritySettings(ctx.tenantId, settings);

  await auditLog({
    action: AuditAction.SECURITY_SETTINGS_UPDATED,
    tenantId: ctx.tenantId,
    resourceType: 'sso_settings',
    metadata: { settings: settings.globalSettings },
    request,
  });

  return createSuccessResponse(ctx, { globalSettings: settings.globalSettings });
});
