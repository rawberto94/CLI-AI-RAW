/**
 * Review Queue Statistics API
 * 
 * Get aggregated stats for the review queue
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse } from '@/lib/api-middleware';

/**
 * GET /api/ocr/review-queue/stats
 * Get queue statistics
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const { prisma } = await import('@/lib/prisma');
  const where = { tenantId: ctx.tenantId };

  const all = await prisma.ocrReviewItem.findMany({
    where,
    select: { status: true, priority: true, type: true, updatedAt: true },
  });

  const summary = {
    total: all.length,
    pending: all.filter(i => i.status === 'pending').length,
    inProgress: all.filter(i => i.status === 'in_progress').length,
    completed: all.filter(i => i.status === 'completed').length,
    escalated: all.filter(i => i.status === 'escalated').length,
    completionRate: all.length > 0
      ? Math.round((all.filter(i => i.status === 'completed').length / all.length) * 100)
      : 0,
  };

  const byPriority = {
    critical: all.filter(i => i.priority === 'critical').length,
    high: all.filter(i => i.priority === 'high').length,
    medium: all.filter(i => i.priority === 'medium').length,
    low: all.filter(i => i.priority === 'low').length,
  };

  const byType = {
    ocr_quality: all.filter(i => i.type === 'ocr_quality').length,
    handwriting: all.filter(i => i.type === 'handwriting').length,
    mixed_language: all.filter(i => i.type === 'mixed_language').length,
    legal_entity: all.filter(i => i.type === 'legal_entity').length,
    sensitive_content: all.filter(i => i.type === 'sensitive_content').length,
  };

  const recentActivity = all
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);

  return createSuccessResponse(ctx, { summary, byPriority, byType, recentActivity });
});
