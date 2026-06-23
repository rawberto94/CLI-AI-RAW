import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import {
  createErrorResponse,
  createSuccessResponse,
  withAuthApiHandler,
} from '@/lib/api-middleware';
import { validateOrRegisterTenantTags } from '@/lib/contracts/server/tag-registry';
import { applyContractChangeSideEffects } from '@/lib/contracts/server/contract-change-side-effects';

const tagRuleSchema = z.object({
  name: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1000).optional(),
  trigger: z.enum(['contract_created', 'contract_updated', 'daily']).default('contract_updated'),
  enabled: z.boolean().default(true),
  condition: z.object({
    statusIn: z.array(z.string().trim().min(1)).optional(),
    contractTypeIn: z.array(z.string().trim().min(1)).optional(),
    categoryL1In: z.array(z.string().trim().min(1)).optional(),
    expiresWithinDays: z.number().int().min(1).max(3650).optional(),
    minTotalValue: z.number().nonnegative().optional(),
    maxTotalValue: z.number().nonnegative().optional(),
    requiresAnyTags: z.array(z.string().trim().min(1)).optional(),
    requiresAllTags: z.array(z.string().trim().min(1)).optional(),
  }).default({}),
  action: z.object({
    addTags: z.array(z.string().trim().min(1)).default([]),
  }),
});

type RuleCondition = z.infer<typeof tagRuleSchema>['condition'];

function buildContractWhere(tenantId: string, condition: RuleCondition) {
  const now = new Date();
  const expirationCutoff = condition.expiresWithinDays
    ? new Date(now.getTime() + condition.expiresWithinDays * 24 * 60 * 60 * 1000)
    : null;

  return {
    tenantId,
    isDeleted: false,
    ...(condition.statusIn && condition.statusIn.length > 0
      ? { status: { in: condition.statusIn } }
      : {}),
    ...(condition.contractTypeIn && condition.contractTypeIn.length > 0
      ? { contractType: { in: condition.contractTypeIn } }
      : {}),
    ...(condition.categoryL1In && condition.categoryL1In.length > 0
      ? { categoryL1: { in: condition.categoryL1In } }
      : {}),
    ...(condition.minTotalValue !== undefined ? { totalValue: { gte: condition.minTotalValue } } : {}),
    ...(condition.maxTotalValue !== undefined
      ? {
          totalValue: {
            ...(condition.minTotalValue !== undefined ? { gte: condition.minTotalValue } : {}),
            lte: condition.maxTotalValue,
          },
        }
      : {}),
    ...(expirationCutoff
      ? {
          expirationDate: {
            gte: now,
            lte: expirationCutoff,
          },
        }
      : {}),
  } as const;
}

function hasRequiredTags(tags: string[], condition: RuleCondition): boolean {
  const normalized = new Set(tags.map((tag) => tag.toLowerCase()));
  const requiresAny = (condition.requiresAnyTags || []).map((tag) => tag.toLowerCase());
  const requiresAll = (condition.requiresAllTags || []).map((tag) => tag.toLowerCase());

  if (requiresAll.length > 0 && requiresAll.some((tag) => !normalized.has(tag))) {
    return false;
  }

  if (requiresAny.length > 0 && !requiresAny.some((tag) => normalized.has(tag))) {
    return false;
  }

  return true;
}

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const rules = await prisma.tagRule.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ updatedAt: 'desc' }],
    take: 200,
  });

  return createSuccessResponse(ctx, {
    rules,
    total: rules.length,
  });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const parsed = tagRuleSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      ctx,
      'VALIDATION_ERROR',
      'Invalid tag rule payload',
      400,
      { details: JSON.stringify(parsed.error.flatten()) },
    );
  }

  const payload = parsed.data;
  const normalizedActionTags = await validateOrRegisterTenantTags(
    ctx.tenantId,
    payload.action.addTags,
    { createdBy: ctx.userId },
  );

  const existing = await prisma.tagRule.findUnique({
    where: { tenantId_name: { tenantId: ctx.tenantId, name: payload.name } },
    select: { id: true },
  });
  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', 'A tag rule with this name already exists', 409);
  }

  const created = await prisma.tagRule.create({
    data: {
      tenantId: ctx.tenantId,
      name: payload.name,
      description: payload.description || null,
      trigger: payload.trigger,
      enabled: payload.enabled,
      condition: payload.condition,
      action: {
        addTags: normalizedActionTags,
      },
      createdBy: ctx.userId,
    },
  });

  return createSuccessResponse(ctx, { rule: created }, { status: 201 });
});

