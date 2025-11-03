import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { MarketIntelligenceService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const marketIntelService = new MarketIntelligenceService(prisma);

    const trends = await marketIntelService.detectEmergingTrends(
      session.user.tenantId || 'default'
    );

    return NextResponse.json(trends);
  } catch (error: any) {
    console.error('Error fetching emerging trends:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch emerging trends' },
      { status: 500 }
    );
  }
}
