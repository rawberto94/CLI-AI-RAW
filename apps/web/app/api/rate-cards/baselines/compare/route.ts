import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BaselineManagementService } from 'data-orchestration/services';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { 
        email: session.user.email,
        tenantId: session.user.tenantId 
      },
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
