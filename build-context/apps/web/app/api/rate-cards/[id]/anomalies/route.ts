import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from '@/lib/security/tenant';
import { anomalyExplainerService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const { id } = params;

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
}
