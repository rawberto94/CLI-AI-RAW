/**
 * Real-Time Benchmark Status API
 * GET /api/rate-cards/real-time/status
 * 
 * Returns the current status of real-time benchmark calculations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { realTimeBenchmarkService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const rateCardEntryId = searchParams.get('rateCardEntryId');

    if (!rateCardEntryId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'rateCardEntryId is required', 400);
    }

    // Initialize service
    const realTimeService = new realTimeBenchmarkService(prisma);

    // Get calculation status
    const status = realTimeService.getCalculationStatus(rateCardEntryId);

    if (!status) {
      return createSuccessResponse(ctx, {
        rateCardEntryId,
        status: 'IDLE',
        message: 'No recent calculation activity',
      });
    }

    return createSuccessResponse(ctx, {
      rateCardEntryId: status.rateCardEntryId,
      status: status.status,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      durationMs: status.durationMs,
      error: status.error,
    });
  });
