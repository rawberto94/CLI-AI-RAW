import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SegmentManagementService } from 'data-orchestration/services';
import { getServerSession } from '@/lib/auth';

const segmentService = new SegmentManagementService(prisma);

/**
 * GET /api/rate-cards/segments
 * List segments for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get authenticated user from session
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || searchParams.get('tenantId') || 'default-tenant';
    const userId = session?.user?.id || searchParams.get('userId') || 'system';
    
    const includeShared = searchParams.get('includeShared') === 'true';
    const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip')!) : undefined;
    const take = searchParams.get('take') ? parseInt(searchParams.get('take')!) : undefined;

    const result = await segmentService.listSegments(tenantId, userId, {
      includeShared,
      skip,
      take,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing segments:', error);
    return NextResponse.json(
      { error: 'Failed to list segments', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rate-cards/segments
 * Create a new segment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get authenticated user from session
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || body.tenantId || 'default-tenant';
    const userId = session?.user?.id || body.userId || 'system';

    const segment = await segmentService.createSegment(tenantId, userId, {
      name: body.name,
      description: body.description,
      filters: body.filters,
      shared: body.shared,
    });

    return NextResponse.json(segment, { status: 201 });
  } catch (error) {
    console.error('Error creating segment:', error);
    return NextResponse.json(
      { error: 'Failed to create segment', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
