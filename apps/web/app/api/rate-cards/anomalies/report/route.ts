import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { anomalyExplainerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

/**
 * GET /api/rate-cards/anomalies/report
 * Generate comprehensive anomaly report for all rate cards in a tenant
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    // Get tenant ID from secure session
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    // Generate anomaly report
    const anomalyService = new anomalyExplainerService(prisma);
    const report = await anomalyService.generateAnomalyReport(tenantId);

    return createSuccessResponse(ctx, {
      success: true,
      data: report,
    });
  });
