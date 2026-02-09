/**
 * Real-Time Benchmark Recalculation API
 * POST /api/rate-cards/real-time/recalculate
 * 
 * Triggers manual recalculation of benchmarks for a rate card
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/security/tenant';
import { realTimeBenchmarkService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const body = await request.json();
    const { rateCardEntryId } = body;

    if (!rateCardEntryId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'rateCardEntryId is required', 400);
    }

    // Verify rate card exists with tenant isolation
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id: rateCardEntryId, tenantId },
    });

    if (!rateCard) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Rate card not found', 404);
    }

    // Initialize service
    const realTimeService = new realTimeBenchmarkService(prisma);

    // Trigger recalculation
    const result = await realTimeService.recalculateBenchmark(rateCardEntryId);

    if (result.success) {
      return createSuccessResponse(ctx, {
        success: true,
        message: 'Benchmark recalculated successfully',
        rateCardEntryId: result.rateCardEntryId,
        durationMs: result.durationMs,
        affectedCount: result.affectedCount,
        benchmark: result.benchmark,
      });
    } else {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', result.error || 'Recalculation failed', 500)
    }
  });
