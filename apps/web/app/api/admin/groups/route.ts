/**
 * User Groups API
 * 
 * Organize users into teams/groups with shared permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';
import { z } from 'zod';

const groupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  permissions: z.array(z.string()).optional(),
  departmentAccess: z.array(z.string()).optional(),
  contractAccess: z.enum(['all', 'assigned', 'department', 'none']).optional(),
});

/**
 * GET /api/admin/groups - List all groups
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const groups = await prisma.userGroup.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true, avatar: true },
            },
          },
        },
        _count: {
          select: { members: true, contractAccess: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    
    return NextResponse.json({
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        color: g.color,
        permissions: g.permissions,
        departmentAccess: g.departmentAccess,
        contractAccessLevel: g.contractAccessLevel,
        memberCount: g._count.members,
        contractCount: g._count.contractAccess,
        members: g.members.map(m => ({
          id: m.user.id,
          email: m.user.email,
          name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim() || m.user.email,
          avatar: m.user.avatar,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        createdAt: g.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Groups GET Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

/**
 * POST /api/admin/groups - Create a new group
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
    
    const body = await request.json();
    const validation = groupSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }
    
    const { name, description, color, permissions, departmentAccess, contractAccess } = validation.data;
    
    // Check for duplicate name
    const existing = await prisma.userGroup.findFirst({
      where: { tenantId: session.user.tenantId, name },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'Group name already exists' }, { status: 409 });
    }
    
    const group = await prisma.userGroup.create({
      data: {
        tenantId: session.user.tenantId,
        name,
        description,
        color: color || '#3B82F6',
        permissions: permissions || [],
        departmentAccess: departmentAccess || [],
        contractAccessLevel: contractAccess || 'assigned',
        createdBy: session.user.id,
      },
    });
    
    await auditLog({
      action: AuditAction.GROUP_CREATED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'user_group',
      resourceId: group.id,
      metadata: { name, permissions },
      ...getAuditContext(request),
    });
    
    return NextResponse.json({ success: true, group });
  } catch (error) {
    console.error('[Groups POST Error]:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/groups - Update a group
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
    
    const body = await request.json();
    const { groupId, ...updateData } = body;
    
    if (!groupId) {
      return NextResponse.json({ error: 'Group ID required' }, { status: 400 });
    }
    
    const validation = groupSchema.partial().safeParse(updateData);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
    }
    
    // Verify group belongs to tenant
    const existing = await prisma.userGroup.findFirst({
      where: { id: groupId, tenantId: session.user.tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    const group = await prisma.userGroup.update({
      where: { id: groupId },
      data: {
        name: validation.data.name,
        description: validation.data.description,
        color: validation.data.color,
        permissions: validation.data.permissions,
        departmentAccess: validation.data.departmentAccess,
        contractAccessLevel: validation.data.contractAccess,
      },
    });
    
    await auditLog({
      action: AuditAction.GROUP_UPDATED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'user_group',
      resourceId: groupId,
      metadata: updateData,
      ...getAuditContext(request),
    });
    
    return NextResponse.json({ success: true, group });
  } catch (error) {
    console.error('[Groups PUT Error]:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/groups - Delete a group
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
    
    const { groupId } = await request.json();
    
    if (!groupId) {
      return NextResponse.json({ error: 'Group ID required' }, { status: 400 });
    }
    
    // Verify group belongs to tenant
    const existing = await prisma.userGroup.findFirst({
      where: { id: groupId, tenantId: session.user.tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    await prisma.userGroup.delete({
      where: { id: groupId },
    });
    
    await auditLog({
      action: AuditAction.GROUP_DELETED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'user_group',
      resourceId: groupId,
      metadata: { name: existing.name },
      ...getAuditContext(request),
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Groups DELETE Error]:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
