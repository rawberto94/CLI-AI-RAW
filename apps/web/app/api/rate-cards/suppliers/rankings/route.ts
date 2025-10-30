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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SupplierBenchmarkService } from '@/packages/data-orchestration/src/services/supplier-benchmark.service';
import { supplierIntelligenceService } from '@/packages/data-orchestration/src/services/supplier-intelligence.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');
    const useIntelligence = searchParams.get('useIntelligence') !== 'false';

    // Get rankings using intelligence service if requested
    let rankings;
    
    if (useIntelligence) {
      // Use the new supplier intelligence service for comprehensive scoring
      rankings = await supplierIntelligenceService.getAllSupplierScores(
        session.user.tenantId
      );
    } else {
      // Fall back to legacy benchmark service
      const benchmarkService = new SupplierBenchmarkService(prisma);
      rankings = await benchmarkService.rankSuppliers(
        session.user.tenantId,
        periodMonths
      );
    }

    return NextResponse.json({ 
      rankings,
      count: rankings.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching supplier rankings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch supplier rankings' },
      { status: 500 }
    );
  }
}
