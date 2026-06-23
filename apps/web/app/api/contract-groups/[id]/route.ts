import { NextRequest } from 'next/server';
import { z } from 'zod';
import { type Prisma, ContractStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  createErrorResponse,
  createSuccessResponse,
  withAuthApiHandler,
} from '@/lib/api-middleware';

const updateContractGroupSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  groupType: z.enum(['static', 'smart']).optional(),
  contractIds: z.array(z.string().min(1)).optional(),
  query: z.record(z.string(), z.unknown()).optional(),
  requireAllTags: z.array(z.string().min(1)).optional(),
  requireAnyTags: z.array(z.string().min(1)).optional(),
});

type SmartGroupQuery = {
  status?: string[];
  contractType?: string[];
  categoryL1?: string[];
  search?: string;
  minValue?: number;
  maxValue?: number;
};

function parseSmartQuery(raw: unknown): SmartGroupQuery {
  if (!raw || typeof raw !== 'object') return {};
  const candidate = raw as Record<string, unknown>;
  const toStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const values = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    return values.length > 0 ? values : undefined;
  };

  const minValue = typeof candidate.minValue === 'number' ? candidate.minValue : undefined;
  const maxValue = typeof candidate.maxValue === 'number' ? candidate.maxValue : undefined;

  return {
    status: toStringArray(candidate.status),
    contractType: toStringArray(candidate.contractType),
    categoryL1: toStringArray(candidate.categoryL1),
    search: typeof candidate.search === 'string' ? candidate.search.trim() : undefined,
    minValue,
    maxValue,
  };
}

async function resolveGroupContracts(tenantId: string, group: {
  id: string;
  groupType: string;
  contractIds: string[];
  query: unknown;
  requireAllTags: string[];
  requireAnyTags: string[];
}) {
  const whereBase: Prisma.ContractWhereInput = {
    tenantId,
    isDeleted: false,
  };

  if (group.groupType === 'static') {
    return prisma.contract.findMany({
      where: {
        ...whereBase,
        id: { in: group.contractIds || [] },
      },
      select: {
        id: true,
        contractTitle: true,
        status: true,
        contractType: true,
        totalValue: true,
        expirationDate: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
  }

  const smart = parseSmartQuery(group.query);

  const smartWhere: Prisma.ContractWhereInput = {
    ...whereBase,
    ...(smart.status ? { status: { in: smart.status as ContractStatus[] } } : {}),
    ...(smart.contractType ? { contractType: { in: smart.contractType } } : {}),
    ...(smart.categoryL1 ? { categoryL1: { in: smart.categoryL1 } } : {}),
    ...(smart.search
      ? {
          OR: [
            { contractTitle: { contains: smart.search, mode: 'insensitive' } },
            { fileName: { contains: smart.search, mode: 'insensitive' } },
            { clientName: { contains: smart.search, mode: 'insensitive' } },
            { supplierName: { contains: smart.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(smart.minValue !== undefined ? { totalValue: { gte: smart.minValue } } : {}),
    ...(smart.maxValue !== undefined ? { totalValue: { lte: smart.maxValue } } : {}),
  };

  const contracts = await prisma.contract.findMany({
    where: smartWhere,
    select: {
      id: true,
      contractTitle: true,
      status: true,
      contractType: true,
      totalValue: true,
      expirationDate: true,
      tags: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  const requireAll = (group.requireAllTags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const requireAny = (group.requireAnyTags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);

  const filtered = contracts.filter((contract) => {
    const tags = new Set((Array.isArray(contract.tags) ? (contract.tags as string[]) : []).map((tag) => tag.toLowerCase()));

    if (requireAll.length > 0 && requireAll.some((tag) => !tags.has(tag))) {
      return false;
    }

    if (requireAny.length > 0 && !requireAny.some((tag) => tags.has(tag))) {
      return false;
    }

    return true;
  });

  return filtered.map((contract) => ({
    id: contract.id,
    contractTitle: contract.contractTitle,
    status: contract.status,
    contractType: contract.contractType,
    totalValue: contract.totalValue,
    expirationDate: contract.expirationDate,
  }));
}

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const { id } = await ((ctx as any).params as Promise<{ id?: string }>);
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group id is required', 400);
  }

  const group = await prisma.contractGroup.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!group) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract group not found', 404);
  }

  const contracts = await resolveGroupContracts(ctx.tenantId, {
    id: group.id,
    groupType: group.groupType,
    contractIds: group.contractIds,
    query: group.query,
    requireAllTags: group.requireAllTags,
    requireAnyTags: group.requireAnyTags,
  });

  if (group.contractCount !== contracts.length) {
    await prisma.contractGroup.update({
      where: { id: group.id },
      data: { contractCount: contracts.length },
    });
  }

  return createSuccessResponse(ctx, {
    group,
    contracts,
    totalContracts: contracts.length,
  });
});

export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await ((ctx as any).params as Promise<{ id?: string }>);
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group id is required', 400);
  }

  const existing = await prisma.contractGroup.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true, groupType: true, contractIds: true },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract group not found', 404);
  }

  const body = await request.json();
  const parsed = updateContractGroupSchema.safeParse(body);
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
  let verifiedIds: string[] | undefined;
  if (payload.contractIds) {
    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: payload.contractIds },
        tenantId: ctx.tenantId,
      },
      select: { id: true },
    });
    verifiedIds = contracts.map((contract) => contract.id);
  }

  const nextGroupType = payload.groupType || existing.groupType;
  const updated = await prisma.contractGroup.update({
    where: { id: existing.id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.color !== undefined ? { color: payload.color } : {}),
      ...(payload.groupType !== undefined ? { groupType: payload.groupType } : {}),
      ...(verifiedIds !== undefined ? { contractIds: verifiedIds } : {}),
      ...(payload.query !== undefined ? { query: payload.query as Prisma.InputJsonValue } : {}),
      ...(payload.requireAllTags !== undefined
        ? { requireAllTags: payload.requireAllTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean) }
        : {}),
      ...(payload.requireAnyTags !== undefined
        ? { requireAnyTags: payload.requireAnyTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean) }
        : {}),
      ...(nextGroupType === 'static' && verifiedIds !== undefined ? { contractCount: verifiedIds.length } : {}),
    },
  });

  return createSuccessResponse(ctx, {
    group: updated,
    unresolvedContractIds: payload.contractIds
      ? payload.contractIds.filter((contractId) => !verifiedIds?.includes(contractId))
      : [],
  });
});

export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const { id } = await ((ctx as any).params as Promise<{ id?: string }>);
  if (!id) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Group id is required', 400);
  }

  const existing = await prisma.contractGroup.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract group not found', 404);
  }

  await prisma.contractGroup.delete({ where: { id: existing.id } });

  return createSuccessResponse(ctx, {
    deleted: true,
    id: existing.id,
  });
});
