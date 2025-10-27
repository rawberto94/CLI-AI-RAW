import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SupplierBenchmarkService } from '@packages/data-orchestration/src/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const benchmarkService = new SupplierBenchmarkService(prisma);

    const rankings = await benchmarkService.rankSuppliers(
      session.user.tenantId,
      periodMonths
    );

    return NextResponse.json({ rankings });
  } catch (error: any) {
    console.error('Error fetching supplier rankings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch supplier rankings' },
      { status: 500 }
    );
  }
}
