/**
 * API Route: GET /api/agents/health
 * Returns contract health assessment
 */

import { NextRequest } from 'next/server';
import { contractHealthMonitor } from '@repo/workers/agents';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId');
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
    }

    // Check for cached health report (< 1 hour old)
    if (!forceRefresh) {
      const cachedReport = await prisma.agentEvent.findFirst({
        where: {
          contractId,
          agentName: 'contract-health-monitor',
          eventType: 'health_assessment',
          timestamp: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour
          } },
        orderBy: { timestamp: 'desc' },
        select: {
          metadata: true,
          timestamp: true } });

      if (cachedReport) {
        return createSuccessResponse(ctx, {
          health: cachedReport.metadata,
          cached: true,
          timestamp: cachedReport.timestamp });
      }
    }

    // Fetch fresh health assessment
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        artifacts: true } });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Execute health monitor
    const result = await contractHealthMonitor.executeWithTracking({
      contractId,
      tenantId,
      context: { contract },
      metadata: {
        triggeredBy: 'system',
        priority: 'medium',
        timestamp: new Date() } });

    if (!result.success) {
      return createErrorResponse(
        ctx, 'INTERNAL_ERROR',
        result.reasoning || 'Health assessment failed',
        500
      );
    }

    return createSuccessResponse(ctx, {
      health: result.data,
      cached: false,
      timestamp: new Date() });
  });
