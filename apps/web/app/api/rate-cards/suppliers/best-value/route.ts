import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SupplierBenchmarkService } from 'data-orchestration/services';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roleCategory = searchParams.get('roleCategory') || undefined;
    const country = searchParams.get('country') || undefined;
    const lineOfService = searchParams.get('lineOfService') || undefined;

    const benchmarkService = new SupplierBenchmarkService(prisma);

    const bestValue = await benchmarkService.findBestValueSuppliers(
      session.user.tenantId,
      {
        roleCategory,
        country,
        lineOfService,
      }
    );

    return NextResponse.json({ suppliers: bestValue });
  } catch (error: unknown) {
    console.error('Error fetching best value suppliers:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch best value suppliers' },
      { status: 500 }
    );
  }
}
