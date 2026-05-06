import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { baselineManagementService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
try {
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Tenant not found', 404);
    }

  const { id } = await (ctx as any).params as { id: string };

    const entry = await prisma.rateCardEntry.findFirst({
      where: {
        id,
        tenantId,
      },
      select: { id: true },
    });

    if (!entry) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card entry not found', 404);
    }

    // Compare against baselines
    const baselineService = new baselineManagementService(prisma);
    const comparisons = await baselineService.compareAgainstBaselines(id);

    return createSuccessResponse(ctx, { comparisons });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to compare against baselines', 500);
  }
})
