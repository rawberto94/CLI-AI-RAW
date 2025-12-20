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

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
  for (const [stage, info] of Object.entries(PROCESSING_STAGES)) {
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
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = getTenantId(request);

    if (!contractId) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
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
    const totalArtifacts = 5;

    // Determine current processing step with more detail
    let currentStep: ProcessingStage = 'upload';
    let progress = 0;
    let stageProgress = 0;

    if (contract.status === 'UPLOADED') {
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

    return NextResponse.json({
      // Basic info
      contractId: contract.id,
      status: contract.status,
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
  } catch (error) {
    console.error('Error fetching contract status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch contract status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
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
