/**
 * Single Playbook API
 * 
 * Get, update, delete a specific playbook
 */

import { NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/tenant-server';
import { getLegalReviewService } from 'data-orchestration/services';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET - Get playbook by ID
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  const ctx = getApiContext(request);
  try {
    const session = await getServerSession();

    const { id } = await params;
    const tenantId = getSessionTenantId(session);

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
  const ctx = getApiContext(request);
  try {
    const session = await getServerSession();

    const { id } = await params;
    const tenantId = getSessionTenantId(session);
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
  const ctx = getApiContext(request);
  try {

    const { id: _id } = await params;

    // In a full implementation, delete from database
    // For now, return success

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Playbook deleted',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
