import { NextRequest, NextResponse } from 'next/server';
import { CompetitiveIntelligenceService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';

const competitiveIntelligenceService = new CompetitiveIntelligenceService(prisma);

/**
 * GET /api/rate-cards/competitive-intelligence
 * Get competitive intelligence metrics and dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

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
