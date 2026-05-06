import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/rates
 * Add a new rate card entry
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  try {
    const body = await request.json();
    const { rate } = body;
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

    if (!rate) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'rate data is required', 400);
    }

    const rateId = await editableArtifactService.addRateCardEntry(
      artifactId,
      rate,
      effectiveUserId
    );

    return createSuccessResponse(ctx, {
      message: 'Rate card entry added successfully',
      rateId,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})
