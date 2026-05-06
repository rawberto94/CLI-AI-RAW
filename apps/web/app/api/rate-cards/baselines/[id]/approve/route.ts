import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, tenantId: true },
    });

    if (!user?.tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }
    const body = await request.json();
    const { approvalStatus, notes } = body;

    if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid approval status', 400);
    }

    // Verify baseline belongs to user's tenant
    const baseline = await prisma.rateCardBaseline.findUnique({
      where: { id },
    });

    if (!baseline || baseline.tenantId !== user.tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Baseline not found', 404);
    }

    // Update approval status
    const updated = await prisma.rateCardBaseline.update({
      where: { id },
      data: {
        approvalStatus,
        approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
        approvedBy: user.id,
        notes: notes || baseline.notes,
        updatedAt: new Date(),
      },
    });

    return createSuccessResponse(ctx, updated);
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update baseline approval', 500);
  }
});
