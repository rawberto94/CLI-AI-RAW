import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/tenant-server';
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
    const lineOfService = searchParams.get('lineOfService') || undefined;

    if (!role || !seniority) {
      return NextResponse.json(
        { error: 'Role and seniority are required' },
        { status: 400 }
      );
    }

    const marketIntelService = new marketIntelligenceService(prisma);

    const comparison = await marketIntelService.getGeographicComparison(
      getSessionTenantId(session),
      role,
      seniority,
      lineOfService
    );

    return NextResponse.json(comparison);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch geographic comparison' },
      { status: 500 }
    );
  }
}
