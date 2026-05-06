import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { anomalyExplainerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    // Get rate card entry with tenant isolation
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id, tenantId },
    });

    if (!rateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    // Detect anomalies
    const anomalyService = new anomalyExplainerService(prisma);
    const anomalies = await anomalyService.detectAnomalies(id);

    // Generate explanations for each anomaly
    const explanations = await Promise.all(
      anomalies.anomalies.map(anomaly =>
        anomalyService.explainAnomaly(anomaly, id)
      )
    );

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        ...anomalies,
        explanations,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createErrorResponse(ctx, 'INTERNAL_ERROR', `Failed to detect anomalies: ${message}`, 500);
  }
});
