/**
 * GET /api/rate-cards/clusters
 * 
 * Get all clusters for a tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from '@/lib/security/tenant';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID required' }, { status: 400 });
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

    return NextResponse.json({
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
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch clusters' },
      { status: 500 }
    );
  }
}
