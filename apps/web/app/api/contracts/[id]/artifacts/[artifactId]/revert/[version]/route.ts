import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/revert/[version]
 * Revert artifact to a specific version
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId, version } = await (ctx as any).params as { id: string; artifactId: string; version: string };

  try {
    const body = await request.json();
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

    const versionNumber = parseInt(version);
    if (isNaN(versionNumber)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid version number', 400);
    }

    await editableArtifactService.revertToVersion(
      artifactId,
      versionNumber,
      effectiveUserId
    );

    return createSuccessResponse(ctx, {
      message: `Artifact reverted to version ${versionNumber}`,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})
