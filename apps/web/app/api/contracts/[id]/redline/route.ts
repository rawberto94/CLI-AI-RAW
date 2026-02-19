/**
 * Redline Persistence API
 *
 * POST /api/contracts/[id]/redline — Save tracked changes + comments
 * GET  /api/contracts/[id]/redline — Load last-saved redline session
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

/* ------------------------------------------------------------------ */
/*  GET — load saved redline state                                     */
/* ------------------------------------------------------------------ */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(_request);
  const authCtx = getAuthenticatedApiContext(_request);
  if (!authCtx) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
  }
  try {
    const { id } = await params;
    const tenantId = authCtx.tenantId;

    const contract = await prisma.contract.findFirst({
      where: { id, tenantId, isDeleted: false },
      select: {
        id: true,
        metadata: true,
        status: true,
        rawText: true,
        contractTitle: true,
      },
    });

    if (!contract) {
      return createErrorResponse(authCtx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Redline state stored in metadata.redline
    const meta = (contract.metadata as Record<string, unknown>) || {};
    const redline = (meta.redline as Record<string, unknown>) || null;

    return createSuccessResponse(authCtx, {
      contractId: contract.id,
      contractTitle: contract.contractTitle,
      status: contract.status,
      content: redline?.content ?? contract.rawText ?? '',
      changes: redline?.changes ?? [],
      comments: redline?.comments ?? [],
      documentStatus: redline?.documentStatus ?? 'draft',
      savedAt: redline?.savedAt ?? null,
      savedBy: redline?.savedBy ?? null,
      version: redline?.version ?? 0,
    });
  } catch (error) {
    console.error('[Redline GET] Error:', error);
    return createErrorResponse(authCtx, 'INTERNAL_ERROR', 'Failed to load redline data', 500);
  }
}

/* ------------------------------------------------------------------ */
/*  POST — save redline state                                          */
/* ------------------------------------------------------------------ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  const authCtx = getAuthenticatedApiContext(request);
  if (!authCtx) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Authentication required', 401);
  }
  try {
    const { id } = await params;
    const tenantId = authCtx.tenantId;

    const body = await request.json();
    const {
      content,
      changes = [],
      comments = [],
      documentStatus = 'draft',
      finalize = false,
    } = body;

    if (typeof content !== 'string') {
      return createErrorResponse(authCtx, 'VALIDATION_ERROR', 'content (string) is required', 400);
    }

    // Verify ownership
    const contract = await prisma.contract.findFirst({
      where: { id, tenantId, isDeleted: false },
      select: { id: true, metadata: true, status: true },
    });

    if (!contract) {
      return createErrorResponse(authCtx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const now = new Date().toISOString();
    const existingMeta = (contract.metadata as Record<string, unknown>) || {};
    const existingRedline = (existingMeta.redline as Record<string, unknown>) || {};
    const version = ((existingRedline.version as number) || 0) + 1;

    // Look up user details for savedBy field
    const user = await prisma.user.findUnique({
      where: { id: authCtx.userId },
      select: { email: true, firstName: true, lastName: true },
    });
    const savedByName = user?.email || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'unknown');

    // Build redline payload
    const redlinePayload = {
      content,
      changes,
      comments,
      documentStatus: finalize ? 'approved' : documentStatus,
      savedAt: now,
      savedBy: savedByName,
      version,
    };

    // Build status history entry
    const statusHistory = Array.isArray(existingMeta.statusHistory)
      ? existingMeta.statusHistory
      : [];

    // If finalizing, also transition contract status
    const updateData: Record<string, unknown> = {
      metadata: {
        ...existingMeta,
        redline: redlinePayload,
        statusHistory: finalize
          ? [
              ...statusHistory,
              {
                from: contract.status,
                to: 'ACTIVE',
                at: now,
                by: savedByName,
                reason: 'Redline finalized — all changes accepted',
              },
            ]
          : statusHistory,
      },
      updatedAt: new Date(),
    };

    if (finalize) {
      updateData.status = 'ACTIVE';
    }

    await prisma.contract.update({
      where: { id },
      data: updateData as any,
    });

    return createSuccessResponse(authCtx, {
      contractId: id,
      version,
      documentStatus: redlinePayload.documentStatus,
      savedAt: now,
      finalized: finalize,
      pendingChanges: changes.filter(
        (c: { status?: string }) => c.status === 'pending'
      ).length,
    });
  } catch (error) {
    console.error('[Redline POST] Error:', error);
    return createErrorResponse(authCtx, 'INTERNAL_ERROR', 'Failed to save redline data', 500);
  }
}
