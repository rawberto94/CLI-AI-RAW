/**
 * Department-Based Access Control
 *
 * Filter contracts and data by user's department assignment
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { auditTrailService } from 'data-orchestration/services';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction, getAuditContext } from '@/lib/security/audit';

// Standard departments - can be customized per tenant
export const STANDARD_DEPARTMENTS = [
  { id: 'legal', name: 'Legal', color: '#6366F1', icon: 'Scale' },
  { id: 'finance', name: 'Finance', color: '#10B981', icon: 'DollarSign' },
  { id: 'hr', name: 'Human Resources', color: '#F59E0B', icon: 'Users' },
  { id: 'it', name: 'Information Technology', color: '#8B5CF6', icon: 'Monitor' },
  { id: 'operations', name: 'Operations', color: '#8B5CF6', icon: 'Settings' },
  { id: 'procurement', name: 'Procurement', color: '#EC4899', icon: 'ShoppingCart' },
  { id: 'sales', name: 'Sales', color: '#EF4444', icon: 'TrendingUp' },
  { id: 'marketing', name: 'Marketing', color: '#14B8A6', icon: 'Megaphone' },
  { id: 'engineering', name: 'Engineering', color: '#F97316', icon: 'Code' },
  { id: 'executive', name: 'Executive', color: '#6B7280', icon: 'Crown' },
];

/**
 * GET /api/admin/departments - List all departments
 */
export const GET = withAuthApiHandler(async (_request, ctx) => {
  // Get custom departments for tenant
  const customDepartments = await prisma.department.findMany({
    where: { tenantId: ctx.tenantId },
    include: {
      _count: {
        select: { members: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Get user counts per department
  const usersByDepartment = await prisma.userDepartment.groupBy({
    by: ['departmentId'],
    _count: true,
  });

  const userCountMap = new Map(usersByDepartment.map(u => [u.departmentId, u._count]));

  // Get contract counts by department
  const contractsByDepartment = await prisma.$queryRaw<Array<{ departmentId: string; count: bigint }>>`
    SELECT ud."departmentId", COUNT(DISTINCT c.id)::bigint as count
    FROM "UserDepartment" ud
    JOIN "Contract" c ON c."ownerId" = ud."userId" OR c."tenantId" = ${ctx.tenantId}
    WHERE ud."departmentId" IS NOT NULL
    GROUP BY ud."departmentId"
  `.catch(() => []);

  const contractCountMap = new Map(
    (contractsByDepartment || []).map(c => [c.departmentId, Number(c.count)])
  );

  // Merge standard and custom departments
  const departments = [
    ...STANDARD_DEPARTMENTS.map(sd => ({
      ...sd,
      isCustom: false,
      userCount: userCountMap.get(sd.id) || 0,
      contractCount: contractCountMap.get(sd.id) || 0,
    })),
    ...customDepartments.map(cd => ({
      id: cd.id,
      name: cd.name,
      color: cd.color,
      icon: cd.icon,
      isCustom: true,
      userCount: cd._count.members,
      contractCount: contractCountMap.get(cd.id) || 0,
    })),
  ];

  return createSuccessResponse(ctx, { departments });
});

/**
 * POST /api/admin/departments - Create custom department
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'settings:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { name, color, icon, contractTypes, accessRules } = await request.json();

  if (!name) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Department name required', 400);
  }

  // Check for duplicate
  const existing = await prisma.department.findFirst({
    where: {
      tenantId: ctx.tenantId,
      name: { equals: name, mode: 'insensitive' },
    },
  });

  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', 'Department already exists', 409);
  }

  const department = await prisma.department.create({
    data: {
      tenantId: ctx.tenantId,
      name,
      color: color || '#8B5CF6',
      icon: icon || 'Folder',
      contractTypes: contractTypes || [],
      accessRules: accessRules || {},
      createdById: ctx.userId,
    },
  });

  await auditLog({
    action: AuditAction.DEPARTMENT_CREATED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'department',
    resourceId: department.id,
    metadata: { name },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { department });
});

/**
 * PUT /api/admin/departments - Update department
 */
export const PUT = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'settings:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { departmentId, name, color, icon, contractTypes, accessRules } = await request.json();

  if (!departmentId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Department ID required', 400);
  }

  // Verify department belongs to tenant
  const existing = await prisma.department.findFirst({
    where: { id: departmentId, tenantId: ctx.tenantId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Department not found', 404);
  }

  const department = await prisma.department.update({
    where: { id: departmentId },
    data: {
      name,
      color,
      icon,
      contractTypes,
      accessRules,
    },
  });

  return createSuccessResponse(ctx, { department });
});

/**
 * DELETE /api/admin/departments - Delete custom department
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const canManage = await hasPermission(ctx.userId, 'settings:manage');
  if (!canManage) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const { departmentId } = await request.json();

  if (!departmentId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Department ID required', 400);
  }

  // Verify department belongs to tenant
  const existing = await prisma.department.findFirst({
    where: { id: departmentId, tenantId: ctx.tenantId },
  });

  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Department not found', 404);
  }

  // Remove user assignments first
  await prisma.userDepartment.deleteMany({
    where: { departmentId },
  });

  await prisma.department.delete({
    where: { id: departmentId },
  });

  await auditLog({
    action: AuditAction.DEPARTMENT_DELETED,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    resourceType: 'department',
    resourceId: departmentId,
    metadata: { name: existing.name },
    ...getAuditContext(request),
  });

  return createSuccessResponse(ctx, { deleted: true });
});

/**
 * Get contracts filtered by user's department access
 */
export async function getContractsByDepartmentAccess(
  userId: string,
  tenantId: string
): Promise<{ departmentIds: string[]; contractFilter: any }> {
  const ctx = getApiContext(userId);
  // Get user's departments
  const userDepartments = await prisma.userDepartment.findMany({
    where: { userId },
    select: { departmentId: true, accessLevel: true },
  });

  if (userDepartments.length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role && ['owner', 'admin'].includes(user.role)) {
      return { departmentIds: [], contractFilter: { tenantId } };
    }

    return {
      departmentIds: [],
      contractFilter: {
        tenantId,
        OR: [
          { uploadedBy: userId },
          { userAccess: { some: { userId } } },
        ],
      },
    };
  }

  const departmentIds = userDepartments.map(ud => ud.departmentId);

  const departments = await prisma.department.findMany({
    where: { id: { in: departmentIds } },
    select: { contractTypes: true },
  });

  const allowedContractTypes = new Set<string>();
  departments.forEach(d => {
    if (d.contractTypes && Array.isArray(d.contractTypes)) {
      (d.contractTypes as string[]).forEach(ct => allowedContractTypes.add(ct));
    }
  });

  const contractFilter: any = {
    tenantId,
    OR: [
      { uploadedBy: userId },
      { userAccess: { some: { userId } } },
      {
        metadata: {
          path: ['department'],
          string_contains: departmentIds,
        },
      },
    ],
  };

  if (allowedContractTypes.size > 0) {
    contractFilter.OR.push({
      contractType: { in: Array.from(allowedContractTypes) },
    });
  }

  return { departmentIds, contractFilter };
}
