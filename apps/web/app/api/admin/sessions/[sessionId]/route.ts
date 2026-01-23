/**
 * Admin Session Management - Single Session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

// DELETE - Revoke a specific session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
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

    // Verify the session belongs to a user in the same tenant
    const targetSession = await prisma.userSession.findUnique({
      where: { id: params.sessionId },
      include: {
        user: {
          select: { tenantId: true },
        },
      },
    });

    if (!targetSession || targetSession.user.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await prisma.userSession.delete({
      where: { id: params.sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to revoke session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
