import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { marketIntelligenceService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const marketIntelService = new marketIntelligenceService(prisma);

    const trends = await marketIntelService.detectEmergingTrends(
      session.user.tenantId || 'default'
    );

    return NextResponse.json(trends);
  } catch (error: unknown) {
    console.error('Error fetching emerging trends:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch emerging trends' },
      { status: 500 }
    );
  }
}
