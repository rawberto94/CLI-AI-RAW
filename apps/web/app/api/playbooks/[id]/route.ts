/**
 * Single Playbook API
 * 
 * Get, update, delete a specific playbook
 */

import { NextRequest } from 'next/server';
import { getLegalReviewService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET - Get playbook by ID
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { id } = await params;
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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// ============================================================================
// PATCH - Update playbook
// ============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { id } = await params;
    const tenantId = ctx.tenantId;
    const body = await request.json();

    const legalReviewService = getLegalReviewService();
    const playbook = await legalReviewService.updatePlaybook(id, tenantId, body);

    return createSuccessResponse(ctx, {
      success: true,
      playbook,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// ============================================================================
// DELETE - Delete playbook
// ============================================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { id } = await params;
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
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
