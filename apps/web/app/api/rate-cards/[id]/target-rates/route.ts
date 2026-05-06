import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { negotiationAssistantService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

const negotiationService = new negotiationAssistantService(prisma);

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id: rateCardId } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const rateCard = await prisma.rateCardEntry.findFirst({
      where: {
        id: rateCardId,
        tenantId,
      },
      select: { id: true },
    });

    if (!rateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    const targetRates = await negotiationService.suggestTargetRates(rateCardId);

    return createSuccessResponse(ctx, {
      success: true,
      data: targetRates,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to suggest target rates', 500)
  }
});
