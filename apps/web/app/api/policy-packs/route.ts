/**
 * Policy Packs API — list / create
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { PolicyPackCreateSchema } from 'schemas/policy-pack';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:read') && !hasPermissionForRole(ctx.userRole, 'contracts:view')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:read required', 403);
  }

  
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const packs = await (prisma as any).policyPack.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(status ? { status } : {}),
    },
    include: {
      _count: { select: { rules: true, evaluations: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });

  return createSuccessResponse(ctx, { success: true, packs, total: packs.length });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage required', 403);
  }

  const body = await request.json();
  const parsed = PolicyPackCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.message, 400);
  }

  const data = parsed.data;
  

  if (data.isDefault) {
    await (prisma as any).policyPack.updateMany({
      where: { tenantId: ctx.tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const existing = await (prisma as any).policyPack.findFirst({
    where: { tenantId: ctx.tenantId, name: data.name },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (existing?.version ?? 0) + 1;

  const pack = await (prisma as any).policyPack.create({
    data: {
      tenantId: ctx.tenantId,
      name: data.name,
      description: data.description,
      version,
      status: 'draft',
      mode: data.mode,
      playbookId: data.playbookId || null,
      scope: data.scope || {},
      scoring: data.scoring || {},
      isDefault: data.isDefault,
      createdBy: ctx.userId,
      rules: {
        create: (data.rules || []).map((r, idx) => ({
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
          sortOrder: r.sortOrder ?? idx,
          isActive: r.isActive !== false,
        })),
      },
    },
    include: { rules: true },
  });

  return createSuccessResponse(ctx, { success: true, pack }, { status: 201 });
});
