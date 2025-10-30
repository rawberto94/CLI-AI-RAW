import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SegmentManagementService } from '@/packages/data-orchestration/src/services/segment-management.service';

const segmentService = new SegmentManagementService(prisma);

/**
 * POST /api/rate-cards/segments/[id]/share
 * Share a segment with team members
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // TODO: Get from session/auth
    const tenantId = body.tenantId || 'default-tenant';
    const userId = body.userId || 'system';

    const segment = await segmentService.shareSegment(params.id, tenantId, userId);

    return NextResponse.json(segment);
  } catch (error) {
    console.error('Error sharing segment:', error);
    return NextResponse.json(
      { error: 'Failed to share segment', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/rate-cards/segments/[id]/share
 * Unshare a segment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // TODO: Get from session/auth
    const tenantId = searchParams.get('tenantId') || 'default-tenant';
    const userId = searchParams.get('userId') || 'system';

    const segment = await segmentService.unshareSegment(params.id, tenantId, userId);

    return NextResponse.json(segment);
  } catch (error) {
    console.error('Error unsharing segment:', error);
    return NextResponse.json(
      { error: 'Failed to unshare segment', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
