/**
 * Redline Persistence API
 *
 * POST /api/contracts/[id]/redline — Save tracked changes + comments
 * GET  /api/contracts/[id]/redline — Load last-saved redline session
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withContractApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { evaluateContractPreApprovalGates, formatUnmetPreApprovalGates } from '@/lib/governance/pre-approval-gates';
import { logger } from '@/lib/logger';

const redlineSaveSchema = z.object({
  content: z.string({ required_error: 'content (string) is required' }),
  changes: z.array(z.record(z.unknown())).default([]),
  comments: z.array(z.record(z.unknown())).default([]),
  documentStatus: z.string().default('draft'),
  finalize: z.boolean().default(false),
});

/* ------------------------------------------------------------------ */
/*  GET — load saved redline state                                     */
/* ------------------------------------------------------------------ */

export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;

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
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Redline state stored in metadata.redline
    const meta = (contract.metadata as Record<string, unknown>) || {};
    const redline = (meta.redline as Record<string, unknown>) || null;

    // Content priority: saved redline > DOCX HTML (preserves formatting) > plain rawText
    const docxHtml = meta.docxHtml as string | undefined;
    const fallbackContent = docxHtml || contract.rawText || '';

    return createSuccessResponse(ctx, {
      contractId: contract.id,
      contractTitle: contract.contractTitle,
      status: contract.status.toLowerCase(),
      content: redline?.content ?? fallbackContent,
      changes: redline?.changes ?? [],
      comments: redline?.comments ?? [],
      documentStatus: redline?.documentStatus ?? 'draft',
      savedAt: redline?.savedAt ?? null,
      savedBy: redline?.savedBy ?? null,
      version: redline?.version ?? 0,
    });
  } catch (error) {
    logger.error('[Redline GET] Error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to load redline data', 500);
  }
})

/* ------------------------------------------------------------------ */
/*  POST — save redline state                                          */
/* ------------------------------------------------------------------ */

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;

    const {
      content,
      changes,
      comments,
      documentStatus,
      finalize,
    } = redlineSaveSchema.parse(await request.json());

    // Verify ownership
    const contract = await prisma.contract.findFirst({
      where: { id, tenantId, isDeleted: false },
      select: {
        id: true,
        metadata: true,
        status: true,
        contractType: true,
        totalValue: true,
        currency: true,
        contractTitle: true,
        fileName: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    if (finalize) {
      const workflowExecution = await prisma.workflowExecution.findFirst({
        where: { contractId: id, tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          workflow: {
            include: {
              steps: {
                orderBy: { order: 'asc' },
              },
            },
          },
          stepExecutions: {
            include: {
              step: {
                select: {
                  name: true,
                  isRequired: true,
                },
              },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
      });

      const governance = await evaluateContractPreApprovalGates(
        {
          tenantId,
          contractType: contract.contractType,
          totalValue: contract.totalValue,
          currency: contract.currency,
        },
        workflowExecution?.workflow?.steps || []
      );

      if (governance.applicableGates.length > 0) {
        if (!workflowExecution?.workflow) {
          return createErrorResponse(
            ctx,
            'CONFLICT',
            'This contract requires a completed pre-approval workflow before finalization.',
            409,
            { field: 'finalize', retryable: false }
          );
        }

        if (governance.unmetGates.length > 0) {
          return createErrorResponse(
            ctx,
            'CONFLICT',
            `Workflow is missing required pre-approval gates: ${formatUnmetPreApprovalGates(governance.unmetGates)}`,
            409,
            { field: 'finalize', retryable: false }
          );
        }

        const pendingRequiredSteps = workflowExecution.stepExecutions.filter(
          (stepExecution) =>
            stepExecution.step.isRequired !== false &&
            !['COMPLETED', 'SKIPPED'].includes(stepExecution.status)
        );

        if (workflowExecution.status !== 'COMPLETED' || pendingRequiredSteps.length > 0) {
          const pendingStepLabel = pendingRequiredSteps
            .map((stepExecution) => stepExecution.step.name || stepExecution.stepName)
            .filter(Boolean)
            .slice(0, 3)
            .join(', ');

          return createErrorResponse(
            ctx,
            'CONFLICT',
            pendingStepLabel
              ? `Pre-approval workflow is not complete. Pending steps: ${pendingStepLabel}`
              : 'Pre-approval workflow is not complete.',
            409,
            { field: 'finalize', retryable: false }
          );
        }
      }
    }

    const now = new Date().toISOString();
    const existingMeta = (contract.metadata as Record<string, unknown>) || {};
    const existingRedline = (existingMeta.redline as Record<string, unknown>) || {};
    const version = ((existingRedline.version as number) || 0) + 1;

    // Look up user details for savedBy field
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
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

    return createSuccessResponse(ctx, {
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
    logger.error('[Redline POST] Error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to save redline data', 500);
  }
})
