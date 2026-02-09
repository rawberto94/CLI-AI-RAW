/**
 * Review Queue Statistics API
 * 
 * Get aggregated stats for the review queue
 * Note: Stubbed until OcrReviewItem model is migrated to database
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
/**
 * GET /api/ocr/review-queue/stats
 * Get queue statistics
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  // Stubbed statistics - in production, aggregate from Prisma
  return createSuccessResponse(ctx, {
    summary: {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      escalated: 0,
      completionRate: 0,
    },
    byPriority: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    byType: {
      ocr_quality: 0,
      handwriting: 0,
      mixed_language: 0,
      legal_entity: 0,
      sensitive_content: 0,
    },
    recentActivity: [],
    message: 'Note: Using stubbed data until database migration is run. Run `prisma migrate dev` to enable full functionality.',
  });
});
