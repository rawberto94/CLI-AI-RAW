/**
 * Import policy pack from JSON body or from playbook.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { hasPermissionForRole } from '@/lib/permissions-shared';
import { PolicyPackCreateSchema, PolicyRuleSchema } from 'schemas/policy-pack';
import { prisma } from '@/lib/prisma';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!hasPermissionForRole(ctx.userRole, 'policy:manage')) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'policy:manage required', 403);
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const body = await request.json();
  

  if (from === 'playbook') {
    const playbookId = body.playbookId || searchParams.get('playbookId');
    if (!playbookId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'playbookId required', 400);
    }
    const { importPackFromPlaybook } = await import('@repo/data-orchestration/services/policy/index');
    try {
      const result = await importPackFromPlaybook({
        prisma,
        tenantId: ctx.tenantId,
        playbookId,
        createdBy: ctx.userId,
        name: body.name,
        mode: body.mode || 'advisory',
      });
      const pack = await (prisma as any).policyPack.findFirst({
        where: { id: result.packId, tenantId: ctx.tenantId },
        include: { rules: true },
      });
      return createSuccessResponse(ctx, { success: true, pack, ruleCount: result.ruleCount }, { status: 201 });
    } catch (e: any) {
      return createErrorResponse(ctx, 'BAD_REQUEST', e?.message || 'Import failed', 400);
    }
  }

  // JSON pack import (starter packs)
  const parsed = PolicyPackCreateSchema.safeParse({
    name: body.name,
    description: body.description,
    mode: body.mode || 'advisory',
    isDefault: Boolean(body.isDefault),
    scope: body.scope || {},
    scoring: body.scoring || {},
    rules: body.rules || [],
  });
  if (!parsed.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.message, 400);
  }

  // Validate each rule strictly
  for (const r of parsed.data.rules) {
    const rp = PolicyRuleSchema.safeParse(r);
    if (!rp.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', `Rule ${r.code}: ${rp.error.message}`, 400);
    }
  }

  if (parsed.data.isDefault) {
    await (prisma as any).policyPack.updateMany({
      where: { tenantId: ctx.tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const existing = await (prisma as any).policyPack.findFirst({
    where: { tenantId: ctx.tenantId, name: parsed.data.name },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const pack = await (prisma as any).policyPack.create({
    data: {
      tenantId: ctx.tenantId,
      name: parsed.data.name,
      description: parsed.data.description,
      version: (existing?.version ?? 0) + 1,
      status: body.publish ? 'active' : 'draft',
      mode: parsed.data.mode,
      scope: parsed.data.scope || {},
      scoring: parsed.data.scoring || {},
      isDefault: parsed.data.isDefault,
      publishedAt: body.publish ? new Date() : null,
      createdBy: ctx.userId,
      rules: {
        create: parsed.data.rules.map((r, idx) => ({
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
          sortOrder: r.sortOrder ?? idx,
          isActive: true,
        })),
      },
    },
    include: { rules: true },
  });

  return createSuccessResponse(ctx, { success: true, pack }, { status: 201 });
});