export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Rule id is required', 400);
  }

  const parsed = tagRuleSchema.partial().safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      ctx,
      'VALIDATION_ERROR',
      'Invalid tag rule payload',
      400,
      { details: JSON.stringify(parsed.error.flatten()) },
    );
  }

  const existing = await prisma.tagRule.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true, action: true },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Tag rule not found', 404);
  }

  const normalizedActionTags = parsed.data.action?.addTags
    ? await validateOrRegisterTenantTags(ctx.tenantId, parsed.data.action.addTags, { createdBy: ctx.userId })
    : undefined;

  const updated = await prisma.tagRule.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}),
      ...(parsed.data.trigger !== undefined ? { trigger: parsed.data.trigger } : {}),
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
      ...(parsed.data.condition !== undefined ? { condition: parsed.data.condition } : {}),
      ...(parsed.data.action !== undefined
        ? {
            action: {
              ...(parsed.data.action as Record<string, unknown>),
              ...(normalizedActionTags ? { addTags: normalizedActionTags } : {}),
            },
          }
        : {}),
    },
  });

  return createSuccessResponse(ctx, { rule: updated });
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Rule id is required', 400);
  }

  const existing = await prisma.tagRule.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Tag rule not found', 404);
  }

  await prisma.tagRule.delete({ where: { id: existing.id } });

  return createSuccessResponse(ctx, { deleted: true, id: existing.id });
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Rule id is required', 400);
  }

  const existing = await prisma.tagRule.findFirst({
    where: { id, tenantId: ctx.tenantId, enabled: true },
    select: { id: true, condition: true, action: true },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Active tag rule not found', 404);
  }

  const condition = (existing.condition as RuleCondition) || {};
  const action = (existing.action as { addTags?: string[] }) || {};
  const tagsToAdd = (action.addTags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);

  if (tagsToAdd.length === 0) {
    return createSuccessResponse(ctx, { ruleId: id, updatedContracts: 0, message: 'No action tags configured' });
  }

  const contracts = await prisma.contract.findMany({
    where: buildContractWhere(ctx.tenantId, condition),
    select: {
      id: true,
      aiMetadata: true,
      metadata: {
        select: { tags: true },
      },
    },
    take: 500,
  });

  let updatedContracts = 0;
  for (const contract of contracts) {
    const currentTags = (contract.metadata?.tags || []).map((tag) => tag.toLowerCase());
    if (!hasRequiredTags(currentTags, condition)) {
      continue;
    }

    const nextTags = Array.from(new Set([...currentTags, ...tagsToAdd]));
    if (nextTags.length === currentTags.length) {
      continue;
    }

    await prisma.contractMetadata.upsert({
      where: { contractId: contract.id },
      create: {
        contractId: contract.id,
        tenantId: ctx.tenantId,
        tags: nextTags,
        updatedBy: ctx.userId,
      },
      update: {
        tags: nextTags,
        updatedBy: ctx.userId,
        lastUpdated: new Date(),
      },
    });

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        tags: nextTags,
        aiMetadata: {
          ...((contract.aiMetadata as Record<string, unknown>) || {}),
          tags: nextTags,
        } as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    applyContractChangeSideEffects({
      tenantId: ctx.tenantId,
      contractId: contract.id,
      userId: ctx.userId,
      changedFields: ['tags'],
      source: 'api:tag-rules/execute',
    }).catch(() => {});

    updatedContracts += 1;
  }

  return createSuccessResponse(ctx, {
    ruleId: id,
    updatedContracts,
  });
});
