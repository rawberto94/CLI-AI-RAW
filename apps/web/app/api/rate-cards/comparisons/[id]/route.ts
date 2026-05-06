import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

/**
 * GET /api/rate-cards/comparisons/[id]
 * Get a specific comparison
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const isTenantAdmin = ctx.userRole === 'admin' || ctx.userRole === 'owner';
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
  }
  
  try {
    const comparison = await prisma.rateComparison.findFirst({
      where: isTenantAdmin
        ? { id, tenantId }
        : {
            id,
            tenantId,
            OR: [
              { createdBy: userId },
              { isShared: true },
            ],
          },
      include: {
        targetRate: true,
      },
    });

    if (!comparison) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found', 404);
    }

    return createSuccessResponse(ctx, { comparison });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch comparison. Please try again.', 500);
  }
});

/**
 * PATCH /api/rate-cards/comparisons/[id]
 * Update a comparison
 */
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const isTenantAdmin = ctx.userRole === 'admin' || ctx.userRole === 'owner';
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
  }
  
  try {
    // Verify comparison belongs to tenant
    const existing = await prisma.rateComparison.findFirst({
      where: { id, tenantId },
      select: { id: true, createdBy: true },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found', 404);
    }

    if (!isTenantAdmin && existing.createdBy !== userId) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Only the creator or an admin can modify this comparison', 403);
    }

    const body = await request.json();
    const { name, description, isShared } = body;

    const comparison = await prisma.rateComparison.update({
      where: { id: existing.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isShared !== undefined && { isShared }),
      },
      include: {
        targetRate: true,
      },
    });

    return createSuccessResponse(ctx, { comparison });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update comparison. Please try again.', 500);
  }
});

/**
 * DELETE /api/rate-cards/comparisons/[id]
 * Delete a comparison
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const isTenantAdmin = ctx.userRole === 'admin' || ctx.userRole === 'owner';
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
  }
  
  try {
    // Verify comparison belongs to tenant
    const existing = await prisma.rateComparison.findFirst({
      where: { id, tenantId },
      select: { id: true, createdBy: true },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found', 404);
    }

    if (!isTenantAdmin && existing.createdBy !== userId) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Only the creator or an admin can delete this comparison', 403);
    }

    await prisma.rateComparison.delete({
      where: { id: existing.id },
    });

    return createSuccessResponse(ctx, { success: true });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to delete comparison. Please try again.', 500);
  }
});
