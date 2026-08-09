/**
 * Policy pack rules — list / add
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { PolicyRuleSchema } from 'schemas/policy-pack';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:read') && !hasPermissionForRole(ctx.userRole, 'contracts:view')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:read required', 403);
  }
  const { id } = await (ctx as any).params as { id: string };

  const pack = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!pack) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);

  const rules = await (prisma as any).policyRule.findMany({
    where: { packId: id },
    orderBy: { sortOrder: 'asc' },
  });
  return createSuccessResponse(ctx, { success: true, rules });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage required', 403);
  }
  const { id } = await (ctx as any).params as { id: string };
  const body = await request.json();
  const parsed = PolicyRuleSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.message, 400);
  }

  const pack = await (prisma as any).policyPack.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!pack) return createErrorResponse(ctx, 'NOT_FOUND', 'Pack not found', 404);
  if (pack.status === 'active') {
    return createErrorResponse(ctx, 'CONFLICT', 'Cannot edit rules on active pack; create a new version', 409);
  }

  const r = parsed.data;
  try {
    const rule = await (prisma as any).policyRule.create({
      data: {
        packId: id,
        code: r.code,
        title: r.title,
        kind: r.kind,
        severity: String(r.severity).toUpperCase(),
        category: r.category,
        appliesTo: r.appliesTo || {},
        assert: r.assert ?? undefined,
        match: r.match ?? undefined,
        semantic: r.semantic ?? undefined,
        escalateToSemantic: r.escalateToSemantic,
        remediation: r.remediation,
        playbookClauseId: r.playbookClauseId,
        reference: r.reference,
        sortOrder: r.sortOrder ?? 0,
        isActive: r.isActive !== false,
      },
    });
    return createSuccessResponse(ctx, { success: true, rule }, { status: 201 });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return createErrorResponse(ctx, 'CONFLICT', `Rule code ${r.code} already exists`, 409);
    }
    throw e;
  }
});
