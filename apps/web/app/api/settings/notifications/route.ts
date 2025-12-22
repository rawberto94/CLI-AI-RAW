/**
 * Notification Settings API
 * 
 * GET /api/settings/notifications - Get user notification preferences
 * PUT /api/settings/notifications - Update notification preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Default notification settings
const defaultSettings = {
  email: {
    enabled: true,
    contractExpiry: true,
    approvalRequests: true,
    approvalUpdates: true,
    weeklyDigest: true,
    mentions: true,
    systemAlerts: true,
  },
  push: {
    enabled: false,
    contractExpiry: true,
    approvalRequests: true,
    urgentOnly: false,
  },
  timing: {
    expiryAlertDays: [90, 60, 30, 14, 7, 3, 1],
    digestDay: 'monday',
    digestTime: '09:00',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  },
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Try to get existing settings from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        notificationSettings: true,
      },
    });

    // Return stored settings or defaults
    const settings = user?.notificationSettings 
      ? { ...defaultSettings, ...(user.notificationSettings as object) }
      : defaultSettings;

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to get notification settings:', error);
    return NextResponse.json(
      { error: 'Failed to get notification settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate the settings structure
    const settings = {
      email: {
        enabled: Boolean(body.email?.enabled ?? defaultSettings.email.enabled),
        contractExpiry: Boolean(body.email?.contractExpiry ?? defaultSettings.email.contractExpiry),
        approvalRequests: Boolean(body.email?.approvalRequests ?? defaultSettings.email.approvalRequests),
        approvalUpdates: Boolean(body.email?.approvalUpdates ?? defaultSettings.email.approvalUpdates),
        weeklyDigest: Boolean(body.email?.weeklyDigest ?? defaultSettings.email.weeklyDigest),
        mentions: Boolean(body.email?.mentions ?? defaultSettings.email.mentions),
        systemAlerts: Boolean(body.email?.systemAlerts ?? defaultSettings.email.systemAlerts),
      },
      push: {
        enabled: Boolean(body.push?.enabled ?? defaultSettings.push.enabled),
        contractExpiry: Boolean(body.push?.contractExpiry ?? defaultSettings.push.contractExpiry),
        approvalRequests: Boolean(body.push?.approvalRequests ?? defaultSettings.push.approvalRequests),
        urgentOnly: Boolean(body.push?.urgentOnly ?? defaultSettings.push.urgentOnly),
      },
      timing: {
        expiryAlertDays: Array.isArray(body.timing?.expiryAlertDays) 
          ? body.timing.expiryAlertDays.filter((d: unknown) => typeof d === 'number')
          : defaultSettings.timing.expiryAlertDays,
        digestDay: ['monday', 'friday', 'sunday'].includes(body.timing?.digestDay) 
          ? body.timing.digestDay 
          : defaultSettings.timing.digestDay,
        digestTime: typeof body.timing?.digestTime === 'string'
          ? body.timing.digestTime
          : defaultSettings.timing.digestTime,
        quietHoursEnabled: Boolean(body.timing?.quietHoursEnabled ?? defaultSettings.timing.quietHoursEnabled),
        quietHoursStart: typeof body.timing?.quietHoursStart === 'string'
          ? body.timing.quietHoursStart
          : defaultSettings.timing.quietHoursStart,
        quietHoursEnd: typeof body.timing?.quietHoursEnd === 'string'
          ? body.timing.quietHoursEnd
          : defaultSettings.timing.quietHoursEnd,
      },
    };

    // Update user settings
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notificationSettings: settings,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification settings saved',
      settings,
    });
  } catch (error) {
    console.error('Failed to update notification settings:', error);
    return NextResponse.json(
      { error: 'Failed to update notification settings' },
      { status: 500 }
    );
  }
}
