/**
 * POST /api/rate-cards/cluster
 * 
 * Cluster rate cards using K-means algorithm to identify consolidation opportunities
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { rateCardClusteringService } from 'data-orchestration/services';
import { consolidationOpportunityService } from 'data-orchestration/services';
import { geographicArbitrageService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, k, maxIterations, convergenceThreshold, minClusterSize } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Perform clustering
    const clusters = await rateCardClusteringService.clusterRateCards(tenantId, {
      k,
      maxIterations,
      convergenceThreshold,
      minClusterSize,
    });

    // Save clusters to database
    const savedClusters = await Promise.all(
      clusters.map(async (cluster) => {
        // Create cluster record
        const clusterRecord = await prisma.rateCardCluster.create({
          data: {
            tenantId,
            name: cluster.name,
            clusterType: 'K_MEANS',
            memberCount: cluster.memberCount,
            avgRate: cluster.characteristics.avgRate,
            minRate: cluster.characteristics.minRate,
            maxRate: cluster.characteristics.maxRate,
            characteristics: cluster.characteristics as any,
            centroid: cluster.centroid as any,
            consolidationSavings: cluster.consolidationSavings,
            supplierCount: cluster.characteristics.supplierCount,
          },
        });

        // Create cluster member records
        await Promise.all(
          cluster.members.map((memberId, _index) =>
            prisma.clusterMember.create({
              data: {
                clusterId: clusterRecord.id,
                rateCardEntryId: memberId,
                similarityScore: 85, // Placeholder - would calculate actual similarity
                distanceToCentroid: 0.1, // Placeholder
              },
            })
          )
        );

        // Identify consolidation opportunities
        const consolidationOpp = await consolidationOpportunityService.identifyConsolidationOpportunities(
          clusterRecord.id,
          cluster,
          tenantId
        );

        if (consolidationOpp) {
          await prisma.consolidationOpportunity.create({
            data: {
              tenantId,
              clusterId: clusterRecord.id,
              opportunityName: consolidationOpp.clusterName,
              description: `Consolidation opportunity for ${consolidationOpp.clusterName}`,
              currentSupplierCount: consolidationOpp.currentSuppliers.length,
              recommendedSupplierId: consolidationOpp.recommendedSupplier.supplierId,
              recommendedSupplierName: consolidationOpp.recommendedSupplier.supplierName,
              suppliersToConsolidate: consolidationOpp.suppliersToConsolidate,
              currentAnnualCost: consolidationOpp.currentAnnualCost,
              projectedAnnualCost: consolidationOpp.projectedAnnualCost,
              annualSavings: consolidationOpp.annualSavings || 0,
              annualSavingsPotential: (consolidationOpp as any).annualSavingsPotential || consolidationOpp.annualSavings || 0,
              savingsPercentage: consolidationOpp.savingsPercentage,
              totalVolume: consolidationOpp.totalVolume,
              volumeBySupplier: consolidationOpp.volumeBySupplier as any,
              riskLevel: consolidationOpp.riskLevel,
              riskFactors: consolidationOpp.riskFactors,
              implementationComplexity: consolidationOpp.implementationComplexity,
              estimatedTimeframe: consolidationOpp.estimatedTimeframe,
              actionItems: consolidationOpp.actionItems,
              confidence: consolidationOpp.confidence,
              dataQuality: consolidationOpp.dataQuality,
            },
          });
        }

        // Identify geographic arbitrage opportunities
        const arbitrageOpps = await geographicArbitrageService.detectArbitrageOpportunities(
          clusterRecord.id,
          cluster,
          tenantId
        );

        await Promise.all(
          arbitrageOpps.map((opp) =>
            prisma.geographicArbitrageOpportunity.create({
              data: {
                tenantId,
                clusterId: clusterRecord.id,
                sourceCountry: opp.sourceGeography.country,
                sourceRegion: opp.sourceGeography.region,
                targetCountry: opp.targetGeography.country,
                targetRegion: opp.targetGeography.region,
                currentAverageRate: opp.currentAverageRate,
                targetAverageRate: opp.targetAverageRate,
                rateDifference: opp.rateDifference,
                savingsPercentage: opp.savingsPercentage,
                annualSavingsPotential: opp.annualSavingsPotential,
                affectedRoles: opp.affectedRoles,
                estimatedFTEs: opp.estimatedFTEs,
                qualityDifference: opp.qualityDifference,
                riskLevel: opp.riskLevel,
                riskFactors: opp.riskFactors,
                feasibility: opp.feasibility,
                considerations: opp.considerations,
                recommendations: opp.recommendations,
                confidence: opp.confidence,
                sourceSampleSize: opp.sampleSize.source,
                targetSampleSize: opp.sampleSize.target,
              },
            })
          )
        );

        return {
          ...cluster,
          id: clusterRecord.id,
          consolidationOpportunity: consolidationOpp,
          arbitrageOpportunities: arbitrageOpps,
        };
      })
    );

    return NextResponse.json({
      success: true,
      clusters: savedClusters,
      totalClusters: savedClusters.length,
      totalSavingsPotential: savedClusters.reduce(
        (sum, c) => sum + c.consolidationSavings,
        0
      ),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cluster rate cards' },
      { status: 500 }
    );
  }
}
