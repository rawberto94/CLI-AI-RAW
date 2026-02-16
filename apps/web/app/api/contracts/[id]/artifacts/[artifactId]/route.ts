import { NextRequest } from 'next/server';
import { getContractQueue } from '@repo/utils/queue/contract-queue';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

// Artifact types that should trigger RAG re-indexing when updated
const RAG_TRIGGER_ARTIFACT_TYPES = [
  'OVERVIEW',
  'CLAUSES', 
  'RATES',
  'FINANCIAL',
  'RISK',
] as const;

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]
 * Get a specific artifact
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { dbAdaptor } = await import('data-orchestration');
    
    const artifact = await dbAdaptor.getClient().artifact.findUnique({
      where: { id: params.artifactId },
      include: {
        editHistory: {
          orderBy: { version: 'desc' },
          take: 10,
        },
      },
    });

    if (!artifact) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Artifact not found', 404);
    }

    if (artifact.contractId !== params.id) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'Artifact does not belong to this contract', 403);
    }

    return createSuccessResponse(ctx, artifact);
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * PUT /api/contracts/[id]/artifacts/[artifactId]
 * Update an artifact
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const body = await request.json();
    const { updates, reason, userId } = body;

    if (!userId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'userId is required', 400);
    }

    if (!updates) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'updates are required', 400);
    }

    // Update the artifact using the service
    const { editableArtifactService } = await import('data-orchestration/services');
    const updatedArtifact = await editableArtifactService.updateArtifact(
      params.artifactId,
      updates,
      userId,
      reason
    );

    // Queue RAG re-indexing if this is a critical artifact type
    let ragReindexQueued = false;
    const tenantId = ctx.tenantId;
    
    if (tenantId && RAG_TRIGGER_ARTIFACT_TYPES.includes(updatedArtifact.artifactType as typeof RAG_TRIGGER_ARTIFACT_TYPES[number])) {
      try {
        const contractQueue = getContractQueue();
        await contractQueue.queueRAGIndexing(
          {
            contractId: params.id,
            tenantId,
            artifactIds: [params.artifactId],
          },
          {
            priority: 15,
            delay: 2000, // 2 second delay
          }
        );
        ragReindexQueued = true;
      } catch {
        // RAG re-indexing failed silently
      }
    }

    return createSuccessResponse(ctx, {
      artifact: updatedArtifact,
      message: ragReindexQueued 
        ? 'Artifact updated successfully. AI search index will be updated shortly.'
        : 'Artifact updated successfully',
      ragReindexQueued,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * DELETE /api/contracts/[id]/artifacts/[artifactId]
 * Delete an artifact
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; artifactId: string }> }
) {
  const params = await props.params;
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { dbAdaptor } = await import('data-orchestration');
    
    await dbAdaptor.getClient().artifact.delete({
      where: { id: params.artifactId },
    });

    return createSuccessResponse(ctx, {
      message: 'Artifact deleted successfully',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
