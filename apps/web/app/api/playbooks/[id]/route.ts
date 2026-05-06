/**
 * Single Playbook API
 * 
 * Get, update, delete a specific playbook
 */

import { NextRequest } from 'next/server';
import { getLegalReviewService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET - Get playbook by ID
// ============================================================================

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };
  const tenantId = ctx.tenantId;

  const legalReviewService = getLegalReviewService();
  const playbook = await legalReviewService.getPlaybook(id, tenantId);

  if (!playbook) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Playbook not found', 404);
  }

  return createSuccessResponse(ctx, {
    success: true,
    playbook,
  });
})

// ============================================================================
// PATCH - Update playbook
// ============================================================================

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };
  const tenantId = ctx.tenantId;
  const body = await request.json();

  const legalReviewService = getLegalReviewService();
  const playbook = await legalReviewService.updatePlaybook(id, tenantId, body);

  return createSuccessResponse(ctx, {
    success: true,
    playbook,
  });
})

// ============================================================================
// DELETE - Delete playbook
// ============================================================================

export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };
  const { prisma } = await import('@/lib/prisma');

  const existing = await prisma.playbook.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Playbook not found', 404);
  }

  await prisma.playbook.deleteMany({ where: { id, tenantId: ctx.tenantId } });

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Playbook deleted',
  });
})
