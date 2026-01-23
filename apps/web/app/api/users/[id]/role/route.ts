/**
 * User Role Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';

const VALID_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

// PUT - Update user's role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tenantId: true, role: true },
    });

    if (!currentUser || !['admin', 'owner'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: ' + VALID_ROLES.join(', ') },
        { status: 400 }
      );
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, role: true, email: true },
    });

    if (!targetUser || targetUser.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot change owner role unless you're also owner
    if (targetUser.role === 'owner' && currentUser.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can change owner roles' },
        { status: 403 }
      );
    }

    // Cannot promote to owner unless you're owner
    if (role === 'owner' && currentUser.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can promote to owner' },
        { status: 403 }
      );
    }

    // Cannot demote yourself
    if (targetUser.id === session.user.id && role !== currentUser.role) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Update role
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        tenantId: currentUser.tenantId,
        userId: session.user.id,
        action: 'USER_ROLE_CHANGED',
        resourceType: 'user',
        resourceId: userId,
        details: {
          targetEmail: targetUser.email,
          previousRole: targetUser.role,
          newRole: role,
        },
      },
    });

    return NextResponse.json({
      success: true,
      userId,
      role,
    });
  } catch (error) {
    console.error('Failed to update user role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
