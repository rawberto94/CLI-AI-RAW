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

    const searchParams = request.nextUrl.searchParams;
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const marketIntelService = new marketIntelligenceService(prisma);

    const trendingRoles = await marketIntelService.getTrendingRoles(
      session.user.tenantId || 'default',
      periodMonths
    );

    return NextResponse.json(trendingRoles);
  } catch (error: unknown) {
    console.error('Error fetching trending roles:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch trending roles' },
      { status: 500 }
    );
  }
}
