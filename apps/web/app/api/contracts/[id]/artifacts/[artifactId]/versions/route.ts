import { NextRequest } from 'next/server';
import { editableArtifactService } from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/versions
 * Get version history for an artifact
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  try {
    const artifact = await prisma.artifact.findFirst({
      where: { id: artifactId, contractId, tenantId: ctx.tenantId },
      select: { id: true }
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    const versions = await editableArtifactService.getArtifactVersionHistory(
      artifactId
    );

    return createSuccessResponse(ctx, {
      versions,
      total: versions.length,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
})
