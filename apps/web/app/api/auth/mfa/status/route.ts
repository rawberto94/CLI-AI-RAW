/**
 * MFA Status API
 * Check if MFA is enabled for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true,
        email: true,
        mfaEnabled: true,
        mfaEnabledAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      enabled: user.mfaEnabled,
      method: user.mfaEnabled ? 'totp' : null,
      enrolledAt: user.mfaEnabledAt?.toISOString() || null,
    });
  } catch (error) {
    console.error('Failed to get MFA status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
