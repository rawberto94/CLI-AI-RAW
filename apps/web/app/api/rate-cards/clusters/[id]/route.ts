/**
 * GET /api/rate-cards/clusters/[id]
 * 
 * Get detailed information about a specific cluster
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clusterId = params.id;

    // Fetch cluster with all members
    const cluster = await prisma.rateCardCluster.findUnique({
      where: { id: clusterId },
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
      return NextResponse.json(
        { error: 'Cluster not found' },
        { status: 404 }
      );
    }

    // Fetch rate card entries for all members
    const memberIds = cluster.members.map((m) => m.rateCardEntryId);
    const rateCardEntries = await prisma.rateCardEntry.findMany({
      where: {
        id: { in: memberIds },
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
    }, {} as Record<string, any>);

    // Calculate average rate per supplier
    Object.values(supplierGroups).forEach((group: any) => {
      group.avgRate = group.rates.reduce((sum: number, r: number) => sum + r, 0) / group.rates.length;
      delete group.rates; // Remove raw rates from response
    });

    return NextResponse.json({
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
  } catch (error: any) {
    console.error('Error fetching cluster details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cluster details' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const clusterId = params.id;

    // Delete cluster (cascade will delete members)
    await prisma.rateCardCluster.delete({
      where: { id: clusterId },
    });

    return NextResponse.json({
      success: true,
      message: 'Cluster deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting cluster:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete cluster' },
      { status: 500 }
    );
  }
}
