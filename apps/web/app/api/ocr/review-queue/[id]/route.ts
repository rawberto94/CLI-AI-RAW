/**
 * Human Review Queue Item API
 * 
 * Individual review item operations
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// Update schema
const updateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'escalated']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignedTo: z.string().nullable().optional(),
  corrections: z.array(z.object({
    field: z.string(),
    original: z.string(),
    corrected: z.string(),
    confidence: z.number().optional(),
  })).optional(),
  notes: z.string().optional(),
  escalationReason: z.string().optional(),
});

/**
 * GET /api/ocr/review-queue/[id]
 * Get a single review item
 */
export const GET = withAuthApiHandler(async (
  request: NextRequest,
  ctx,
) => {
  const { id } = await (ctx as any).params;
  const { prisma } = await import('@/lib/prisma');

  const item = await prisma.ocrReviewItem.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });

  if (!item) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Review item not found', 404);
  }

  return createSuccessResponse(ctx, item);
});

/**
 * PATCH /api/ocr/review-queue/[id]
 * Update a review item (assign, complete, escalate)
 */
export const PATCH = withAuthApiHandler(async (
  request: NextRequest,
  ctx,
) => {
  const { id } = await (ctx as any).params;
  const body = await request.json();
  const data = updateSchema.parse(body);
  const { prisma } = await import('@/lib/prisma');

  const existing = await prisma.ocrReviewItem.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Review item not found', 404);
  }

  const updateData: any = { ...data };
  if (data.status === 'completed') {
    updateData.completedAt = new Date();
    updateData.completedBy = ctx.userId;
  }
  if (data.status === 'escalated' && data.escalationReason) {
    updateData.escalatedAt = new Date();
    updateData.escalatedBy = ctx.userId;
  }
  if (data.assignedTo !== undefined) {
    updateData.assignedAt = data.assignedTo ? new Date() : null;
  }

  const item = await prisma.ocrReviewItem.update({
    where: { id },
    data: updateData,
  });

  return createSuccessResponse(ctx, item);
});

/**
 * DELETE /api/ocr/review-queue/[id]
 * Delete a review item (admin only)
 */
export const DELETE = withAuthApiHandler(async (
  request: NextRequest,
  ctx,
) => {
  const { id } = await (ctx as any).params;
  const { prisma } = await import('@/lib/prisma');

  const existing = await prisma.ocrReviewItem.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Review item not found', 404);
  }

  await prisma.ocrReviewItem.deleteMany({ where: { id, tenantId: ctx.tenantId } });

  return createSuccessResponse(ctx, { success: true, id });
});
