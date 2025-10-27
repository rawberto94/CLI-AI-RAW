import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { MarketIntelligenceService } from '@/../../packages/data-orchestration/src/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const marketIntelService = new MarketIntelligenceService(prisma);

    const trendingRoles = await marketIntelService.getTrendingRoles(
      session.user.tenantId || 'default',
      periodMonths
    );

    return NextResponse.json(trendingRoles);
  } catch (error: any) {
    console.error('Error fetching trending roles:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch trending roles' },
      { status: 500 }
    );
  }
}
