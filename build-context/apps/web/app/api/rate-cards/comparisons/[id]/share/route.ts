import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardBenchmarkingService } from 'data-orchestration/services';

/**
 * POST /api/rate-cards/comparisons/[id]/share
 * Share a comparison with team members
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    // Get session for user info
    // Require tenant ID for data isolation
    const tenantId = ctx.tenantId || ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found or access denied', 404);
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
          message: `${ctx.userId || 'A colleague'} shared a rate comparison with you`,
          resourceType: 'RateComparison',
          resourceId: params.id,
          priority: 'NORMAL',
          read: false,
        })),
        skipDuplicates: true,
      });
    }

    return createSuccessResponse(ctx, { 
      comparison,
      message: 'Comparison shared successfully',
      shareUrl: `/rate-cards/comparisons/${params.id}`,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to share comparison. Please try again.', 500);
  }
}
