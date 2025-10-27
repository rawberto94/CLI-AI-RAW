import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { BaselineManagementService } from '@/../../packages/data-orchestration/src/services/baseline-management.service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, tenantId: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      minVariancePercentage = 5,
      baselineTypes,
      categoryL1,
      categoryL2,
    } = body;

    const baselineService = new BaselineManagementService(prisma);
    const result = await baselineService.bulkCompareAgainstBaselines(
      user.tenantId,
      {
        minVariancePercentage,
        baselineTypes,
        categoryL1,
        categoryL2,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error performing bulk baseline comparison:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk baseline comparison' },
      { status: 500 }
    );
  }
}
