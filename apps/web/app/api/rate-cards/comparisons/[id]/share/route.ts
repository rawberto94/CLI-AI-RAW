import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

/**
 * POST /api/rate-cards/comparisons/[id]/share
 * Share a comparison with team members
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };
  const isTenantAdmin = ctx.userRole === 'admin' || ctx.userRole === 'owner';

  try {
    // Get session for user info
    // Require tenant ID for data isolation
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const body = await request.json();
    const { isShared, shareWithUserIds } = body;

    // First verify the comparison exists and belongs to this tenant
    const existing = await prisma.rateComparison.findFirst({
      where: { 
        id,
        tenantId,
      },
      select: {
        id: true,
        createdBy: true,
      },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found or access denied', 404);
    }

    if (!isTenantAdmin && existing.createdBy !== ctx.userId) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden - Only the creator or an admin can share this comparison', 403);
    }

    // Update the comparison to be shared
    const comparison = await prisma.rateComparison.update({
      where: { id: existing.id },
      data: {
        isShared: isShared !== undefined ? isShared : true,
      },
    });

    // If shareWithUserIds is provided, create notifications for those users
    const userIdsToShare = shareWithUserIds as string[] | undefined;
    if (userIdsToShare && userIdsToShare.length > 0) {
      const tenantRecipients = await prisma.user.findMany({
        where: {
          id: { in: userIdsToShare.map(userId => String(userId)) },
          tenantId,
        },
        select: { id: true },
      });

      if (tenantRecipients.length !== userIdsToShare.length) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'One or more users were not found', 404);
      }

      await prisma.notification.createMany({
        data: tenantRecipients.map(({ id: userId }) => ({
          tenantId,
          userId,
          type: 'COMPARISON_SHARED',
          title: 'Rate comparison shared with you',
          message: `${ctx.userId || 'A colleague'} shared a rate comparison with you`,
          resourceType: 'RateComparison',
          resourceId: id,
          priority: 'NORMAL',
          read: false,
        })),
        skipDuplicates: true,
      });
    }

    return createSuccessResponse(ctx, { 
      comparison,
      message: 'Comparison shared successfully',
      shareUrl: `/rate-cards/comparisons/${id}`,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to share comparison. Please try again.', 500);
  }
});
