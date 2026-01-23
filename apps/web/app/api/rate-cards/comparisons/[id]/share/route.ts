import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';

/**
 * POST /api/rate-cards/comparisons/[id]/share
 * Share a comparison with team members
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Get session for user info
    const session = await getServerSession();
    
    // Require tenant ID for data isolation
    const tenantId = request.headers.get('x-tenant-id') || session?.user?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { isShared, shareWithUserIds } = body;

    // First verify the comparison exists and belongs to this tenant
    const existing = await prisma.rateComparison.findFirst({
      where: { 
        id: params.id,
        tenantId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Comparison not found or access denied' },
        { status: 404 }
      );
    }

    // Update the comparison to be shared
    const comparison = await prisma.rateComparison.update({
      where: { id: params.id },
      data: {
        isShared: isShared !== undefined ? isShared : true,
      },
    });

    // If shareWithUserIds is provided, create notifications for those users
    const userIdsToShare = shareWithUserIds as string[] | undefined;
    if (userIdsToShare && userIdsToShare.length > 0) {
      await prisma.notification.createMany({
        data: userIdsToShare.map(userId => ({
          tenantId,
          userId,
          type: 'COMPARISON_SHARED',
          title: 'Rate comparison shared with you',
          message: `${session?.user?.name || session?.user?.email || 'A colleague'} shared a rate comparison with you`,
          resourceType: 'RateComparison',
          resourceId: params.id,
          priority: 'NORMAL',
          read: false,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ 
      comparison,
      message: 'Comparison shared successfully',
      shareUrl: `/rate-cards/comparisons/${params.id}`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to share comparison', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
