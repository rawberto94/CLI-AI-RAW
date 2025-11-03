import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/rate-cards/comparisons/[id]/share
 * Share a comparison with team members
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    const { isShared, shareWithUserIds } = body;

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
  } catch (error) {
    console.error('Error sharing comparison:', error);
    return NextResponse.json(
      { error: 'Failed to share comparison', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
