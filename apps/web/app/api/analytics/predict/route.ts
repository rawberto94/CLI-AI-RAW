/**
 * Predictive Analytics API
 * 
 * POST /api/analytics/predict — Renewal prediction, cost forecast, portfolio health
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { type, contractId, forecastMonths } = body;

  if (!type) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'type is required (renewal | cost_forecast | portfolio_health)', 400);
  }

  const tenantId = ctx.tenantId;

  try {
    switch (type) {
      case 'renewal': {
        if (!contractId) return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId required for renewal prediction', 400);
        const { predictRenewal } = await import('@/lib/ai/predictive-analytics.service');
        const prediction = await predictRenewal({ contractId, tenantId });
        return createSuccessResponse(ctx, { prediction });
      }

      case 'cost_forecast': {
        const { forecastCosts } = await import('@/lib/ai/predictive-analytics.service');
        const forecast = await forecastCosts({ tenantId, forecastMonths });
        return createSuccessResponse(ctx, { forecast });
      }

      case 'portfolio_health': {
        const { predictPortfolioHealth } = await import('@/lib/ai/predictive-analytics.service');
        const health = await predictPortfolioHealth({ tenantId });
        return createSuccessResponse(ctx, { health });
      }

      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', `Unknown prediction type: ${type}`, 400);
    }
  } catch (error) {
    return createErrorResponse(
      ctx, 'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Prediction failed',
      500
    );
  }
});
