/**
 * Contract Status API
 * GET /api/contracts/[id]/status
 * 
 * Returns real-time status of contract processing for the ArtifactGenerationTracker component.
 * Polls this endpoint to track upload → OCR → artifact generation progress.
 * 
 * Enhanced with:
 * - Stage-by-stage timing information
 * - Estimated completion time
 * - Processing job details
 * - Queue position information
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

const statusUpdateSchema = z.object({
  status: z.string().min(1, 'status is required'),
  reason: z.string().optional(),
  workflowExecutionId: z.string().optional(),
});

// Tenant isolation helper
function getTenantId(request: NextRequest): string | null {
  return request.headers.get('x-tenant-id');
}

// Processing stage definitions with estimated durations
const PROCESSING_STAGES = {
  upload: { order: 1, name: 'Upload', estimatedMs: 5000 },
  queued: { order: 2, name: 'Queued', estimatedMs: 2000 },
  ocr: { order: 3, name: 'OCR Processing', estimatedMs: 30000 },
  artifacts: { order: 4, name: 'AI Analysis', estimatedMs: 45000 },
  storage: { order: 5, name: 'Saving Results', estimatedMs: 5000 },
  complete: { order: 6, name: 'Complete', estimatedMs: 0 },
} as const;

type ProcessingStage = keyof typeof PROCESSING_STAGES;

function calculateEstimatedTimeRemaining(
  currentStage: ProcessingStage,
  artifactsGenerated: number,
  totalArtifacts: number
): number {
  const stageInfo = PROCESSING_STAGES[currentStage];
  let remainingMs = 0;
  
  // Add time for remaining stages
  for (const [_stage, info] of Object.entries(PROCESSING_STAGES)) {
    if (info.order > stageInfo.order) {
      remainingMs += info.estimatedMs;
    }
  }
  
  // For artifacts stage, adjust based on progress
  if (currentStage === 'artifacts' && totalArtifacts > 0) {
    const artifactProgress = artifactsGenerated / totalArtifacts;
    const artifactTimeRemaining = PROCESSING_STAGES.artifacts.estimatedMs * (1 - artifactProgress);
    remainingMs += artifactTimeRemaining;
  } else if (currentStage !== 'complete') {
    // Add current stage time if not complete
    remainingMs += stageInfo.estimatedMs * 0.5; // Assume halfway through current stage
  }
  
  return Math.round(remainingMs);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = getTenantId(request);

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    // Fetch contract with artifacts and processing job - scoped to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        artifacts: {
          select: {
            type: true,
            confidence: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        processingJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            progress: true,
            currentStep: true,
            queueId: true,
            priority: true,
            startedAt: true,
            completedAt: true,
            error: true,
            retryCount: true,
            maxRetries: true,
            createdAt: true,
          },
        },
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // ── Auto-resolve stale PROCESSING contracts ──
    // Stale criteria:
    //  1. No artifacts generated AND idle for >90 seconds (worker never started), OR
    //  2. Processing for >10 minutes regardless (hard ceiling — worker crashed or stuck)
    // BUT: never auto-resolve if the processingJob is actively RUNNING (heartbeat within 3 min)
    if (contract.status === 'PROCESSING') {
      const processingJob = contract.processingJobs[0] || null;
      const isJobActivelyRunning = processingJob?.status === 'RUNNING' && processingJob.startedAt &&
        (Date.now() - new Date(processingJob.startedAt).getTime()) < 3 * 60 * 1000;

      const lastTouch = contract.updatedAt || contract.createdAt;
      const staleSinceMs = Date.now() - new Date(lastTouch).getTime();
      const hasNoArtifacts = contract.artifacts.length === 0;
      const isStale = (hasNoArtifacts && staleSinceMs > 90_000) || staleSinceMs > 10 * 60 * 1000;
      if (isStale && !isJobActivelyRunning) {
        // Only mark COMPLETED if artifacts were generated; otherwise mark FAILED
        const newStatus = hasNoArtifacts ? 'FAILED' : 'COMPLETED';
        try {
          await prisma.contract.update({
            where: { id: contract.id },
            data: { status: newStatus, updatedAt: new Date() },
          });
          (contract as any).status = newStatus;
        } catch {
          // Non-fatal — will retry on next poll
        }
      }
    }

    const processingJob = contract.processingJobs[0] || null;

    // Count artifacts by type
    const artifactTypes = contract.artifacts.map(a => a.type.toLowerCase());
    const hasOverview = artifactTypes.includes('overview');
    const hasFinancial = artifactTypes.includes('financial');
    const hasRisk = artifactTypes.includes('risk');
    const hasCompliance = artifactTypes.includes('compliance');
    const hasClauses = artifactTypes.includes('clauses');

    const artifactsGenerated = contract.artifacts.length;
    // Estimate total based on actual artifact count (worker generates variable amounts)
    const totalArtifacts = Math.max(artifactsGenerated, 5);

    // Determine current processing step with more detail
    let currentStep: ProcessingStage = 'upload';
    let progress = 0;
    let stageProgress = 0;

    if (contract.status === 'PENDING') {
      currentStep = 'queued';
      progress = 10;
      stageProgress = 25;
    } else if (contract.status === 'UPLOADED') {
      currentStep = 'queued';
      progress = 15;
      stageProgress = 50;
    } else if (contract.status === 'QUEUED') {
      currentStep = 'queued';
      progress = 20;
      stageProgress = 100;
    } else if (contract.status === 'PROCESSING') {
      if (processingJob?.currentStep === 'ocr' || artifactsGenerated === 0) {
        currentStep = 'ocr';
        progress = 35;
        stageProgress = processingJob?.progress || 50;
      } else {
        currentStep = 'artifacts';
        // Progress from 50% to 90% based on artifacts generated
        stageProgress = (artifactsGenerated / totalArtifacts) * 100;
        progress = 50 + (artifactsGenerated / totalArtifacts) * 40;
      }
    } else if (contract.status === 'COMPLETED') {
      currentStep = 'complete';
      progress = 100;
      stageProgress = 100;
    } else if (contract.status === 'FAILED') {
      progress = processingJob?.progress || 0;
      stageProgress = 0;
    }

    // Calculate timing information
    const now = new Date();
    const createdAt = new Date(contract.createdAt);
    const elapsedMs = now.getTime() - createdAt.getTime();
    const estimatedTimeRemainingMs = currentStep !== 'complete' 
      ? calculateEstimatedTimeRemaining(currentStep, artifactsGenerated, totalArtifacts)
      : 0;

    // Calculate processing duration if completed
    let processingDurationMs = 0;
    if (processingJob?.completedAt && processingJob?.startedAt) {
      processingDurationMs = new Date(processingJob.completedAt).getTime() 
        - new Date(processingJob.startedAt).getTime();
    } else if (processingJob?.startedAt) {
      processingDurationMs = now.getTime() - new Date(processingJob.startedAt).getTime();
    }

    // Get artifact timing breakdown
    const artifactTiming = contract.artifacts.map(a => ({
      type: a.type,
      confidence: a.confidence,
      createdAt: a.createdAt,
      elapsedFromStart: a.createdAt 
        ? new Date(a.createdAt).getTime() - createdAt.getTime()
        : null,
    }));

    return createSuccessResponse(ctx, {
      // Basic info
      contractId: contract.id,
      status: contract.status.toLowerCase(),
      fileName: contract.fileName,
      fileSize: Number(contract.fileSize),
      mimeType: contract.mimeType,
      
      // Progress info
      currentStep,
      currentStepName: PROCESSING_STAGES[currentStep].name,
      progress: Math.round(progress),
      stageProgress: Math.round(stageProgress),
      
      // Timing info
      timing: {
        elapsedMs,
        elapsedFormatted: formatDuration(elapsedMs),
        estimatedRemainingMs: estimatedTimeRemainingMs,
        estimatedRemainingFormatted: formatDuration(estimatedTimeRemainingMs),
        processingDurationMs,
        processingDurationFormatted: formatDuration(processingDurationMs),
      },
      
      // Artifact info
      artifactsGenerated,
      totalArtifacts,
      artifactTypes,
      hasOverview,
      hasFinancial,
      hasRisk,
      hasCompliance,
      hasClauses,
      artifactTiming,
      
      // Processing job info
      processingJob: processingJob ? {
        id: processingJob.id,
        status: processingJob.status,
        queueId: processingJob.queueId,
        priority: processingJob.priority,
        retryCount: processingJob.retryCount,
        maxRetries: processingJob.maxRetries,
        error: processingJob.error,
      } : null,
      
      // Metadata
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      error: contract.status === 'FAILED' 
        ? (processingJob?.error || 'Processing failed')
        : null,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * Format milliseconds to human-readable duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// ============================================================================
// PATCH — Transition contract to a new status
// ============================================================================

// Valid transitions: fromStatus → Set<validTargetStatuses>
const VALID_TRANSITIONS: Record<string, Set<string>> = {
  DRAFT:      new Set(['PENDING', 'ACTIVE', 'PROCESSING', 'CANCELLED']),
  PENDING:    new Set(['ACTIVE', 'DRAFT', 'CANCELLED', 'PROCESSING']),
  QUEUED:     new Set(['PROCESSING', 'FAILED', 'CANCELLED', 'DRAFT']),
  PROCESSING: new Set(['COMPLETED', 'FAILED', 'PENDING']),
  COMPLETED:  new Set(['ACTIVE', 'ARCHIVED', 'DRAFT', 'PENDING']),
  ACTIVE:     new Set(['EXPIRED', 'ARCHIVED', 'CANCELLED', 'DRAFT', 'PENDING']),
  EXPIRED:    new Set(['ACTIVE', 'ARCHIVED']),
  FAILED:     new Set(['PROCESSING', 'DRAFT']),
  ARCHIVED:   new Set(['ACTIVE', 'DRAFT']),
  CANCELLED:  new Set(['DRAFT']),
  UPLOADED:   new Set(['QUEUED', 'PROCESSING', 'DRAFT', 'PENDING', 'ACTIVE']),
  DELETED:    new Set([]),
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = getTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const { id: contractId } = await params;
    const { status: newStatus, reason, workflowExecutionId } = statusUpdateSchema.parse(await request.json());

    const normalizedStatus = newStatus.toUpperCase();

    // Fetch current contract
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, status: true, metadata: true, contractTitle: true, fileName: true },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const currentStatus = (contract.status || 'DRAFT').toUpperCase();
    const allowedTargets = VALID_TRANSITIONS[currentStatus];

    if (!allowedTargets || !allowedTargets.has(normalizedStatus)) {
      return createErrorResponse(
        ctx,
        'INVALID_TRANSITION',
        `Cannot transition from ${currentStatus} to ${normalizedStatus}. Allowed: ${allowedTargets ? [...allowedTargets].join(', ') : 'none'}`,
        422
      );
    }

    // Build status history entry
    const meta = (contract.metadata || {}) as Record<string, unknown>;
    const statusHistory = (meta.statusHistory as Array<Record<string, unknown>>) || [];
    statusHistory.push({
      from: currentStatus,
      to: normalizedStatus,
      at: new Date().toISOString(),
      by: tenantId,
      reason: reason || undefined,
      workflowExecutionId: workflowExecutionId || undefined,
    });

    // Update contract status + metadata
    const updated = await prisma.contract.update({
      where: { id: contractId },
      data: {
        status: normalizedStatus,
        metadata: {
          ...meta,
          statusHistory,
          lastStatusChange: new Date().toISOString(),
        } as any,
      },
      select: {
        id: true,
        status: true,
        contractTitle: true,
        fileName: true,
        updatedAt: true,
      },
    });

    // If tied to a workflow execution, update it
    if (workflowExecutionId) {
      try {
        await prisma.workflowExecution.update({
          where: { id: workflowExecutionId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      } catch {
        // Non-critical
      }
    }

    return createSuccessResponse(ctx, {
      contractId: updated.id,
      previousStatus: currentStatus,
      newStatus: normalizedStatus,
      contractTitle: updated.contractTitle || updated.fileName,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
