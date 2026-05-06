import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * PUT /api/contracts/[id]/artifacts/[artifactId]/rates/[rateId]
 * Update a rate card entry
 */
export const PUT = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId, rateId } = await (ctx as any).params as { id: string; artifactId: string; rateId: string };

  try {
    const body = await request.json();
    const { updates } = body;
    const effectiveUserId = ctx.userId;

    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, contractId, tenantId: ctx.tenantId },
      select: { id: true }
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    if (!effectiveUserId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    if (!updates) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'updates are required', 400);
    }

    await editableArtifactService.updateRateCardEntry(
      artifactId,
      rateId,
      updates,
      effectiveUserId
    );

    return createSuccessResponse(ctx, {
      message: 'Rate card entry updated successfully',
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})

/**
 * DELETE /api/contracts/[id]/artifacts/[artifactId]/rates/[rateId]
 * Delete a rate card entry
 */
export const DELETE = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId, rateId } = await (ctx as any).params as { id: string; artifactId: string; rateId: string };

  try {
    const effectiveUserId = ctx.userId;

    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, contractId, tenantId: ctx.tenantId },
      select: { id: true }
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    if (!effectiveUserId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    await editableArtifactService.deleteRateCardEntry(
      artifactId,
      rateId,
      effectiveUserId
    );

    return createSuccessResponse(ctx, {
      message: 'Rate card entry deleted successfully',
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})
