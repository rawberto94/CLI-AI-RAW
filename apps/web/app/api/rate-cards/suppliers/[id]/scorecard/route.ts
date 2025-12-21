import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SupplierBenchmarkService } from 'data-orchestration/services';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supplierId = params.id;
    const { searchParams } = new URL(request.url);
    const periodMonths = parseInt(searchParams.get('periodMonths') || '12');

    const benchmarkService = new SupplierBenchmarkService(prisma);

    // Try to get latest benchmark first
    let scorecard = await benchmarkService.getLatestBenchmark(
      supplierId,
      session.user.tenantId
    );

    // If no recent benchmark, calculate new one
    if (!scorecard) {
      scorecard = await benchmarkService.calculateSupplierBenchmark({
        supplierId,
        tenantId: session.user.tenantId,
        periodMonths,
      });
    }

    // Get rate stability data
    const stability = await benchmarkService.trackRateStability(
      supplierId,
      session.user.tenantId,
      periodMonths
    );

    return NextResponse.json({
      scorecard,
      stability,
    });
  } catch (error: unknown) {
    console.error('Error fetching supplier scorecard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch supplier scorecard' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supplierId = params.id;
    const body = await request.json();
    const periodMonths = body.periodMonths || 12;

    const benchmarkService = new SupplierBenchmarkService(prisma);

    // Force recalculation
    const scorecard = await benchmarkService.calculateSupplierBenchmark({
      supplierId,
      tenantId: session.user.tenantId,
      periodMonths,
    });

    return NextResponse.json({ scorecard });
  } catch (error: unknown) {
    console.error('Error calculating supplier scorecard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate supplier scorecard' },
      { status: 500 }
    );
  }
}
