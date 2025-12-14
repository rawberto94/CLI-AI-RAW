/**
 * Supplier Intelligence API Endpoint
 * 
 * GET /api/rate-cards/suppliers/[id]/intelligence
 * 
 * Returns comprehensive supplier intelligence including:
 * - Multi-factor competitiveness scores
 * - Historical performance trends
 * - Market position analysis
 * - Alternative supplier recommendations
 * 
 * Requirements: 4.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  SupplierIntelligenceService,
  SupplierRecommenderService,
  SupplierTrendAnalyzerService
} from 'data-orchestration/services';

const supplierIntelligenceService = new SupplierIntelligenceService();
const supplierRecommenderService = new SupplierRecommenderService();

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supplierId = params.id;
    const { searchParams } = new URL(request.url);
    const monthsBack = parseInt(searchParams.get('monthsBack') || '12');
    const includeRecommendations = searchParams.get('includeRecommendations') !== 'false';
    const includeAlerts = searchParams.get('includeAlerts') !== 'false';

    // Initialize trend analyzer with prisma
    const supplierTrendAnalyzerService = new SupplierTrendAnalyzerService(prisma);

    // Calculate competitiveness score
    const competitivenessScore = await supplierIntelligenceService.calculateCompetitivenessScore(
      supplierId,
      session.user.tenantId
    );

    // Analyze historical trends
    let trends = null;
    try {
      trends = await supplierTrendAnalyzerService.analyzeSupplierTrends(
        supplierId,
        session.user.tenantId,
        monthsBack
      );
    } catch (error) {
      console.error('Error analyzing supplier trends:', error);
      // Continue without trends
    }

    // Get alternative supplier recommendations if requested
    let alternatives = null;
    if (includeRecommendations) {
      try {
        alternatives = await supplierRecommenderService.recommendAlternatives({
          currentSupplierId: supplierId,
          tenantId: session.user.tenantId,
          maxRecommendations: 5,
          minCoveragePercent: 70
        });
      } catch (error) {
        console.error('Error getting alternative suppliers:', error);
        // Continue without alternatives
      }
    }

    // Detect above-market rate increases
    let rateIncreaseAnalysis = null;
    if (includeAlerts) {
      try {
        rateIncreaseAnalysis = await supplierTrendAnalyzerService.detectAboveMarketIncreases(
          supplierId,
          session.user.tenantId,
          10 // 10% threshold
        );
      } catch (error) {
        console.error('Error detecting rate increases:', error);
        // Continue without analysis
      }
    }

    return NextResponse.json({
      supplierId,
      competitiveness: competitivenessScore,
      trends,
      rateIncreaseAnalysis,
      alternatives,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching supplier intelligence:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch supplier intelligence' },
      { status: 500 }
    );
  }
}
