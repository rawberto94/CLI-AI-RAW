/**
 * Group Members API
 *
 * Manage members within a user group
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';

/**
 * POST /api/admin/groups/members - Add members to a group
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { groupId, userIds, role = 'member' } = await request.json();

  if (!groupId || !userIds || !Array.isArray(userIds)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'groupId and userIds array required', 400);
  }

  // Verify group belongs to tenant
  const group = await prisma.userGroup.findFirst({
    where: { id: groupId, tenantId: ctx.tenantId },
  });

  if (!group) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Group not found', 404);
  }

  // Verify all users belong to same tenant
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      tenantId: ctx.tenantId,
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
      addedBy: ctx.userId,
    })),
    skipDuplicates: true,
  });

  await auditLog({
    action: AuditAction.GROUP_MEMBERS_ADDED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'user_group',
    resourceId: groupId,
    metadata: {
      groupName: group.name,
      addedUserIds: validUserIds,
      role,
    },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, {
    addedCount: validUserIds.length,
    skippedCount: userIds.length - validUserIds.length,
  });
});

/**
 * DELETE /api/admin/groups/members - Remove members from a group
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { groupId, userIds } = await request.json();

  if (!groupId || !userIds || !Array.isArray(userIds)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'groupId and userIds array required', 400);
  }

  // Verify group belongs to tenant
  const group = await prisma.userGroup.findFirst({
    where: { id: groupId, tenantId: ctx.tenantId },
  });

  if (!group) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Group not found', 404);
  }

  const result = await prisma.userGroupMember.deleteMany({
    where: {
      groupId,
      userId: { in: userIds },
    },
  });

  await auditLog({
    action: AuditAction.GROUP_MEMBERS_REMOVED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'user_group',
    resourceId: groupId,
    metadata: {
      groupName: group.name,
      removedUserIds: userIds,
      removedCount: result.count,
    },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { removedCount: result.count });
});

/**
 * PUT /api/admin/groups/members - Update member role
 */
export const PUT = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { groupId, userId, role } = await request.json();

  if (!groupId || !userId || !role) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'groupId, userId, and role required', 400);
  }

  // Verify group belongs to tenant
  const group = await prisma.userGroup.findFirst({
    where: { id: groupId, tenantId: ctx.tenantId },
  });

  if (!group) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Group not found', 404);
  }

  await prisma.userGroupMember.updateMany({
    where: {
      userId,
      groupId,
    },
    data: { role },
  });

  return createSuccessResponse(ctx, { updated: true });
});
