import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SegmentManagementService } from 'data-orchestration/services';
import { getServerSession } from '@/lib/auth';

const segmentService = new SegmentManagementService(prisma);

/**
 * POST /api/rate-cards/segments/[id]/share
 * Share a segment with team members
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    
    // Get authenticated user from session
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const userId = session?.user?.id || 'system';

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
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Get authenticated user from session
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const userId = session?.user?.id || 'system';

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
