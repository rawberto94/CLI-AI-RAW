import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/settings — Retrieve tenant/user settings
 * PUT /api/settings — Update tenant/user settings
 */

// Default settings structure
const DEFAULT_SETTINGS = {
  system: {
    timezone: 'Europe/Zurich',
    language: 'en',
    dateFormat: 'DD.MM.YYYY',
    currency: 'CHF',
    ourOrganization: '',
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
    sessionTimeout: 8,
    requireMFA: false,
    passwordMinLength: 8,
    ipWhitelist: [] as string[],
  },
  display: {
    defaultDashboard: 'overview',
    contractsPerPage: 25,
    showWelcomeScreen: true,
    compactMode: false,
  },
};

const USER_MANAGED_SECTIONS = new Set(['system', 'notifications', 'display']);
const TENANT_MANAGED_SECTIONS = new Set(['security', 'processing']);
const TENANT_ADMIN_ROLES = new Set(['owner', 'admin', 'super_admin']);

type SettingsPayload = typeof DEFAULT_SETTINGS & {
  processing?: Record<string, unknown>;
};

type TenantSecuritySettings = {
  mfaRequired: boolean;
  sessionTimeout: number;
  ipAllowlistEnabled: boolean;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
  };
};

const DEFAULT_TENANT_SECURITY_SETTINGS: TenantSecuritySettings = {
  mfaRequired: false,
  sessionTimeout: DEFAULT_SETTINGS.security.sessionTimeout,
  ipAllowlistEnabled: false,
  passwordPolicy: {
    minLength: DEFAULT_SETTINGS.security.passwordMinLength,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: false,
  },
};

type UserPreferencesRecord = {
  theme: string;
  notifications: unknown;
  customSettings: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRole(role?: string | null): string {
  return role?.toLowerCase() || '';
}

function normalizeSessionTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.security.sessionTimeout;
  }

  // Legacy settings stored this in minutes. Canonicalize to hours.
  if (value > 72) {
    return Math.max(1, Math.round(value / 60));
  }

  return value;
}

function normalizeSettingsSecurity(value: unknown): SettingsPayload['security'] {
  const security = isRecord(value) ? value : {};
  const passwordPolicy = isRecord(security.passwordPolicy) ? security.passwordPolicy : {};

  return {
    sessionTimeout: normalizeSessionTimeout(security.sessionTimeout),
    requireMFA:
      typeof security.requireMFA === 'boolean'
        ? security.requireMFA
        : typeof security.mfaRequired === 'boolean'
          ? security.mfaRequired
          : DEFAULT_SETTINGS.security.requireMFA,
    passwordMinLength:
      typeof security.passwordMinLength === 'number'
        ? security.passwordMinLength
        : typeof passwordPolicy.minLength === 'number'
          ? passwordPolicy.minLength
          : DEFAULT_SETTINGS.security.passwordMinLength,
    ipWhitelist: Array.isArray(security.ipWhitelist)
      ? security.ipWhitelist.filter((entry): entry is string => typeof entry === 'string')
      : DEFAULT_SETTINGS.security.ipWhitelist,
  };
}

function normalizeTenantSecuritySettings(value: unknown): TenantSecuritySettings {
  const security = isRecord(value) ? value : {};
  const passwordPolicy = isRecord(security.passwordPolicy) ? security.passwordPolicy : {};

  return {
    mfaRequired:
      typeof security.mfaRequired === 'boolean'
        ? security.mfaRequired
        : DEFAULT_TENANT_SECURITY_SETTINGS.mfaRequired,
    sessionTimeout: normalizeSessionTimeout(security.sessionTimeout),
    ipAllowlistEnabled:
      typeof security.ipAllowlistEnabled === 'boolean'
        ? security.ipAllowlistEnabled
        : DEFAULT_TENANT_SECURITY_SETTINGS.ipAllowlistEnabled,
    passwordPolicy: {
      minLength:
        typeof passwordPolicy.minLength === 'number'
          ? passwordPolicy.minLength
          : DEFAULT_TENANT_SECURITY_SETTINGS.passwordPolicy.minLength,
      requireUppercase:
        typeof passwordPolicy.requireUppercase === 'boolean'
          ? passwordPolicy.requireUppercase
          : DEFAULT_TENANT_SECURITY_SETTINGS.passwordPolicy.requireUppercase,
      requireNumbers:
        typeof passwordPolicy.requireNumbers === 'boolean'
          ? passwordPolicy.requireNumbers
          : DEFAULT_TENANT_SECURITY_SETTINGS.passwordPolicy.requireNumbers,
      requireSymbols:
        typeof passwordPolicy.requireSymbols === 'boolean'
          ? passwordPolicy.requireSymbols
          : DEFAULT_TENANT_SECURITY_SETTINGS.passwordPolicy.requireSymbols,
    },
  };
}

