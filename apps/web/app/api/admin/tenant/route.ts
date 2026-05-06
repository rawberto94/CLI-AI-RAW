/**
 * Tenant Admin API
 * Get and update tenant information
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

export const GET = withAuthApiHandler(async (_request, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    include: {
      subscription: {
        select: {
          plan: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      },
      usage: {
        select: {
          contractsProcessed: true,
          storageUsed: true,
          apiCallsCount: true,
          aiTokensUsed: true,
        },
      },
      _count: {
        select: {
          users: true,
        },
      },
    },
  });

  if (!tenant) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
  }

  // Get contract count excluding DELETED
  const contractsCount = await prisma.contract.count({
    where: {
      tenantId: ctx.tenantId,
      isDeleted: false,
    },
  });

  return createSuccessResponse(ctx, {
    tenant: {
      ...tenant,
      _count: {
        ...tenant._count,
        contracts: contractsCount,
      },
    },
  });
});

export const PATCH = withAuthApiHandler(async (request, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  const body = await request.json();
  const { name } = body;

  if (!name?.trim()) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Organization name is required', 400);
  }

  // Check if name is already taken by another tenant
  const existingTenant = await prisma.tenant.findFirst({
    where: {
      name,
      NOT: { id: ctx.tenantId },
    },
  });

  if (existingTenant) {
    return createErrorResponse(ctx, 'CONFLICT', 'Organization name is already taken', 409);
  }

  const tenant = await prisma.tenant.update({
    where: { id: ctx.tenantId },
    data: { name },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: 'TENANT_UPDATED',
      entityType: 'TENANT',
      entityId: tenant.id,
      metadata: { name },
    },
  });

  return createSuccessResponse(ctx, { tenant });
});
