/**
 * Contract Draft Detail API - Single draft operations
 * 
 * GET /api/drafts/[id] - Get a single draft
 * PATCH /api/drafts/[id] - Update a draft
 * DELETE /api/drafts/[id] - Delete a draft
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

export const dynamic = 'force-dynamic';

// GET /api/drafts/[id] - Get a single draft
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {

    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    const draft = await prisma.contractDraft.findFirst({
      where: { id, tenantId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
            clauses: true,
            structure: true,
          },
        },
        sourceContract: {
          select: {
            id: true,
            contractTitle: true,
            supplierName: true,
            clientName: true,
            totalValue: true,
            currency: true,
            startDate: true,
            endDate: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!draft) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    return createSuccessResponse(ctx, {
      success: true,
      data: { draft },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// PATCH /api/drafts/[id] - Update a draft
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = await getApiTenantId(request);
    const { id } = await params;
    const body = await request.json();

    // Check if draft exists and belongs to tenant
    const existing = await prisma.contractDraft.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    // Check if draft is locked by another user
    if (existing.isLocked && existing.lockedBy !== ctx.userId) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Draft is locked by another user', 423);
    }

    const {
      title,
      content,
      clauses,
      variables,
      structure,
      status,
      estimatedValue,
      currency,
      proposedStartDate,
      proposedEndDate,
      externalParties,
      currentStep,
      completionPercent,
      isLocked,
    } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (clauses !== undefined) updateData.clauses = clauses;
    if (variables !== undefined) updateData.variables = variables;
    if (structure !== undefined) updateData.structure = structure;
    if (status !== undefined) updateData.status = status;
    if (estimatedValue !== undefined) {
      updateData.estimatedValue = estimatedValue ? parseFloat(estimatedValue) : null;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (proposedStartDate !== undefined) {
      updateData.proposedStartDate = proposedStartDate ? new Date(proposedStartDate) : null;
    }
    if (proposedEndDate !== undefined) {
      updateData.proposedEndDate = proposedEndDate ? new Date(proposedEndDate) : null;
    }
    if (externalParties !== undefined) updateData.externalParties = externalParties;
    if (currentStep !== undefined) updateData.currentStep = currentStep;
    if (completionPercent !== undefined) updateData.completionPercent = completionPercent;
    
    // Handle locking
    if (isLocked !== undefined) {
      updateData.isLocked = isLocked;
      if (isLocked) {
        updateData.lockedBy = ctx.userId;
        updateData.lockedAt = new Date();
      } else {
        updateData.lockedBy = null;
        updateData.lockedAt = null;
      }
    }

    // Increment version on content changes
    if (content !== undefined || clauses !== undefined) {
      updateData.version = existing.version + 1;

      // Create a version snapshot
      try {
        await prisma.draftVersion.create({
          data: {
            draftId: id,
            tenantId,
            userId: ctx.userId,
            version: existing.version, // snapshot of the PREVIOUS version
            content: typeof existing.content === 'string' ? existing.content : JSON.stringify(existing.content || ''),
            label: body.versionLabel || 'Auto-save',
            changeSummary: body.changeSummary || null,
          },
        });
      } catch (_snapshotErr) {
        // Don't fail the update if snapshot creation fails (e.g., duplicate version)
        console.warn('Version snapshot creation skipped (may be duplicate):', _snapshotErr);
      }
    }

    const draft = await prisma.contractDraft.update({
      where: { id },
      data: updateData,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            category: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      data: { draft },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// DELETE /api/drafts/[id] - Delete a draft
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {

    const tenantId = await getApiTenantId(request);
    const { id } = await params;

    // Check if draft exists and belongs to tenant
    const existing = await prisma.contractDraft.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Draft not found', 404);
    }

    // Don't allow deleting finalized drafts
    if (existing.status === 'FINALIZED') {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Cannot delete finalized drafts', 400);
    }

    await prisma.contractDraft.delete({
      where: { id },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
