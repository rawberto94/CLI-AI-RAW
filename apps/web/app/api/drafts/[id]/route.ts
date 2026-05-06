/**
 * Contract Draft Detail API - Single draft operations
 * 
 * GET /api/drafts/[id] - Get a single draft
 * PATCH /api/drafts/[id] - Update a draft
 * DELETE /api/drafts/[id] - Delete a draft
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
import { logger } from '@/lib/logger';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Extract a reasonable title from draft HTML content.
 *
 * Strategy:
 *   1. First <h1> text, else <h2>, else first non-empty paragraph.
 *   2. Strip tags, collapse whitespace, truncate to 80 chars.
 *   3. Return null when nothing usable is found so the caller keeps the
 *      existing placeholder.
 */
function extractTitleFromHtml(html: string): string | null {
  if (!html || typeof html !== 'string') return null;

  const pick = (pattern: RegExp): string | null => {
    const match = html.match(pattern);
    if (!match) return null;
    const inner = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return inner.length > 0 ? inner : null;
  };

  const candidate =
    pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    pick(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
    pick(/<p[^>]*>([\s\S]*?)<\/p>/i);

  if (!candidate) return null;

  const trimmed = candidate.length > 80 ? candidate.slice(0, 77).trimEnd() + '…' : candidate;
  // Reject trivial strings like single punctuation or "Untitled"
  if (trimmed.length < 3) return null;
  if (/^untitled/i.test(trimmed)) return null;
  return trimmed;
}

// GET /api/drafts/[id] - Get a single draft
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const { id } = await (ctx as any).params as { id: string };

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
})

// PATCH /api/drafts/[id] - Update a draft
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { id } = await (ctx as any).params as { id: string };
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

    // Auto-title: when content is saved but no explicit title was provided
    // AND the existing title is a placeholder (empty, "Untitled ..."), extract
    // the first heading / meaningful line from the HTML content so the draft
    // has a useful label in lists. Users can rename at any time.
    if (title === undefined && content !== undefined && typeof content === 'string') {
      const currentTitle = typeof existing.title === 'string' ? existing.title.trim() : '';
      const isPlaceholder = !currentTitle || /^untitled/i.test(currentTitle);
      if (isPlaceholder) {
        const extracted = extractTitleFromHtml(content);
        if (extracted) {
          updateData.title = extracted;
        }
      }
    }
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
})

// DELETE /api/drafts/[id] - Delete a draft
export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const tenantId = ctx.tenantId;
    const rl = checkRateLimit(tenantId, ctx.userId, '/api/drafts/[id]', AI_RATE_LIMITS.standard);
    if (!rl.allowed) return rateLimitResponse(rl);

    const { id } = await (ctx as any).params as { id: string };

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
})
