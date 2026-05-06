import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { rateCardBenchmarkingService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
const { id } = await (ctx as any).params as { id: string };
const tenantId = ctx.tenantId;
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400)
  }
  
  try {
    // Verify opportunity belongs to tenant
    const opportunity = await prisma.rateSavingsOpportunity.findFirst({
      where: { id, tenantId },
      include: {
        rateCardEntry: true,
      },
    });

    if (!opportunity) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Opportunity not found', 404)
    }

    return createSuccessResponse(ctx, {
      success: true,
      opportunity,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Unknown error', 500)
  }
})

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
const { id } = await (ctx as any).params as { id: string };
const tenantId = ctx.tenantId;
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400)
  }
  
  try {
    // Verify opportunity belongs to tenant before updating
    const existing = await prisma.rateSavingsOpportunity.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Opportunity not found', 404)
    }

    const body = await request.json();
    const { status, notes, assignedTo, actualSavings } = body;

    // Build update data
    const updateData: any = {};
    if (status) updateData.status = status;
    if (notes) updateData.recommendedAction = notes;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (actualSavings !== undefined) {
      updateData.actualSavingsRealized = actualSavings;
      updateData.implementedAt = new Date();
    }

    const updated = await prisma.rateSavingsOpportunity.update({
      where: { id: existing.id },
      data: updateData,
    });

    return createSuccessResponse(ctx, {
      success: true,
      opportunity: updated,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Unknown error', 500)
  }
})

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
const { id } = await (ctx as any).params as { id: string };
const tenantId = ctx.tenantId;
  
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400)
  }
  
  try {
    // Verify opportunity belongs to tenant before deleting
    const existing = await prisma.rateSavingsOpportunity.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Opportunity not found', 404)
    }

    await prisma.rateSavingsOpportunity.delete({
      where: { id: existing.id },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Opportunity deleted',
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Unknown error', 500)
  }
})
