/**
 * Group Members API
 * 
 * Manage members within a user group
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction } from '@/lib/security/audit';

/**
 * POST /api/admin/groups/members - Add members to a group
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'users:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { groupId, userIds, role = 'member' } = await request.json();
    
    if (!groupId || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: 'groupId and userIds array required' }, { status: 400 });
    }
    
    // Verify group belongs to tenant
    const group = await prisma.userGroup.findFirst({
      where: { id: groupId, tenantId: session.user.tenantId },
    });
    
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    // Verify all users belong to same tenant
    const users = await prisma.user.findMany({
      where: { 
        id: { in: userIds },
        tenantId: session.user.tenantId,
      },
      select: { id: true, email: true },
    });
    
    const validUserIds = users.map(u => u.id);
    
    // Add members
    await prisma.userGroupMember.createMany({
      data: validUserIds.map(userId => ({
        groupId,
        userId,
        role,
        addedById: session.user.id,
      })),
      skipDuplicates: true,
    });
    
    await auditLog({
      action: AuditAction.GROUP_MEMBERS_ADDED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'user_group',
      resourceId: groupId,
      metadata: { 
        groupName: group.name,
        addedUserIds: validUserIds,
        role,
      },
      request,
    });
    
    return NextResponse.json({ 
      success: true,
      addedCount: validUserIds.length,
      skippedCount: userIds.length - validUserIds.length,
    });
  } catch (error) {
    console.error('[Group Members POST Error]:', error);
    return NextResponse.json({ error: 'Failed to add members' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/groups/members - Remove members from a group
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'users:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { groupId, userIds } = await request.json();
    
    if (!groupId || !userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: 'groupId and userIds array required' }, { status: 400 });
    }
    
    // Verify group belongs to tenant
    const group = await prisma.userGroup.findFirst({
      where: { id: groupId, tenantId: session.user.tenantId },
    });
    
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    const result = await prisma.userGroupMember.deleteMany({
      where: {
        groupId,
        userId: { in: userIds },
      },
    });
    
    await auditLog({
      action: AuditAction.GROUP_MEMBERS_REMOVED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'user_group',
      resourceId: groupId,
      metadata: { 
        groupName: group.name,
        removedUserIds: userIds,
        removedCount: result.count,
      },
      request,
    });
    
    return NextResponse.json({ success: true, removedCount: result.count });
  } catch (error) {
    console.error('[Group Members DELETE Error]:', error);
    return NextResponse.json({ error: 'Failed to remove members' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/groups/members - Update member role
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'users:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { groupId, userId, role } = await request.json();
    
    if (!groupId || !userId || !role) {
      return NextResponse.json({ error: 'groupId, userId, and role required' }, { status: 400 });
    }
    
    // Verify group belongs to tenant
    const group = await prisma.userGroup.findFirst({
      where: { id: groupId, tenantId: session.user.tenantId },
    });
    
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    await prisma.userGroupMember.update({
      where: {
        userId_groupId: { userId, groupId },
      },
      data: { role },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Group Members PUT Error]:', error);
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
  }
}
