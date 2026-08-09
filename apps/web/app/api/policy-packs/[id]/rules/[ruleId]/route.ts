/**
 * Single rule PATCH / DELETE (deactivate)
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { PolicyRuleSchema } from 'schemas/policy-pack';
import { prisma } from '@/lib/prisma';

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage required', 403);
  }
  const { id, ruleId } = await (ctx as any).params as { id: string; ruleId: string };
  const body = await request.json();
  const parsed = PolicyRuleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.message, 400);
  }

  const pack = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!pack) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);
  if (pack.status === 'active') {
    return createErrorResponse(ctx, 'CONFLICT', 'Cannot edit rules on active pack', 409);
  }

  const existing = await (prisma as any).policyRule.findFirst({
    where: { id: ruleId, packId: id },
  });
  if (!existing) return createErrorResponse(ctx, 'NOT_FOUND', 'Rule not found', 404);

  const data: any = { ...parsed.data };
  if (data.severity) data.severity = String(data.severity).toUpperCase();

  const rule = await (prisma as any).policyRule.update({
    where: { id: ruleId },
    data,
  });
  return createSuccessResponse(ctx, { success: true, rule });
});

export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage required', 403);
  }
  const { id, ruleId } = await (ctx as any).params as { id: string; ruleId: string };

  const pack = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!pack) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);

  const existing = await (prisma as any).policyRule.findFirst({
    where: { id: ruleId, packId: id },
  });
  if (!existing) return createErrorResponse(ctx, 'NOT_FOUND', 'Rule not found', 404);

  const rule = await (prisma as any).policyRule.update({
    where: { id: ruleId },
    data: { isActive: false },
  });
  return createSuccessResponse(ctx, { success: true, rule });
});
