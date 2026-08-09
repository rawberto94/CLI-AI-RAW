/**
 * Policy Pack by id — GET / PATCH / DELETE (archive)
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { PolicyPackUpdateSchema } from 'schemas/policy-pack';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:read') && !hasPermissionForRole(ctx.userRole, 'contracts:view')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:read required', 403);
  }
  const { id } = await (ctx as any).params as { id: string };

  const pack = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      rules: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { evaluations: true } },
    },
  });
  if (!pack) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);
  return createSuccessResponse(ctx, { success: true, pack });
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage required', 403);
  }
  const { id } = await (ctx as any).params as { id: string };
  const body = await request.json();
  const parsed = PolicyPackUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.message, 400);
  }

  const existing = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);

  if (existing.status === 'active' && parsed.data.status && parsed.data.status !== 'archived' && parsed.data.status !== 'active') {
    return createErrorResponse(ctx, 'CONFLICT', 'Active packs are immutable; archive or create a new version', 409);
  }

  if (parsed.data.isDefault) {
    await (prisma as any).policyPack.updateMany({
      where: { tenantId: ctx.tenantId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const pack = await (prisma as any).policyPack.update({
    where: { id },
    data: {
      ...parsed.data,
      updatedBy: ctx.userId,
    },
    include: { rules: true },
  });

  return createSuccessResponse(ctx, { success: true, pack });
});

export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage required', 403);
  }
  const { id } = await (ctx as any).params as { id: string };

  const existing = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);

  const pack = await (prisma as any).policyPack.update({
    where: { id },
    data: { status: 'archived', updatedBy: ctx.userId },
  });

  return createSuccessResponse(ctx, { success: true, pack });
});
