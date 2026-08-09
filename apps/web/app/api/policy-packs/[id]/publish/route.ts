/**
 * Publish a draft policy pack → active.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { prisma } from '@/lib/prisma';

export const POST = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage required', 403);
  }

  const { id } = await (ctx as any).params as { id: string };

  const pack = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { rules: true },
  });
  if (!pack) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);
  if (pack.status === 'archived') {
    return createErrorResponse(ctx, 'CONFLICT', 'Cannot publish archived pack', 409);
  }
  if (!pack.rules?.length) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Pack must have at least one rule', 400);
  }

  await (prisma as any).policyPack.updateMany({
    where: {
      tenantId: ctx.tenantId,
      name: pack.name,
      status: 'active',
      id: { not: id },
    },
    data: { status: 'archived' },
  });

  const updated = await (prisma as any).policyPack.update({
    where: { id },
    data: {
      status: 'active',
      publishedAt: new Date(),
      updatedBy: ctx.userId,
    },
    include: { rules: true },
  });

  return createSuccessResponse(ctx, { success: true, pack: updated });
});
