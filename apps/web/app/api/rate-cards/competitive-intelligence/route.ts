import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CompetitiveIntelligenceService } from '@/packages/data-orchestration/src/services/competitive-intelligence.service';

const competitiveIntelligenceService = new CompetitiveIntelligenceService(prisma);

/**
 * GET /api/rate-cards/competitive-intelligence
 * Get competitive intelligence metrics and dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // TODO: Get from session/auth
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    const metrics = await competitiveIntelligenceService.calculateCompetitivenessScore(tenantId);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching competitive intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to fetch competitive intelligence', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
