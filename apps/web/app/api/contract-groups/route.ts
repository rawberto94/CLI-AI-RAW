import { NextRequest } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-middleware';

const createContractGroupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  groupType: z.enum(['static', 'smart']).default('static'),
  contractIds: z.array(z.string().min(1)).optional(),
  query: z.record(z.string(), z.unknown()).optional(),
  requireAllTags: z.array(z.string().min(1)).optional(),
  requireAnyTags: z.array(z.string().min(1)).optional(),
});

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const groups = await prisma.contractGroup.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: [{ updatedAt: 'desc' }],
    take: 200,
  });

  return createSuccessResponse(ctx, {
    groups,
    total: groups.length,
  });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const parsed = createContractGroupSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      ctx,
      'VALIDATION_ERROR',
      'Invalid contract group payload',
      400,
      { details: JSON.stringify(parsed.error.flatten()) },
    );
  }

  const payload = parsed.data;
  const slug = toSlug(payload.name);
  if (!slug) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group name must contain alphanumeric characters', 400);
  }

  const existing = await prisma.contractGroup.findUnique({
    where: { tenantId_slug: { tenantId: ctx.tenantId, slug } },
    select: { id: true },
  });
  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', 'A group with this name already exists', 409);
  }

  const uniqueIds = Array.from(new Set((payload.contractIds || []).map((id) => id.trim()).filter(Boolean)));

  let verifiedIds: string[] = [];
  if (uniqueIds.length > 0) {
    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: uniqueIds },
        tenantId: ctx.tenantId,
      },
      select: { id: true },
    });
    verifiedIds = contracts.map((contract) => contract.id);
  }

  const group = await prisma.contractGroup.create({
    data: {
      tenantId: ctx.tenantId,
      name: payload.name.trim(),
      slug,
      description: payload.description?.trim() || null,
      color: payload.color || null,
      groupType: payload.groupType,
      contractIds: payload.groupType === 'static' ? verifiedIds : [],
      query: payload.groupType === 'smart'
        ? (payload.query || {})
        : {},
      requireAllTags: (payload.requireAllTags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      requireAnyTags: (payload.requireAnyTags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean),
      contractCount: payload.groupType === 'static' ? verifiedIds.length : 0,
      createdBy: ctx.userId,
    },
  });

  return createSuccessResponse(ctx, {
    group,
    unresolvedContractIds: uniqueIds.filter((id) => !verifiedIds.includes(id)),
  }, { status: 201 });
});
