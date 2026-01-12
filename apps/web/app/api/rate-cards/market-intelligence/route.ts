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
    const role = searchParams.get('role');
    const seniority = searchParams.get('seniority');
    const country = searchParams.get('country');
    const lineOfService = searchParams.get('lineOfService');
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const marketIntelService = new marketIntelligenceService(prisma);

    // Get market intelligence
    const intelligence = await marketIntelService.calculateMarketIntelligence({
      roleStandardized: role || undefined,
      seniority: seniority || undefined,
      country: country || undefined,
      lineOfService: lineOfService || undefined,
      periodMonths,
      tenantId: session.user.tenantId || 'default',
    });

    return NextResponse.json(intelligence);
  } catch (error: unknown) {
    console.error('Error fetching market intelligence:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch market intelligence' },
      { status: 500 }
    );
  }
}
