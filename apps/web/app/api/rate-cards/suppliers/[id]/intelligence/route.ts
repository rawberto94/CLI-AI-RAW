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
import { prisma } from '@/lib/prisma';
import { 
  supplierIntelligenceService,
  supplierRecommenderService,
  supplierTrendAnalyzerService
} from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Get trend analyzer instance (lazy-initialized with prisma)
const getTrendAnalyzer = () => supplierTrendAnalyzerService.getInstance(prisma);

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const supplierId = params.id;
    const { searchParams } = new URL(request.url);
    const monthsBack = parseInt(searchParams.get('monthsBack') || '12');
    const includeRecommendations = searchParams.get('includeRecommendations') !== 'false';
    const includeAlerts = searchParams.get('includeAlerts') !== 'false';

    // Calculate competitiveness score
    const competitivenessScore = await supplierIntelligenceService.calculateCompetitivenessScore(
      supplierId,
      ctx.tenantId
    );

    // Analyze historical trends
    let trends = null;
    try {
      trends = await getTrendAnalyzer().analyzeSupplierTrends(
        supplierId,
        ctx.tenantId,
        monthsBack
      );
    } catch {
      // Continue without trends
    }

    // Get alternative supplier recommendations if requested
    let alternatives = null;
    if (includeRecommendations) {
      try {
        alternatives = await supplierRecommenderService.recommendAlternatives({
          currentSupplierId: supplierId,
          tenantId: ctx.tenantId,
          maxRecommendations: 5,
          minCoveragePercent: 70
        });
      } catch {
        // Continue without alternatives
      }
    }

    // Detect above-market rate increases
    let rateIncreaseAnalysis = null;
    if (includeAlerts) {
      try {
        rateIncreaseAnalysis = await getTrendAnalyzer().detectAboveMarketIncreases(
          supplierId,
          ctx.tenantId,
          10 // 10% threshold
        );
      } catch {
        // Continue without analysis
      }
    }

    return createSuccessResponse(ctx, {
      supplierId,
      competitiveness: competitivenessScore,
      trends,
      rateIncreaseAnalysis,
      alternatives,
      generatedAt: new Date().toISOString()
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch supplier intelligence', 500);
  }
}
