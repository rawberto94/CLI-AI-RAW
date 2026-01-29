/**
 * MFA Disable API
 * Disable MFA for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

export async function POST(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has MFA enabled
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaEnabled: true, tenantId: true },
    });

    if (!user?.mfaEnabled) {
      return NextResponse.json({ error: 'MFA not enabled' }, { status: 400 });
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
        mfaPendingSecret: null,
        mfaPendingBackupCodes: [],
        mfaEnabledAt: null,
      },
    });

    // Log the event
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: session.user.id,
        action: 'MFA_DISABLED',
        resourceType: 'user',
        resource: session.user.id,
        details: {},
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to disable MFA:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