function mergeTenantSecurityUpdates(
  current: TenantSecuritySettings,
  updates: Record<string, unknown>,
): TenantSecuritySettings {
  return {
    ...current,
    mfaRequired:
      typeof updates.requireMFA === 'boolean' ? updates.requireMFA : current.mfaRequired,
    sessionTimeout:
      updates.sessionTimeout === undefined
        ? current.sessionTimeout
        : normalizeSessionTimeout(updates.sessionTimeout),
    passwordPolicy: {
      ...current.passwordPolicy,
      minLength:
        typeof updates.passwordMinLength === 'number'
          ? updates.passwordMinLength
          : current.passwordPolicy.minLength,
    },
  };
}

function mergeUserPreferences(
  settings: SettingsPayload,
  preferences: UserPreferencesRecord | null | undefined,
): SettingsPayload {
  if (!preferences) {
    return settings;
  }

  const customSettings = isRecord(preferences.customSettings)
    ? preferences.customSettings
    : {};
  const system = isRecord(customSettings.system) ? customSettings.system : {};
  const display = isRecord(customSettings.display) ? customSettings.display : {};
  const notifications = isRecord(preferences.notifications)
    ? preferences.notifications
    : isRecord(customSettings.notifications)
      ? customSettings.notifications
      : {};

  return deepMerge(settings, {
    system: {
      ...system,
      theme: preferences.theme || DEFAULT_SETTINGS.system.theme,
      // Tenant display currency / org name win over per-user overlay.
      currency: settings.system.currency,
      ourOrganization: settings.system.ourOrganization || system.ourOrganization || '',
    },
    display,
    notifications,
  }) as SettingsPayload;
}

export const GET = withAuthApiHandler(async (request, ctx) => {
  try {
    const tenantId = ctx.tenantId;

    // Try to find tenant settings in TenantSettings.customFields
    let settings = { ...DEFAULT_SETTINGS };

    if (tenantId) {
      const [tenantSettings, tenantConfig] = await Promise.all([
        prisma.tenantSettings.findFirst({
          where: { tenantId },
          select: { customFields: true },
        }),
        prisma.tenantConfig.findUnique({
          where: { tenantId },
          select: { securitySettings: true, workflowSettings: true },
        }),
      ]);

      if (tenantSettings?.customFields && typeof tenantSettings.customFields === 'object') {
        settings = deepMerge(DEFAULT_SETTINGS, tenantSettings.customFields as Record<string, unknown>) as typeof DEFAULT_SETTINGS;
      }

      settings = {
        ...settings,
        security: normalizeSettingsSecurity(tenantConfig?.securitySettings ?? settings.security),
      };
      if (tenantConfig?.workflowSettings && typeof tenantConfig.workflowSettings === 'object' && !Array.isArray(tenantConfig.workflowSettings)) {
        const workflow = tenantConfig.workflowSettings as Record<string, unknown>;
        if (workflow.processing && typeof workflow.processing === 'object' && !Array.isArray(workflow.processing)) {
          settings = deepMerge(settings, { processing: workflow.processing } as Record<string, unknown>) as typeof DEFAULT_SETTINGS;
        }
      }
    }

    // Get user-specific info
    if (ctx.userId) {
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          avatar: true,
          preferences: {
            select: {
              theme: true,
              notifications: true,
              customSettings: true,
            },
          },
        },
      });

      settings = mergeUserPreferences(settings as SettingsPayload, user?.preferences ?? null);

      return createSuccessResponse(ctx, {
        settings,
        user: user ? {
          name: user.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : user.email,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        } : null,
      }, {
        headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
      });
    }

    return createSuccessResponse(ctx, { settings, user: null }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
});

