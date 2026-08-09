/**
 * Dry-run a pack against existing contracts (no persistence).
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { prisma } from '@/lib/prisma';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage') && !hasPermissionForRole(ctx.userRole, 'policy:read')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:read required', 403);
  }

  const { id } = await (ctx as any).params as { id: string };
  const body = await request.json().catch(() => ({}));
  const sampleSize = Math.min(Number(body.sampleSize) || 25, 100);

  const pack = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!pack) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);

  const { dryRunPolicyPack } = await import('@repo/data-orchestration/services/policy/index');
  const result = await dryRunPolicyPack({
    tenantId: ctx.tenantId,
    packId: id,
    sampleSize,
    prisma,
  });

  return createSuccessResponse(ctx, { success: true, ...result });
});
