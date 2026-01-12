/**
 * Savings vs Best Rate API
 * 
 * Calculate potential savings compared to the best rate in the market
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateCardBenchmarkingService } from 'data-orchestration/services';

/**
 * GET /api/rate-cards/[id]/savings-vs-best
 * Calculate savings vs best rate for a specific rate card entry
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateCardId = params.id;

    // Verify rate card belongs to tenant
    const rateCard = await prisma.rateCardEntry.findFirst({
      where: {
        id: rateCardId,
        tenantId: session.user.tenantId,
      },
    });

    if (!rateCard) {
      return NextResponse.json({ error: 'Rate card not found' }, { status: 404 });
    }

    const benchmarkEngine = new rateCardBenchmarkingService(prisma);
    const savingsVsBest = await benchmarkEngine.calculateSavingsVsBest(rateCardId);

    return NextResponse.json(savingsVsBest);
  } catch (error) {
    console.error('Error calculating savings vs best:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate savings' },
      { status: 500 }
    );
  }
}
