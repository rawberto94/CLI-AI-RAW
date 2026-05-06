/**
 * User Groups API
 *
 * Organize users into teams/groups with shared permissions
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';
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
export const GET = withAuthApiHandler(async (_request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const groups = await prisma.userGroup.findMany({
    where: { tenantId: ctx.tenantId },
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
    take: 100,
  });

  return createSuccessResponse(ctx, {
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
  }, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
  });
});

/**
 * POST /api/admin/groups - Create a new group
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json();
  const validation = groupSchema.safeParse(body);

  if (!validation.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', validation.error.errors[0].message, 400);
  }

  const { name, description, color, permissions, departmentAccess, contractAccess } = validation.data;

  // Check for duplicate name
  const existing = await prisma.userGroup.findFirst({
    where: { tenantId: ctx.tenantId, name },
  });

  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', 'Group name already exists', 409);
  }

  const group = await prisma.userGroup.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      description,
      color: color || '#8B5CF6',
      permissions: permissions || [],
      departmentAccess: departmentAccess || [],
      contractAccessLevel: contractAccess || 'assigned',
      createdBy: ctx.userId,
    },
  });

  await auditLog({
    action: AuditAction.GROUP_CREATED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'user_group',
    resourceId: group.id,
    metadata: { name, permissions },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { group });
});

/**
 * PUT /api/admin/groups - Update a group
 */
export const PUT = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const body = await request.json();
  const { groupId, ...updateData } = body;

  if (!groupId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group ID required', 400);
  }

  const validation = groupSchema.partial().safeParse(updateData);
  if (!validation.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', validation.error.errors[0].message, 400);
  }

  // Verify group belongs to tenant
  const existing = await prisma.userGroup.findFirst({
    where: { id: groupId, tenantId: ctx.tenantId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Group not found', 404);
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
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'user_group',
    resourceId: groupId,
    metadata: updateData,
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { group });
});

/**
 * DELETE /api/admin/groups - Delete a group
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { groupId } = await request.json();

  if (!groupId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group ID required', 400);
  }

  // Verify group belongs to tenant
  const existing = await prisma.userGroup.findFirst({
    where: { id: groupId, tenantId: ctx.tenantId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Group not found', 404);
  }

  await prisma.userGroup.delete({
    where: { id: groupId },
  });

  await auditLog({
    action: AuditAction.GROUP_DELETED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'user_group',
    resourceId: groupId,
    metadata: { name: existing.name },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { deleted: true });
});
