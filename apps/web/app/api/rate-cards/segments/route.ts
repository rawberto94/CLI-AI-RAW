import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { segmentManagementService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

const segmentService = new segmentManagementService(prisma);

/**
 * GET /api/rate-cards/segments
 * List segments for the current user
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    
    if (!tenantId || !userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }
    
    const includeShared = searchParams.get('includeShared') === 'true';
    const skip = searchParams.get('skip') ? Math.max(0, parseInt(searchParams.get('skip')!) || 0) : undefined;
    const take = searchParams.get('take') ? Math.min(Math.max(1, parseInt(searchParams.get('take')!) || 1), 200) : undefined;

    const result = await segmentService.listSegments(tenantId, userId, {
      includeShared,
      skip,
      take,
    });

    return createSuccessResponse(ctx, result);
  });

/**
 * POST /api/rate-cards/segments
 * Create a new segment
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    
    const tenantId = ctx.tenantId;
    const userId = ctx.userId;
    
    if (!tenantId || !userId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
    }

    const segment = await segmentService.createSegment(tenantId, userId, {
      name: body.name,
      description: body.description,
      filters: body.filters,
      shared: body.shared,
    });

    return createSuccessResponse(ctx, segment, { status: 201 });
  });
