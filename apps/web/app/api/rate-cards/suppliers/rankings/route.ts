/**
 * Supplier Rankings API Endpoint
 * 
 * GET /api/rate-cards/suppliers/rankings
 * 
 * Returns ranked list of suppliers based on multi-factor competitiveness scores.
 * Includes overall scores, dimension breakdowns, and ranking positions.
 * 
 * Requirements: 4.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SupplierBenchmarkService, supplierIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');
    const useIntelligence = searchParams.get('useIntelligence') !== 'false';

    // Get rankings using intelligence service if requested
    let rankings;
    
    if (useIntelligence) {
      // Use the new supplier intelligence service for comprehensive scoring
      rankings = await supplierIntelligenceService.getAllSupplierScores(
        ctx.tenantId
      );
    } else {
      // Fall back to legacy benchmark service
      const benchmarkService = new SupplierBenchmarkService(prisma);
      rankings = await benchmarkService.rankSuppliers(
        ctx.tenantId,
        periodMonths
      );
    }

    return createSuccessResponse(ctx, { 
      rankings,
      count: rankings.length,
      generatedAt: new Date().toISOString()
    });
  });
