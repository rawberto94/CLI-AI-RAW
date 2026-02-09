import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { enhancedRateAnalyticsService } from 'data-orchestration/services';

/**
 * GET /api/rate-cards/dashboard/client-metrics
 * Get client overview metrics for dashboard
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;

    // Require tenant ID for security
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    // Get total clients
    const clientsResult = await prisma.$queryRaw<Array<{ clientName: string; count: bigint }>>`
      SELECT "clientName", COUNT(*)::bigint as count
      FROM "RateCardEntry"
      WHERE "tenantId" = ${tenantId}
        AND "clientName" IS NOT NULL
        AND "clientName" != ''
      GROUP BY "clientName"
      ORDER BY count DESC
    `;

    const totalClients = clientsResult.length;
    const totalRateCards = clientsResult.reduce((sum, c) => sum + Number(c.count), 0);

    // Get unassigned rate cards
    const unassignedCount = await prisma.rateCardEntry.count({
      where: {
        tenantId,
        OR: [
          { clientName: null },
          { clientName: '' },
        ],
      },
    });

    // Calculate estimated spend for top clients (daily rate * 220 working days)
    const topClients = await Promise.all(
      clientsResult.slice(0, 10).map(async (client) => {
        const avgRate = await prisma.rateCardEntry.aggregate({
          where: {
            tenantId,
            clientName: client.clientName,
          },
          _avg: {
            dailyRate: true,
          },
        });

        return {
          name: client.clientName,
          rateCardCount: Number(client.count),
          totalSpend: (Number(avgRate._avg.dailyRate) || 0) * Number(client.count) * 220, // Estimated annual spend
        };
      })
    );

    return createSuccessResponse(ctx, {
      totalClients,
      totalRateCards,
      topClients: topClients.sort((a, b) => b.totalSpend - a.totalSpend),
      unassignedRateCards: unassignedCount,
    });
  });
