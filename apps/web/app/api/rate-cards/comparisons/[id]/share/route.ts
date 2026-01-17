import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/rate-cards/comparisons/[id]/share
 * Share a comparison with team members
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Require tenant ID for data isolation
    const tenantId = request.headers.get('x-tenant-id');
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

    // TODO: If shareWithUserIds is provided, create notifications or permissions
    // This would require additional tables for user-specific sharing

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
