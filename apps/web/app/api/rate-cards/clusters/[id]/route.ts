/**
 * GET /api/rate-cards/clusters/[id]
 * 
 * Get detailed information about a specific cluster
 */

import { NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardClusteringService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const clusterId = params.id;
    const tenantId = ctx.tenantId;

    // Require tenant ID for security
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    // Fetch cluster with all members - scoped to tenant
    const cluster = await prisma.rateCardCluster.findFirst({
      where: { id: clusterId, tenantId },
      include: {
        members: {
          include: {
            // Note: We can't directly include rateCardEntry here due to schema limitations
            // We'll fetch them separately
          },
        },
      },
    });

    if (!cluster) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Cluster not found or access denied', 404);
    }

    // Fetch rate card entries for all members - scoped to tenant
    const memberIds = cluster.members.map((m) => m.rateCardEntryId);
    const rateCardEntries = await prisma.rateCardEntry.findMany({
      where: {
        id: { in: memberIds },
        tenantId,
      },
      include: {
        supplier: true,
      },
    });

    // Map rate cards to members
    const membersWithDetails = cluster.members.map((member) => {
      const rateCard = rateCardEntries.find((rc) => rc.id === member.rateCardEntryId);
      return {
        ...member,
        rateCard,
      };
    });

    // Fetch consolidation opportunities for this cluster
    const consolidationOpportunities = await prisma.consolidationOpportunity.findMany({
      where: { clusterId },
    });

    // Fetch geographic arbitrage opportunities for this cluster
    const arbitrageOpportunities = await prisma.geographicArbitrageOpportunity.findMany({
      where: { clusterId },
      orderBy: {
        annualSavingsPotential: 'desc',
      },
    });

    // Calculate additional statistics
    const rates = rateCardEntries.map((rc) => parseFloat(rc.dailyRateUSD.toString()));
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    const variance =
      rates.reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);

    // Group by supplier
    const supplierGroups = rateCardEntries.reduce((acc, rc) => {
      const key = rc.supplierId;
      if (!acc[key]) {
        acc[key] = {
          supplierId: rc.supplierId,
          supplierName: rc.supplierName,
          count: 0,
          avgRate: 0,
          rates: [],
        };
      }
      acc[key].count++;
      acc[key].rates.push(parseFloat(rc.dailyRateUSD.toString()));
      return acc;
    }, {} as Record<string, {
      supplierId: string;
      supplierName: string;
      count: number;
      avgRate: number;
      rates: number[];
    }>);

    interface SupplierGroup {
      supplierId: string;
      supplierName: string;
      count: number;
      avgRate: number;
      rates: number[];
    }

    // Calculate average rate per supplier
    Object.values(supplierGroups).forEach((group: SupplierGroup) => {
      group.avgRate = group.rates.reduce((sum: number, r: number) => sum + r, 0) / group.rates.length;
      delete (group as Partial<SupplierGroup>).rates; // Remove raw rates from response
    });

    return createSuccessResponse(ctx, {
      success: true,
      cluster: {
        ...cluster,
        members: membersWithDetails,
        statistics: {
          avgRate,
          stdDev,
          coefficientOfVariation: stdDev / avgRate,
          supplierBreakdown: Object.values(supplierGroups),
        },
      },
      consolidationOpportunities,
      arbitrageOpportunities,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Unknown error', 500);
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const clusterId = params.id;
    const tenantId = ctx.tenantId;

    // Require tenant ID for security
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    // Verify cluster belongs to tenant before deletion
    const cluster = await prisma.rateCardCluster.findFirst({
      where: { id: clusterId, tenantId },
    });

    if (!cluster) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Cluster not found or access denied', 404);
    }

    // Delete cluster (cascade will delete members)
    await prisma.rateCardCluster.delete({
      where: { id: clusterId },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Cluster deleted successfully',
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Unknown error', 500);
  }
}
