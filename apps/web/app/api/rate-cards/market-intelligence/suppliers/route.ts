import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MarketIntelligenceService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const country = searchParams.get('country') || undefined;
    const lineOfService = searchParams.get('lineOfService') || undefined;
    const roleCategory = searchParams.get('roleCategory') || undefined;
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const marketIntelService = new MarketIntelligenceService(prisma);

    const rankings = await marketIntelService.getSupplierRanking(
      session.user.tenantId || 'default',
      {
        country,
        lineOfService,
        roleCategory,
        periodMonths,
      }
    );

    return NextResponse.json(rankings);
  } catch (error: unknown) {
    console.error('Error fetching supplier rankings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch supplier rankings' },
      { status: 500 }
    );
  }
}
