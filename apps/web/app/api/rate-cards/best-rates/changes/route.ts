/**
 * Best Rate Changes API
 * 
 * Track and notify about changes in best rates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RateCardBenchmarkingEngine } from 'data-orchestration/services';

/**
 * GET /api/rate-cards/best-rates/changes
 * Get recent best rate changes for the tenant
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const benchmarkEngine = new RateCardBenchmarkingEngine(prisma);
    const changes = await benchmarkEngine.trackBestRateChanges(session.user.tenantId);

    // Sort by absolute change percentage (most significant first)
    changes.sort((a, b) => Math.abs(b.changePercentage) - Math.abs(a.changePercentage));

    return NextResponse.json({
      changes,
      total: changes.length,
      summary: {
        improvements: changes.filter(c => c.changePercentage < 0).length,
        deteriorations: changes.filter(c => c.changePercentage > 0).length,
        totalAffectedRateCards: changes.reduce((sum, c) => sum + c.affectedRateCards, 0),
      },
    });
  } catch (error) {
    console.error('Error tracking best rate changes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to track changes' },
      { status: 500 }
    );
  }
}
