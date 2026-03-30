/**
 * User Preferences API
 * 
 * Endpoints for managing user preferences including:
 * - Dashboard layout and widget configurations
 * - Theme preferences
 * - Notification settings
 * - Default views and filters
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { auditTrailService } from 'data-orchestration/services';

// ============ Types ============

interface DashboardWidget {
  id: string;
  visible: boolean;
  position: number;
  size?: 'sm' | 'md' | 'lg' | 'full';
  config?: Record<string, unknown>;
}

interface DashboardPreferences {
  layout: 'grid' | 'list' | 'compact';
  widgets: DashboardWidget[];
  defaultView: string;
  refreshInterval: number;
}

interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  digest: 'none' | 'daily' | 'weekly';
  categories: {
    renewals: boolean;
    expirations: boolean;
    approvals: boolean;
    risks: boolean;
    mentions: boolean;
    updates: boolean;
  };
}

interface ContractPreferences {
  defaultView: 'grid' | 'list' | 'table' | 'calendar';
  defaultSort: string;
  defaultFilters: Record<string, unknown>;
  pageSize: number;
  showArchived: boolean;
  autoSave: boolean;
}

interface UserPreferences {
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  dataMode: 'live' | 'mock';
  dashboard: DashboardPreferences;
  notifications: NotificationPreferences;
  contracts: ContractPreferences;
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
  };
  shortcuts: Record<string, string>;
}

// ============ Default Preferences ============

const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  timezone: 'UTC',
  dateFormat: 'MM/dd/yyyy',
  currency: 'USD',
  dataMode: 'live',
  dashboard: {
    layout: 'grid',
    widgets: [
      { id: 'stats', visible: true, position: 0, size: 'full' },
      { id: 'notifications', visible: true, position: 1, size: 'md' },
      { id: 'ai-insights', visible: true, position: 2, size: 'md' },
      { id: 'favorites', visible: true, position: 3, size: 'md' },
      { id: 'renewals', visible: true, position: 4, size: 'md' },
      { id: 'activity', visible: true, position: 5, size: 'full' },
      { id: 'savings', visible: true, position: 6, size: 'md' },
      { id: 'team', visible: true, position: 7, size: 'md' },
      { id: 'integrations', visible: true, position: 8, size: 'md' },
    ],
    defaultView: 'overview',
    refreshInterval: 300000, // 5 minutes
  },
  notifications: {
    email: true,
    push: true,
    inApp: true,
    digest: 'daily',
    categories: {
      renewals: true,
      expirations: true,
      approvals: true,
      risks: true,
      mentions: true,
      updates: true,
    },
  },
  contracts: {
    defaultView: 'grid',
    defaultSort: 'updatedAt:desc',
    defaultFilters: {},
    pageSize: 20,
    showArchived: false,
    autoSave: true,
  },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    fontSize: 'medium',
  },
  shortcuts: {},
};

// ============ GET - Fetch preferences ============

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: {
      id: true,
      preferences: true,
    },
  });

  if (!user) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
  }

  // Merge saved preferences with defaults
  const savedPreferences = (user.preferences as Record<string, unknown>) || {};
  const mergedPreferences = deepMerge(defaultPreferences, savedPreferences);

  return createSuccessResponse(ctx, {
    preferences: mergedPreferences,
    isDefault: !user.preferences,
  });
});

// ============ POST - Create/Update preferences (legacy) ============

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const preferences = await request.json();

  // Get current preferences and merge
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { preferences: true },
  });

  const currentPreferences = (user?.preferences as Record<string, unknown>) || defaultPreferences;
  const newPreferences = deepMerge(currentPreferences, preferences);

  // Update user preferences
  await prisma.user.update({
    where: { id: ctx.userId },
    data: { preferences: newPreferences },
  });

  return createSuccessResponse(ctx, {
    success: true,
    preferences: newPreferences
  });
});

// ============ PUT - Full update ============

export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { preferences, partial = false } = body;

  if (!preferences) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Preferences data required', 400);
  }

  // Get current preferences if partial update
  let newPreferences = preferences;

  if (partial) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { preferences: true },
    });

    const currentPreferences = (user?.preferences as Record<string, unknown>) || defaultPreferences;
    newPreferences = deepMerge(currentPreferences, preferences);
  }

  // Update user preferences
  const updatedUser = await prisma.user.update({
    where: { id: ctx.userId },
    data: {
      preferences: newPreferences,
    },
    select: {
      id: true,
      preferences: true,
    },
  });

  return createSuccessResponse(ctx, {
    success: true,
    preferences: updatedUser.preferences,
  });
});

// ============ PATCH - Partial update ============

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { path, value } = body;

  if (!path) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Path required for partial update', 400);
  }

  // Get current preferences
  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { preferences: true },
  });

  const currentPreferences = (user?.preferences as Record<string, unknown>) || { ...defaultPreferences };

  // Set nested value by path (e.g., "dashboard.layout" or "notifications.email")
  setNestedValue(currentPreferences, path, value);

  // Update user preferences
  const updatedUser = await prisma.user.update({
    where: { id: ctx.userId },
    data: {
      preferences: currentPreferences,
    },
    select: {
      id: true,
      preferences: true,
    },
  });

  return createSuccessResponse(ctx, {
    success: true,
    preferences: updatedUser.preferences,
  });
});

// ============ DELETE - Reset to defaults ============

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');

  if (section) {
    // Reset only specific section
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { preferences: true },
    });

    const currentPreferences = (user?.preferences as Record<string, unknown>) || {};

    // Reset specific section to default
    if (section in defaultPreferences) {
      (currentPreferences as Record<string, unknown>)[section] = 
        (defaultPreferences as Record<string, unknown>)[section];
    }

    // Reset specific section to default using upsert on UserPreferences
    await prisma.userPreferences.upsert({
      where: { userId: ctx.userId },
      create: {
        userId: ctx.userId,
        customSettings: JSON.parse(JSON.stringify(currentPreferences)),
      },
      update: {
        customSettings: JSON.parse(JSON.stringify(currentPreferences)),
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: `${section} preferences reset to defaults`,
      preferences: currentPreferences,
    });
  }

  // Reset all preferences
  // Note: preferences is a relation to UserPreferences model
  // For now, upsert the preferences relation with default values
  await prisma.userPreferences.upsert({
    where: { userId: ctx.userId },
    create: {
      userId: ctx.userId,
      theme: defaultPreferences.theme === 'system' ? 'light' : defaultPreferences.theme,
      notifications: JSON.parse(JSON.stringify(defaultPreferences.notifications)),
      customSettings: JSON.parse(JSON.stringify(defaultPreferences)),
    },
    update: {
      theme: defaultPreferences.theme === 'system' ? 'light' : defaultPreferences.theme,
      notifications: JSON.parse(JSON.stringify(defaultPreferences.notifications)),
      customSettings: JSON.parse(JSON.stringify(defaultPreferences)),
    },
  });

  return createSuccessResponse(ctx, {
    success: true,
    message: 'All preferences reset to defaults',
    preferences: defaultPreferences,
  });
});

// ============ Utility Functions ============

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];
      
      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }
  
  return result;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  
  current[keys[keys.length - 1]] = value;
}
