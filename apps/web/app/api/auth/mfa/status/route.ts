/**
 * MFA Status API
 * Check if MFA is enabled for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
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
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if MFA is set up (stored in a secure location)
    // For now, check user preferences or a dedicated MFA table
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
    });

    const mfaSettings = (preferences?.settings as any)?.mfa || null;

    return NextResponse.json({
      enabled: !!mfaSettings?.enabled,
      method: mfaSettings?.method || null,
      enrolledAt: mfaSettings?.enrolledAt || null,
    });
  } catch (error) {
    console.error('Failed to get MFA status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
