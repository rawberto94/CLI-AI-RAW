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
import { logger } from '@/lib/logger';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

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
        playbook: {
          select: {
            id: true,
            name: true,
            description: true,
            isDefault: true,
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

    return createSuccessResponse(ctx, { draft });
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
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

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

    // Only the draft creator or admin/owner/manager can edit
    const EDIT_ROLES = ['admin', 'owner', 'manager'];
    const isCreator = existing.createdBy === ctx.userId;
    const hasElevatedRole = ctx.userRole && EDIT_ROLES.includes(ctx.userRole);
    if (!isCreator && !hasElevatedRole) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'You do not have permission to edit this draft', 403);
    }

    const {
      title,
      content,
      clauses,
      variables,
      structure,
      playbookId,
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
    if (playbookId !== undefined) {
      if (playbookId === null || playbookId === '') {
        updateData.playbookId = null;
      } else {
        const playbook = await prisma.playbook.findFirst({
          where: {
            id: playbookId,
            tenantId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!playbook) {
          return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Selected policy pack was not found', 400);
        }

        updateData.playbookId = playbook.id;
      }
    }
    if (status !== undefined) {
      // Validate status transitions
      const VALID_STATUSES = ['DRAFT', 'IN_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FINALIZED'];
      if (!VALID_STATUSES.includes(status)) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', `Invalid status: ${status}`, 400);
      }
      // Prevent reverting from FINALIZED
      if (existing.status === 'FINALIZED' && status !== 'FINALIZED') {
        return createErrorResponse(ctx, 'CONFLICT', 'Cannot change status of a finalized draft', 409);
      }
      updateData.status = status;
    }
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

      // Create a version snapshot + update atomically to prevent race conditions
      const draft = await prisma.$transaction(async (tx) => {
        // Snapshot (throttled: at most one every 2 minutes)
        try {
          const lastSnapshot = await tx.draftVersion.findFirst({
            where: { draftId: id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });
          const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
          if (!lastSnapshot || lastSnapshot.createdAt < twoMinutesAgo) {
            await tx.draftVersion.create({
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
          }
        } catch (_snapshotErr) {
          // Don't fail the update if snapshot creation fails (e.g., duplicate version)
          logger.warn('Version snapshot creation skipped (may be duplicate):', _snapshotErr);
        }

        return tx.contractDraft.update({
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
            playbook: {
              select: {
                id: true,
                name: true,
                isDefault: true,
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
      });

      await auditLog({
        action: AuditAction.CONTRACT_UPDATED,
        resourceType: 'draft',
        resourceId: id,
        userId: ctx.userId,
        tenantId,
        metadata: { operation: 'update' },
      }).catch(err => logger.error('[Draft] Audit log failed:', err));

      return createSuccessResponse(ctx, { draft });
    }

    // Non-content update (status, metadata, locking, etc.)
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
        playbook: {
          select: {
            id: true,
            name: true,
            isDefault: true,
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

    await auditLog({
      action: AuditAction.CONTRACT_UPDATED,
      resourceType: 'draft',
      resourceId: id,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'update' },
    }).catch(err => logger.error('[Draft] Audit log failed:', err));

    return createSuccessResponse(ctx, { draft });
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
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

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

    // Only the draft creator or admin/owner/manager can delete
    const DELETE_ROLES = ['admin', 'owner', 'manager'];
    const isCreator = existing.createdBy === ctx.userId;
    const hasElevatedRole = ctx.userRole && DELETE_ROLES.includes(ctx.userRole);
    if (!isCreator && !hasElevatedRole) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'You do not have permission to delete this draft', 403);
    }

    await prisma.contractDraft.delete({
      where: { id },
    });

    await auditLog({
      action: AuditAction.CONTRACT_DELETED,
      resourceType: 'draft',
      resourceId: id,
      userId: ctx.userId,
      tenantId,
      metadata: { operation: 'delete', title: existing.title },
    }).catch(err => logger.error('[Draft] Audit log failed:', err));

    return createSuccessResponse(ctx, {
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
