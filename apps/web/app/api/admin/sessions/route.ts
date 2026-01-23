/**
 * Admin Sessions API
 * Manage active user sessions across the organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

// GET - List all active sessions for the tenant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true },
    });

    if (!user || !['admin', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all sessions for users in this tenant
    const sessions = await prisma.userSession.findMany({
      where: {
        user: {
          tenantId: user.tenantId,
        },
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get current session token for comparison
    const currentToken = request.cookies.get('next-auth.session-token')?.value;

    return NextResponse.json({
      sessions: sessions.map(s => ({
        id: s.id,
        userId: s.userId,
        userEmail: s.user.email,
        userName: `${s.user.firstName || ''} ${s.user.lastName || ''}`.trim() || s.user.email,
        ipAddress: s.ipAddress || 'Unknown',
        userAgent: s.userAgent || 'Unknown',
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isCurrent: s.token === currentToken,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Revoke all sessions (except current)
export async function DELETE(request: NextRequest) {
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

    const currentToken = request.cookies.get('next-auth.session-token')?.value;

    // Delete all sessions except current user's current session
    const result = await prisma.userSession.deleteMany({
      where: {
        user: {
          tenantId: user.tenantId,
        },
        NOT: {
          token: currentToken,
        },
      },
    });

    return NextResponse.json({
      success: true,
      revokedCount: result.count,
    });
  } catch (error) {
    console.error('Failed to revoke sessions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
