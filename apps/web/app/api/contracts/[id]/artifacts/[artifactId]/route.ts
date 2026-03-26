import { NextRequest } from 'next/server';
import { getContractQueue } from '@repo/utils/queue/contract-queue';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

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

    // ── Feed user edit into the learning system (fire-and-forget) ──
    try {
      const { UserFeedbackLearner } = await import('@repo/workers/agents/user-feedback-learner');
      const learner = new UserFeedbackLearner();
      const tenantIdForFeedback = ctx.tenantId || 'unknown';
      // Don't await — run in the background so the API response is fast
      learner.processFeedback({
        feedbackType: 'artifact_edit' as any,
        artifactType: updatedArtifact.artifactType || 'unknown',
        originalData: updatedArtifact.previousContent ?? {},
        editedData: updates,
        timestamp: new Date(),
        userId,
        tenantId: tenantIdForFeedback,
        comment: reason || undefined,
      }).catch(() => {
        // Feedback processing failures are non-critical
      });
    } catch {
      // Import or instantiation failure — feedback learning is optional
    }

    // Direct learning record for dashboard metrics (reliable fallback)
    try {
      await prisma.learningRecord.create({
        data: {
          tenantId: ctx.tenantId || 'unknown',
          artifactType: updatedArtifact.artifactType || 'unknown',
          field: 'artifact_content',
          correctionType: 'artifact_edit',
          confidence: 1.0,
          aiExtracted: JSON.stringify(updatedArtifact.previousContent ?? {}).slice(0, 2000),
          userCorrected: JSON.stringify(updates).slice(0, 2000),
        },
      });
    } catch {
      // Non-critical — learning record insert can fail silently
    }

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
