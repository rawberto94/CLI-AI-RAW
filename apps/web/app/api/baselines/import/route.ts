/**
 * POST /api/baselines/import
 * 
 * Import baseline rates from CSV/JSON
 */

import { NextRequest } from 'next/server';
import { baselineManagementService } from 'data-orchestration';
import { prisma } from "@/lib/prisma";
import { getServerTenantId } from "@/lib/tenant-server";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

// Using singleton prisma instance from @/lib/prisma

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await getServerTenantId();
  const body = await request.json();

  const { baselines, updateExisting = true, autoApprove = false } = body;

  if (!baselines || !Array.isArray(baselines) || baselines.length === 0) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid request: baselines array required', 400);
  }

  // Validate baseline data
  for (const baseline of baselines) {
    if (!baseline.baselineName || !baseline.baselineType || !baseline.role || !baseline.dailyRateUSD) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid baseline data: baselineName, baselineType, role, and dailyRateUSD required', 400);
    }

    const validTypes = ['TARGET_RATE', 'MARKET_BENCHMARK', 'HISTORICAL_BEST', 'COMPETITIVE_BID', 'NEGOTIATED_CAP', 'INDUSTRY_STANDARD', 'REGULATORY_LIMIT', 'CUSTOM'];
    if (!validTypes.includes(baseline.baselineType)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid baseline type: ${baseline.baselineType}. Valid types: ${validTypes.join(', ')}`, 400);
    }
  }

  const service = new baselineManagementService(prisma);
  const result = await service.importBaselines(tenantId, baselines, {
    updateExisting,
    autoApprove,
  });

  return createSuccessResponse(ctx, {
    success: true,
    result,
    message: `Imported ${result.imported}, updated ${result.updated}, failed ${result.failed}`,
  });
});

/**
 * GET /api/baselines/import
 * 
 * Get baseline import statistics
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const tenantId = await getServerTenantId();

  const service = new baselineManagementService(prisma);
  const statistics = await service.getBaselineStatistics(tenantId);

  return createSuccessResponse(ctx, {
    success: true,
    statistics,
  });
});
