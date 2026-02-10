/**
 * User Department Assignment API
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';

/**
 * POST /api/admin/departments/assign - Assign users to departments
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'users:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { userId, departmentIds, accessLevel = 'member' } = await request.json();

  if (!userId || !departmentIds || !Array.isArray(departmentIds)) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'userId and departmentIds array required', 400);
  }

  // Verify user belongs to tenant
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId: ctx.tenantId },
  });

  if (!user) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
  }

  // Remove existing department assignments
  await prisma.userDepartment.deleteMany({
    where: { userId },
  });

  // Add new assignments
  if (departmentIds.length > 0) {
    await prisma.userDepartment.createMany({
      data: departmentIds.map((departmentId: string) => ({
        userId,
        departmentId,
        accessLevel,
        assignedById: ctx.userId,
      })),
    });
  }

  await auditLog({
    action: AuditAction.USER_DEPARTMENTS_UPDATED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'user',
    resourceId: userId,
    metadata: { departmentIds, accessLevel },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { updated: true });
});

/**
 * GET /api/admin/departments/assign - Get user's department assignments
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');

  if (!userId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'userId required', 400);
  }

  // Verify user belongs to tenant
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId: ctx.tenantId },
  });

  if (!user) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'User not found', 404);
  }

  const assignments = await prisma.userDepartment.findMany({
    where: { userId },
    include: {
      department: {
        select: { id: true, name: true, color: true, icon: true },
      },
    },
  });

  return createSuccessResponse(ctx, {
    userId,
    departments: assignments.map(a => ({
      id: a.departmentId,
      name: a.department.name,
      color: a.department.color,
      icon: a.department.icon,
      accessLevel: a.accessLevel,
      assignedAt: a.assignedAt,
    })),
  });
});
