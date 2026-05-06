import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { negotiationScenarioService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = ctx.tenantId;
    const volume = searchParams.get('volume');

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const rateCard = await prisma.rateCardEntry.findFirst({
      where: {
        id,
        tenantId,
      },
      select: { id: true },
    });

    if (!rateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    const scenarios = await negotiationScenarioService.generateScenarios(
      id,
      tenantId,
      volume ? parseInt(volume) : undefined
    );

    return createSuccessResponse(ctx, scenarios);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate scenarios', 500);
  }
});
