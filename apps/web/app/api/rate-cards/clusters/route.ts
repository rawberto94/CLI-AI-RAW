/**
 * GET /api/rate-cards/clusters
 * 
 * Get all clusters for a tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from '@/lib/security/tenant';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { rateCardClusteringService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    // Fetch all clusters with their members and opportunities
    const clusters = await prisma.rateCardCluster.findMany({
      where: { tenantId },
      include: {
        members: {
          take: 10, // Limit members for performance
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        consolidationSavings: 'desc',
      },
    });

    // Fetch consolidation opportunities
    const consolidationOpportunities = await prisma.consolidationOpportunity.findMany({
      where: { tenantId },
      orderBy: {
        annualSavings: 'desc',
      },
    });

    // Fetch geographic arbitrage opportunities
    const arbitrageOpportunities = await prisma.geographicArbitrageOpportunity.findMany({
      where: { tenantId },
      orderBy: {
        annualSavingsPotential: 'desc',
      },
    });

    // Calculate summary statistics
    const totalSavingsPotential = clusters.reduce(
      (sum, cluster) => sum + parseFloat(cluster.consolidationSavings.toString()),
      0
    );

    const totalConsolidationSavings = consolidationOpportunities.reduce(
      (sum, opp) => sum + parseFloat(((opp as any).annualSavings || (opp as any).annualSavingsPotential || 0).toString()),
      0
    );

    const totalArbitrageSavings = arbitrageOpportunities.reduce(
      (sum, opp) => sum + parseFloat(((opp as any).annualSavingsPotential || (opp as any).annualSavings || 0).toString()),
      0
    );

    return createSuccessResponse(ctx, {
      success: true,
      clusters: clusters.map((cluster) => ({
        ...cluster,
        memberCount: cluster._count.members,
      })),
      consolidationOpportunities,
      arbitrageOpportunities,
      summary: {
        totalClusters: clusters.length,
        totalSavingsPotential,
        totalConsolidationSavings,
        totalArbitrageSavings,
        totalOpportunities:
          consolidationOpportunities.length + arbitrageOpportunities.length,
      },
    });
  });
