/**
 * Admin Security Settings API
 * Manage tenant-wide security configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

interface SecuritySettings {
  mfaRequired: boolean;
  sessionTimeout: number; // hours
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

// GET - Get security settings for tenant
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true },
    });

    if (!user || !['admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get tenant config
    const config = await prisma.tenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    const securitySettings = config?.securitySettings as unknown as SecuritySettings | null;

    return NextResponse.json({
      settings: securitySettings || DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error('Failed to fetch security settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update security settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true },
    });

    if (!user || !['admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body as { settings: Partial<SecuritySettings> };

    // Validate settings
    if (settings.sessionTimeout && (settings.sessionTimeout < 1 || settings.sessionTimeout > 720)) {
      return NextResponse.json(
        { error: 'Session timeout must be between 1 and 720 hours' },
        { status: 400 }
      );
    }

    if (settings.passwordPolicy?.minLength && 
        (settings.passwordPolicy.minLength < 6 || settings.passwordPolicy.minLength > 32)) {
      return NextResponse.json(
        { error: 'Password minimum length must be between 6 and 32' },
        { status: 400 }
      );
    }

    // Get current settings
    const config = await prisma.tenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });

    const currentSettings = (config?.securitySettings as unknown as SecuritySettings) || DEFAULT_SETTINGS;

    // Merge settings
    const updatedSettings: SecuritySettings = {
      ...currentSettings,
      ...settings,
      passwordPolicy: {
        ...currentSettings.passwordPolicy,
        ...settings.passwordPolicy,
      },
    };

    // Upsert tenant config
    await prisma.tenantConfig.upsert({
      where: { tenantId: user.tenantId },
      update: {
        securitySettings: updatedSettings as any,
      },
      create: {
        tenantId: user.tenantId,
        securitySettings: updatedSettings as any,
      },
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: session.user.id,
        action: 'SECURITY_SETTINGS_UPDATED',
        resourceType: 'tenant_config',
        resource: user.tenantId,
        details: { updatedFields: Object.keys(settings) },
      },
    });

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error) {
    console.error('Failed to update security settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
