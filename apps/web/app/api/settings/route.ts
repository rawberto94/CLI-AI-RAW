import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import prisma from '@/lib/prisma';

/**
 * GET /api/settings — Retrieve tenant/user settings
 * PUT /api/settings — Update tenant/user settings
 */

// Default settings structure
const DEFAULT_SETTINGS = {
  system: {
    timezone: 'America/New_York',
    language: 'en',
    dateFormat: 'MM/DD/YYYY',
    currency: 'USD',
    theme: 'system',
  },
  notifications: {
    emailEnabled: true,
    pushEnabled: true,
    contractAlerts: true,
    renewalReminders: true,
    complianceAlerts: true,
    weeklyDigest: true,
  },
  security: {
    sessionTimeout: 480,
    requireMFA: false,
    passwordMinLength: 8,
    ipWhitelist: [],
  },
  display: {
    defaultDashboard: 'overview',
    contractsPerPage: 25,
    showWelcomeScreen: true,
    compactMode: false,
  },
};

export const GET = withAuthApiHandler(async (request, ctx) => {
  try {
    const tenantId = ctx.tenantId;

    // Try to find tenant settings in TenantSettings.customFields
    let settings = { ...DEFAULT_SETTINGS };

    if (tenantId) {
      const tenantSettings = await prisma.tenantSettings.findFirst({
        where: { tenantId },
        select: { customFields: true },
      });

      if (tenantSettings?.customFields && typeof tenantSettings.customFields === 'object') {
        settings = deepMerge(DEFAULT_SETTINGS, tenantSettings.customFields as Record<string, unknown>);
      }
    }

    // Get user-specific info
    if (ctx.userId) {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { name: true, email: true, role: true, image: true },
      });

      return createSuccessResponse(ctx, {
        settings,
        user: user ? {
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.image,
        } : null,
      });
    }

    return createSuccessResponse(ctx, { settings, user: null });
  } catch (error) {
    return handleApiError(error, ctx);
  }
});

export const PUT = withAuthApiHandler(async (request, ctx) => {
  try {
    const body = await request.json();
    const { section, updates } = body;

    if (!section || !updates) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'section and updates are required', 400);
    }

    const validSections = ['system', 'notifications', 'security', 'display'];
    if (!validSections.includes(section)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid section: ${section}. Must be one of: ${validSections.join(', ')}`, 400);
    }

    const tenantId = ctx.tenantId;

    if (tenantId) {
      // Get or create TenantSettings
      const tenantSettings = await prisma.tenantSettings.findFirst({
        where: { tenantId },
      });

      const currentSettings = (tenantSettings?.customFields && typeof tenantSettings.customFields === 'object')
        ? tenantSettings.customFields as Record<string, unknown>
        : { ...DEFAULT_SETTINGS };

      // Merge updates into the specific section
      const updatedSettings = {
        ...currentSettings,
        [section]: {
          ...(currentSettings[section] as Record<string, unknown> || {}),
          ...updates,
        },
      };

      if (tenantSettings) {
        await prisma.tenantSettings.update({
          where: { id: tenantSettings.id },
          data: { customFields: updatedSettings as any },
        });
      } else {
        await prisma.tenantSettings.create({
          data: {
            tenantId,
            customFields: updatedSettings as any,
          },
        });
      }

      return createSuccessResponse(ctx, { settings: updatedSettings, section, updated: true });
    }

    return createErrorResponse(ctx, 'TENANT_REQUIRED', 'No tenant context found', 400);
  } catch (error) {
    return handleApiError(error, ctx);
  }
});

// Deep merge utility
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object') {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
