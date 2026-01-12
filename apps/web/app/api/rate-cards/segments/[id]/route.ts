import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { segmentManagementService } from 'data-orchestration/services';
import { getServerSession } from '@/lib/auth';

const segmentService = new segmentManagementService(prisma);

/**
 * GET /api/rate-cards/segments/[id]
 * Get a specific segment
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    const segment = await segmentService.getSegment(params.id, tenantId);

    return NextResponse.json(segment);
  } catch (error) {
    console.error('Error getting segment:', error);
    return NextResponse.json(
      { error: 'Failed to get segment', details: error instanceof Error ? error.message : String(error) },
      { status: 404 }
    );
  }
}

/**
 * PATCH /api/rate-cards/segments/[id]
 * Update a segment
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
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

    const segment = await segmentService.updateSegment(
      params.id,
      tenantId,
      userId,
      {
        name: body.name,
        description: body.description,
        filters: body.filters,
        shared: body.shared,
      }
    );

    return NextResponse.json(segment);
  } catch (error) {
    console.error('Error updating segment:', error);
    return NextResponse.json(
      { error: 'Failed to update segment', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/rate-cards/segments/[id]
 * Delete a segment
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

    await segmentService.deleteSegment(params.id, tenantId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting segment:', error);
    return NextResponse.json(
      { error: 'Failed to delete segment', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