export const PUT = withAuthApiHandler(async (request, ctx) => {
  try {
    const body = await request.json();
    const { section, updates } = body;

    if (!section || !updates) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'section and updates are required', 400);
    }

    const validSections = ['system', 'notifications', 'security', 'display', 'processing'];
    if (!validSections.includes(section)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid section: ${section}. Must be one of: ${validSections.join(', ')}`, 400);
    }

    if (USER_MANAGED_SECTIONS.has(section)) {
      if (!ctx.userId) {
        return createErrorResponse(ctx, 'AUTH_REQUIRED', 'User context is required', 401);
      }

      const preferences = await prisma.userPreferences.findUnique({
        where: { userId: ctx.userId },
        select: {
          theme: true,
          notifications: true,
          customSettings: true,
        },
      });

      const currentCustomSettings = isRecord(preferences?.customSettings)
        ? preferences.customSettings
        : {};

      const nextCustomSettings = { ...currentCustomSettings };
      let nextTheme = preferences?.theme || DEFAULT_SETTINGS.system.theme;
      let nextNotifications = isRecord(preferences?.notifications)
        ? preferences.notifications
        : {};

      if (section === 'notifications') {
        const currentNotifications = isRecord(nextNotifications)
          ? nextNotifications
          : DEFAULT_SETTINGS.notifications;
        nextNotifications = {
          ...currentNotifications,
          ...updates,
        };
      } else {
        const currentSection = isRecord(nextCustomSettings[section])
          ? nextCustomSettings[section]
          : DEFAULT_SETTINGS[section as 'system' | 'display'];

        const updatedSection = {
          ...currentSection,
          ...updates,
        };

        nextCustomSettings[section] = updatedSection;

        if (section === 'system' && typeof updatedSection.theme === 'string') {
          nextTheme = updatedSection.theme;
        }
      }

      await prisma.userPreferences.upsert({
        where: { userId: ctx.userId },
        update: {
          theme: nextTheme,
          notifications: nextNotifications as any,
          customSettings: nextCustomSettings as any,
        },
        create: {
          userId: ctx.userId,
          theme: nextTheme,
          notifications: nextNotifications as any,
          customSettings: nextCustomSettings as any,
        },
      });

      if (section === 'system' && ctx.tenantId && (typeof updates.ourOrganization === 'string' || typeof updates.currency === 'string')) {
        const existingTenantSettings = await prisma.tenantSettings.findFirst({
          where: { tenantId: ctx.tenantId },
          select: { id: true, customFields: true },
        });
        const currentFields = existingTenantSettings?.customFields && typeof existingTenantSettings.customFields === 'object'
          ? existingTenantSettings.customFields as Record<string, unknown>
          : {};
        const currentSystem = currentFields.system && typeof currentFields.system === 'object'
          ? currentFields.system as Record<string, unknown>
          : {};
        const tenantSystem = { ...currentSystem };
        if (typeof updates.ourOrganization === 'string') tenantSystem.ourOrganization = updates.ourOrganization
        if (typeof updates.currency === 'string') tenantSystem.currency = updates.currency
        const nextFields = {
          ...currentFields,
          ...(typeof updates.ourOrganization === 'string' ? { ourOrganization: updates.ourOrganization } : {}),
          system: tenantSystem,
        };
        if (existingTenantSettings) {
          await prisma.tenantSettings.update({
            where: { id: existingTenantSettings.id },
            data: { customFields: nextFields as any },
          });
        } else {
          await prisma.tenantSettings.create({
            data: { tenantId: ctx.tenantId, customFields: nextFields as any },
          });
        }
      }

      let tenantBase = { ...DEFAULT_SETTINGS } as SettingsPayload
      if (ctx.tenantId) {
        const tenantRow = await prisma.tenantSettings.findFirst({
          where: { tenantId: ctx.tenantId },
          select: { customFields: true },
        })
        if (tenantRow?.customFields && typeof tenantRow.customFields === 'object') {
          tenantBase = deepMerge(DEFAULT_SETTINGS, tenantRow.customFields as Record<string, unknown>) as SettingsPayload
        }
      }
      const settings = mergeUserPreferences(
        tenantBase,
        {
          theme: nextTheme,
          notifications: nextNotifications,
          customSettings: nextCustomSettings,
        },
      );

      return createSuccessResponse(ctx, {
        settings,
        section,
        updated: true,
        scope: 'user',
      });
    }

    if (TENANT_MANAGED_SECTIONS.has(section) && !TENANT_ADMIN_ROLES.has(normalizeRole(ctx.userRole))) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required for tenant-wide settings', 403);
    }

    const tenantId = ctx.tenantId;

    if (section === 'security') {
      if (!tenantId) {
        return createErrorResponse(ctx, 'TENANT_REQUIRED', 'No tenant context found', 400);
      }

      const securityUpdates = isRecord(updates) ? updates : {};
      const nextSessionTimeout =
        securityUpdates.sessionTimeout === undefined
          ? undefined
          : normalizeSessionTimeout(securityUpdates.sessionTimeout);

      if (
        nextSessionTimeout !== undefined &&
        (nextSessionTimeout < 1 || nextSessionTimeout > 720)
      ) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Session timeout must be between 1 and 720 hours', 400);
      }

      if (
        typeof securityUpdates.passwordMinLength === 'number' &&
        (securityUpdates.passwordMinLength < 6 || securityUpdates.passwordMinLength > 32)
      ) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Password minimum length must be between 6 and 32', 400);
      }

      const tenantConfig = await prisma.tenantConfig.findUnique({
        where: { tenantId },
        select: { securitySettings: true },
      });

      const currentSecuritySettings = normalizeTenantSecuritySettings(tenantConfig?.securitySettings);
      const updatedSecuritySettings = mergeTenantSecurityUpdates(currentSecuritySettings, securityUpdates);

      await prisma.tenantConfig.upsert({
        where: { tenantId },
        update: {
          securitySettings: updatedSecuritySettings as any,
        },
        create: {
          tenantId,
          securitySettings: updatedSecuritySettings as any,
        },
      });

      return createSuccessResponse(ctx, {
        settings: {
          security: normalizeSettingsSecurity(updatedSecuritySettings),
        },
        section,
        updated: true,
        scope: 'tenant',
      });
    }

    if (tenantId) {
      if (section === 'processing') {
        const tenantConfig = await prisma.tenantConfig.findUnique({
          where: { tenantId },
          select: { workflowSettings: true },
        });
        const currentWorkflow = tenantConfig?.workflowSettings && typeof tenantConfig.workflowSettings === 'object' && !Array.isArray(tenantConfig.workflowSettings)
          ? tenantConfig.workflowSettings as Record<string, unknown>
          : {};
        const currentProcessing = currentWorkflow.processing && typeof currentWorkflow.processing === 'object' && !Array.isArray(currentWorkflow.processing)
          ? currentWorkflow.processing as Record<string, unknown>
          : {};
        const processing = { ...currentProcessing, ...updates };
        await prisma.tenantConfig.upsert({
          where: { tenantId },
          update: { workflowSettings: { ...currentWorkflow, processing } as any },
          create: { tenantId, workflowSettings: { processing } as any },
        });
      }
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

      return createSuccessResponse(ctx, {
        settings: updatedSettings,
        section,
        updated: true,
        scope: 'tenant',
      });
    }

    return createErrorResponse(ctx, 'TENANT_REQUIRED', 'No tenant context found', 400);
  } catch (error) {
    return handleApiError(ctx, error);
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
