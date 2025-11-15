import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { MarketIntelligenceService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const seniority = searchParams.get('seniority');
    const lineOfService = searchParams.get('lineOfService') || undefined;

    if (!role || !seniority) {
      return NextResponse.json(
        { error: 'Role and seniority are required' },
        { status: 400 }
      );
    }

    const marketIntelService = new MarketIntelligenceService(prisma);

    const comparison = await marketIntelService.getGeographicComparison(
      session.user.tenantId || 'default',
      role,
      seniority,
      lineOfService
    );

    return NextResponse.json(comparison);
  } catch (error: any) {
    console.error('Error fetching geographic comparison:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch geographic comparison' },
      { status: 500 }
    );
  }
}
