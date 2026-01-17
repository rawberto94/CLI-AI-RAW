/**
 * User Preferences API
 * 
 * Endpoints for managing user preferences including:
 * - Dashboard layout and widget configurations
 * - Theme preferences
 * - Notification settings
 * - Default views and filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
  dataMode: 'mock',
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

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      // Return default preferences for unauthenticated users
      return NextResponse.json({
        preferences: defaultPreferences,
        isDefault: true,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        preferences: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Merge saved preferences with defaults
    const savedPreferences = (user.preferences as Record<string, unknown>) || {};
    const mergedPreferences = deepMerge(defaultPreferences, savedPreferences);

    return NextResponse.json({
      preferences: mergedPreferences,
      isDefault: !user.preferences,
    });
  } catch {
    return NextResponse.json({
      preferences: defaultPreferences,
      isDefault: true,
    });
  }
}

// ============ POST - Create/Update preferences (legacy) ============

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const preferences = await request.json();
    
    if (!session?.user?.id) {
      // For unauthenticated, just return success (client-side storage)
      return NextResponse.json({
        success: true,
        preferences
      });
    }

    // Get current preferences and merge
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPreferences = (user?.preferences as Record<string, unknown>) || defaultPreferences;
    const newPreferences = deepMerge(currentPreferences, preferences);

    // Update user preferences
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: newPreferences },
    });

    return NextResponse.json({
      success: true,
      preferences: newPreferences
    });
  } catch {
    return NextResponse.json({
      success: true,
      preferences: await request.json()
    });
  }
}

// ============ PUT - Full update ============

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { preferences, partial = false } = body;

    if (!preferences) {
      return NextResponse.json(
        { error: 'Preferences data required' },
        { status: 400 }
      );
    }

    // Get current preferences if partial update
    let newPreferences = preferences;
    
    if (partial) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { preferences: true },
      });
      
      const currentPreferences = (user?.preferences as Record<string, unknown>) || defaultPreferences;
      newPreferences = deepMerge(currentPreferences, preferences);
    }

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: newPreferences,
      },
      select: {
        id: true,
        preferences: true,
      },
    });

    return NextResponse.json({
      success: true,
      preferences: updatedUser.preferences,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

// ============ PATCH - Partial update ============

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { path, value } = body;

    if (!path) {
      return NextResponse.json(
        { error: 'Path required for partial update' },
        { status: 400 }
      );
    }

    // Get current preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });

    const currentPreferences = (user?.preferences as Record<string, unknown>) || { ...defaultPreferences };
    
    // Set nested value by path (e.g., "dashboard.layout" or "notifications.email")
    setNestedValue(currentPreferences, path, value);

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: currentPreferences,
      },
      select: {
        id: true,
        preferences: true,
      },
    });

    return NextResponse.json({
      success: true,
      preferences: updatedUser.preferences,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to patch preferences' },
      { status: 500 }
    );
  }
}

// ============ DELETE - Reset to defaults ============

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    if (section) {
      // Reset only specific section
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
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
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
          customSettings: JSON.parse(JSON.stringify(currentPreferences)),
        },
        update: {
          customSettings: JSON.parse(JSON.stringify(currentPreferences)),
        },
      });

      return NextResponse.json({
        success: true,
        message: `${section} preferences reset to defaults`,
        preferences: currentPreferences,
      });
    }

    // Reset all preferences
    // Note: preferences is a relation to UserPreferences model
    // For now, upsert the preferences relation with default values
    await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
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

    return NextResponse.json({
      success: true,
      message: 'All preferences reset to defaults',
      preferences: defaultPreferences,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to reset preferences' },
      { status: 500 }
    );
  }
}

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
