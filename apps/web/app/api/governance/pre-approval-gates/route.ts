import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Pre-Approval Gates API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const gates = await prisma.preApprovalGate.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { gateOrder: 'asc' },
    });
    return createSuccessResponse(ctx, { gates });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch gates', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const gate = await prisma.preApprovalGate.create({
      data: {
        tenantId: ctx.tenantId,
        name: body.name,
        description: body.description || null,
        gateType: body.gateType || 'APPROVAL',
        gateOrder: body.gateOrder || 0,
        conditions: body.conditions || {},
        requiredApprovers: body.requiredApprovers || [],
        approvalMode: body.approvalMode || 'ALL',
        autoCheck: body.autoCheck || null,
        slaHours: body.slaHours || null,
        isActive: body.isActive ?? true,
        appliesToTypes: body.appliesToTypes || [],
        appliesToValuesAbove: body.appliesToValuesAbove || null,
        currency: body.currency || 'USD',
        createdBy: ctx.userId,
      },
    });
    return createSuccessResponse(ctx, { gate }, { status: 201 });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create gate', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    if (!body.id) return createErrorResponse(ctx, 'BAD_REQUEST', 'ID is required', 400);
    const { prisma } = await import('@/lib/prisma');

    const existing = await prisma.preApprovalGate.findFirst({
      where: { id: body.id, tenantId: ctx.tenantId },
    });
    if (!existing) return createErrorResponse(ctx, 'NOT_FOUND', 'Gate not found', 404);

    const gate = await prisma.preApprovalGate.update({
      where: { id: body.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.gateOrder !== undefined && { gateOrder: body.gateOrder }),
      },
    });
    return createSuccessResponse(ctx, { gate });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update gate', 500);
  }
});
