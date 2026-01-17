import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { baselineManagementService } from 'data-orchestration/services';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    const { id } = params;

    // Verify rate card entry belongs to user's tenant
    const entry = await prisma.rateCardEntry.findUnique({
      where: { id },
      select: { tenantId: true },
    });

    if (!entry || entry.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Rate card entry not found' },
        { status: 404 }
      );
    }

    // Compare against baselines
    const baselineService = new baselineManagementService(prisma);
    const comparisons = await baselineService.compareAgainstBaselines(id);

    return NextResponse.json({ comparisons });
  } catch {
    return NextResponse.json(
      { error: 'Failed to compare against baselines' },
      { status: 500 }
    );
  }
}
