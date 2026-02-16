/**
 * Admin Security Settings API
 * Manage tenant-wide security configuration
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';

interface SecuritySettings {
  mfaRequired: boolean;
  sessionTimeout: number;
  ipAllowlistEnabled: boolean;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
  };
}

const DEFAULT_SETTINGS: SecuritySettings = {
  mfaRequired: false,
  sessionTimeout: 24,
  ipAllowlistEnabled: false,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: false,
  },
};

export const GET = withAuthApiHandler(async (_request, ctx) => {
  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId: ctx.tenantId },
  });

  const securitySettings = config?.securitySettings as unknown as SecuritySettings | null;

  return createSuccessResponse(ctx, {
    settings: securitySettings || DEFAULT_SETTINGS,
  });
});

export const PUT = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { settings } = body as { settings: Partial<SecuritySettings> };

  if (settings.sessionTimeout && (settings.sessionTimeout < 1 || settings.sessionTimeout > 720)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Session timeout must be between 1 and 720 hours', 400);
  }

  if (settings.passwordPolicy?.minLength &&
      (settings.passwordPolicy.minLength < 6 || settings.passwordPolicy.minLength > 32)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Password minimum length must be between 6 and 32', 400);
  }

  const config = await prisma.tenantConfig.findUnique({
    where: { tenantId: ctx.tenantId },
  });

  const currentSettings = (config?.securitySettings as unknown as SecuritySettings) || DEFAULT_SETTINGS;

  const updatedSettings: SecuritySettings = {
    ...currentSettings,
    ...settings,
    passwordPolicy: {
      ...currentSettings.passwordPolicy,
      ...settings.passwordPolicy,
    },
  };

  await prisma.tenantConfig.upsert({
    where: { tenantId: ctx.tenantId },
    update: {
      securitySettings: updatedSettings as any,
    },
    create: {
      tenantId: ctx.tenantId,
      securitySettings: updatedSettings as any,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'SECURITY_SETTINGS_UPDATED',
      resourceType: 'tenant_config',
      resource: ctx.tenantId,
      details: { updatedFields: Object.keys(settings) },
    },
  });

  return createSuccessResponse(ctx, {
    settings: updatedSettings,
  });
});
