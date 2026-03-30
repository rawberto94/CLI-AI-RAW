import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// Delegation of Authority Matrix API
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { prisma } = await import('@/lib/prisma');
    const entries = await prisma.delegationOfAuthority.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { maxValue: { sort: 'asc', nulls: 'last' } },
    });
    return createSuccessResponse(ctx, { entries });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch DoA matrix', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { prisma } = await import('@/lib/prisma');
    const entry = await prisma.delegationOfAuthority.create({
      data: {
        tenantId: ctx.tenantId,
        name: body.name,
        role: body.role,
        department: body.department || null,
        contractTypes: body.contractTypes || [],
        maxValue: body.maxValue || null,
        currency: body.currency || 'USD',
        requiresCounterSign: body.requiresCounterSign ?? false,
        counterSignRole: body.counterSignRole || null,
        canDelegate: body.canDelegate ?? true,
        delegationDepth: body.delegationDepth || 1,
        conditions: body.conditions || {},
        isActive: body.isActive ?? true,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : null,
        effectiveUntil: body.effectiveUntil ? new Date(body.effectiveUntil) : null,
        createdBy: ctx.userId,
      },
    });
    return createSuccessResponse(ctx, { entry }, { status: 201 });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to create DoA entry', 500);
  }
});

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'ID is required', 400);
    const { prisma } = await import('@/lib/prisma');

    const existing = await prisma.delegationOfAuthority.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) return createErrorResponse(ctx, 'NOT_FOUND', 'Entry not found', 404);

    const entry = await prisma.delegationOfAuthority.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.department !== undefined && { department: data.department }),
        ...(data.maxValue !== undefined && { maxValue: data.maxValue }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    return createSuccessResponse(ctx, { entry });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update DoA entry', 500);
  }
});

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return createErrorResponse(ctx, 'BAD_REQUEST', 'ID is required', 400);
    const { prisma } = await import('@/lib/prisma');

    const existing = await prisma.delegationOfAuthority.findFirst({
      where: { id, tenantId: ctx.tenantId },
    });
    if (!existing) return createErrorResponse(ctx, 'NOT_FOUND', 'Entry not found', 404);

    await prisma.delegationOfAuthority.delete({ where: { id } });
    return createSuccessResponse(ctx, { deleted: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete DoA entry', 500);
  }
});
