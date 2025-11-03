import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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
    const body = await request.json();
    const { approvalStatus, notes } = body;

    if (!['APPROVED', 'REJECTED'].includes(approvalStatus)) {
      return NextResponse.json(
        { error: 'Invalid approval status' },
        { status: 400 }
      );
    }

    // Verify baseline belongs to user's tenant
    const baseline = await prisma.rateCardBaseline.findUnique({
      where: { id },
    });

    if (!baseline || baseline.tenantId !== user.tenantId) {
      return NextResponse.json(
        { error: 'Baseline not found' },
        { status: 404 }
      );
    }

    // Update approval status
    const updated = await prisma.rateCardBaseline.update({
      where: { id },
      data: {
        approvalStatus,
        approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
        approvedBy: user.id,
        notes: notes || baseline.notes,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating baseline approval:', error);
    return NextResponse.json(
      { error: 'Failed to update baseline approval' },
      { status: 500 }
    );
  }
}
