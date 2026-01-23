/**
 * MFA Disable API
 * Disable MFA for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user preferences
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    if (!preferences) {
      return NextResponse.json({ error: 'MFA not enabled' }, { status: 400 });
    }

    const settings = preferences.settings as any || {};

    if (!settings.mfa?.enabled) {
      return NextResponse.json({ error: 'MFA not enabled' }, { status: 400 });
    }

    // Disable MFA
    await prisma.userPreferences.update({
      where: { userId: session.user.id },
      data: {
        settings: {
          ...settings,
          mfa: {
            enabled: false,
            method: null,
            secret: null,
            disabledAt: new Date().toISOString(),
          },
        },
      },
    });

    // Log the event
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true },
    });

    if (user) {
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: session.user.id,
          action: 'MFA_DISABLED',
          resourceType: 'user',
          resourceId: session.user.id,
          details: {},
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to disable MFA:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
