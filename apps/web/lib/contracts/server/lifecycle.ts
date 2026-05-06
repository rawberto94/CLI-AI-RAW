import { NextRequest } from 'next/server';
import { ContractStatus } from '@prisma/client';
import { z } from 'zod';

import { pushAgentNotification } from '@/lib/ai/agent-notifications';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import {
  getContractLifecycle as resolveContractLifecycle,
  requiresApprovalWorkflow,
} from '@/lib/contract-helpers';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { queueRAGReindex } from '@/lib/rag/reindex-helper';

import type { ContractApiContext } from '@/lib/contracts/server/context';

const statusUpdateSchema = z.object({
  status: z.string().min(1, 'status is required'),
  reason: z.string().optional(),
  notes: z.string().optional(),
  effectiveDate: z.string().optional(),
  notifyCounterparty: z.boolean().optional(),
  notifyStakeholders: z.boolean().optional(),
  workflowExecutionId: z.string().optional(),
});

const PROCESSING_STAGES = {
  upload: { order: 1, name: 'Upload', estimatedMs: 5000 },
  queued: { order: 2, name: 'Queued', estimatedMs: 2000 },
  ocr: { order: 3, name: 'OCR Processing', estimatedMs: 30000 },
  artifacts: { order: 4, name: 'AI Analysis', estimatedMs: 45000 },
  storage: { order: 5, name: 'Saving Results', estimatedMs: 5000 },
  complete: { order: 6, name: 'Complete', estimatedMs: 0 },
} as const;

type ProcessingStage = keyof typeof PROCESSING_STAGES;

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  DRAFT: new Set(['PENDING', 'ACTIVE', 'PROCESSING', 'CANCELLED']),
  PENDING: new Set(['ACTIVE', 'DRAFT', 'CANCELLED', 'PROCESSING']),
  QUEUED: new Set(['PROCESSING', 'FAILED', 'CANCELLED', 'DRAFT']),
  PROCESSING: new Set(['COMPLETED', 'FAILED', 'PENDING']),
  COMPLETED: new Set(['ACTIVE', 'ARCHIVED', 'DRAFT', 'PENDING']),
  ACTIVE: new Set(['EXPIRED', 'ARCHIVED', 'CANCELLED', 'DRAFT', 'PENDING']),
  EXPIRED: new Set(['ACTIVE', 'ARCHIVED']),
  FAILED: new Set(['PROCESSING', 'DRAFT']),
  ARCHIVED: new Set(['ACTIVE', 'DRAFT']),
  CANCELLED: new Set(['DRAFT']),
  UPLOADED: new Set(['QUEUED', 'PROCESSING', 'DRAFT', 'PENDING', 'ACTIVE']),
  DELETED: new Set([]),
};

const VALID_STATUSES = new Set<string>(Object.values(ContractStatus));
const VALID_DOCUMENT_ROLES = ['NEW_CONTRACT', 'EXISTING', 'AMENDMENT', 'RENEWAL', null] as const;

function calculateEstimatedTimeRemaining(
  currentStage: ProcessingStage,
  artifactsGenerated: number,
  totalArtifacts: number,
): number {
  const stageInfo = PROCESSING_STAGES[currentStage];
  let remainingMs = 0;

  for (const [, info] of Object.entries(PROCESSING_STAGES)) {
    if (info.order > stageInfo.order) {
      remainingMs += info.estimatedMs;
    }
  }

  if (currentStage === 'artifacts' && totalArtifacts > 0) {
    const artifactProgress = artifactsGenerated / totalArtifacts;
    const artifactTimeRemaining = PROCESSING_STAGES.artifacts.estimatedMs * (1 - artifactProgress);
    remainingMs += artifactTimeRemaining;
  } else if (currentStage !== 'complete') {
    remainingMs += stageInfo.estimatedMs * 0.5;
  }

  return Math.round(remainingMs);
}

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

export async function getContractLifecycleState(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: {
      id: true,
      status: true,
      documentRole: true,
      metadata: true,
      effectiveDate: true,
      expirationDate: true,
      totalValue: true,
    },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  return createSuccessResponse(context, {
    success: true,
    contract: {
      id: contract.id,
      status: contract.status.toLowerCase(),
      documentRole: contract.documentRole,
      lifecycle: resolveContractLifecycle(contract),
      requiresApproval: requiresApprovalWorkflow(contract),
      metadata: contract.metadata,
    },
  });
}

export async function postContractLifecycle(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const { contractService } = await import('data-orchestration/services');
  const tenantId = context.tenantId;
  const body = await request.json();
  const { documentRole, isNewContract, metadata } = body;

  if (documentRole && !VALID_DOCUMENT_ROLES.includes(documentRole)) {
    return createErrorResponse(
      context,
      'BAD_REQUEST',
      `Invalid documentRole. Must be one of: ${VALID_DOCUMENT_ROLES.filter((role) => role).join(', ')}`,
      400,
    );
  }

  const contractResult = await contractService.getContract(contractId, tenantId);
  if (!contractResult.success || !contractResult.data) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const contract = contractResult.data as typeof contractResult.data & {
    metadata?: Record<string, unknown>;
    status: string;
  };

  const updateData: Record<string, unknown> = {};
  if (documentRole !== undefined) {
    updateData.documentRole = documentRole;
  }

  if (isNewContract === true || documentRole === 'NEW_CONTRACT') {
    updateData.status = 'DRAFT';
    updateData.documentRole = 'NEW_CONTRACT';
    updateData.metadata = {
      ...(contract.metadata as object),
      isNewContract: true,
      markedAsNewAt: new Date().toISOString(),
    };
  }

  if (isNewContract === false || documentRole === 'EXISTING') {
    updateData.documentRole = 'EXISTING';
    updateData.metadata = {
      ...(contract.metadata as object),
      isNewContract: false,
      markedAsExistingAt: new Date().toISOString(),
    };
    if (contract.status === 'DRAFT') {
      updateData.status = 'ACTIVE';
    }
  }

  if (metadata) {
    updateData.metadata = {
      ...(updateData.metadata || (contract.metadata as object)),
      ...metadata,
    };
  }

  const updateResult = await contractService.updateContract(contractId, tenantId, updateData);
  if (!updateResult.success || !updateResult.data) {
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Failed to update contract', 500);
  }

  const updatedContract = updateResult.data as typeof updateResult.data & {
    status: string;
    documentRole?: string | null;
  };

  const lifecycle = resolveContractLifecycle(updatedContract);
  const needsApproval = requiresApprovalWorkflow(updatedContract);

  try {
    await queueRAGReindex({
      contractId,
      tenantId,
      reason: 'lifecycle/status updated',
    });
  } catch {
    // Non-critical background work.
  }

  return createSuccessResponse(context, {
    success: true,
    contract: {
      id: updatedContract.id,
      status: updatedContract.status,
      documentRole: updatedContract.documentRole,
      lifecycle,
      requiresApproval: needsApproval,
    },
    message: needsApproval
      ? 'Contract marked as new - approval workflow can now be initiated'
      : 'Contract marked as existing - no approval workflow required',
  });
}

export async function getContractStatus(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
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
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  if (contract.status === 'PROCESSING') {
    const processingJob = contract.processingJobs[0] || null;
    const isJobActivelyRunning = processingJob?.status === 'RUNNING' && processingJob.startedAt &&
      (Date.now() - new Date(processingJob.startedAt).getTime()) < 3 * 60 * 1000;

    const lastTouch = contract.updatedAt || contract.createdAt;
    const staleSinceMs = Date.now() - new Date(lastTouch).getTime();
    const hasNoArtifacts = contract.artifacts.length === 0;
    const isStale = (hasNoArtifacts && staleSinceMs > 90_000) || staleSinceMs > 10 * 60 * 1000;

    if (isStale && !isJobActivelyRunning) {
      const newStatus = hasNoArtifacts ? 'FAILED' : 'COMPLETED';
      try {
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: newStatus, updatedAt: new Date() },
        });
        (contract as any).status = newStatus;
      } catch {
        // Non-fatal.
      }
    }
  }

  const processingJob = contract.processingJobs[0] || null;
  const artifactTypes = contract.artifacts.map((artifact) => artifact.type.toLowerCase());
  const hasOverview = artifactTypes.includes('overview');
  const hasFinancial = artifactTypes.includes('financial');
  const hasRisk = artifactTypes.includes('risk');
  const hasCompliance = artifactTypes.includes('compliance');
  const hasClauses = artifactTypes.includes('clauses');
  const artifactsGenerated = contract.artifacts.length;
  const totalArtifacts = Math.max(artifactsGenerated, 5);

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

  const now = new Date();
  const createdAt = new Date(contract.createdAt);
  const elapsedMs = now.getTime() - createdAt.getTime();
  const estimatedTimeRemainingMs = currentStep !== 'complete'
    ? calculateEstimatedTimeRemaining(currentStep, artifactsGenerated, totalArtifacts)
    : 0;

  let processingDurationMs = 0;
  if (processingJob?.completedAt && processingJob?.startedAt) {
    processingDurationMs = new Date(processingJob.completedAt).getTime()
      - new Date(processingJob.startedAt).getTime();
  } else if (processingJob?.startedAt) {
    processingDurationMs = now.getTime() - new Date(processingJob.startedAt).getTime();
  }

  const artifactTiming = contract.artifacts.map((artifact) => ({
    type: artifact.type,
    confidence: artifact.confidence,
    createdAt: artifact.createdAt,
    elapsedFromStart: artifact.createdAt
      ? new Date(artifact.createdAt).getTime() - createdAt.getTime()
      : null,
  }));

  return createSuccessResponse(context, {
    contractId: contract.id,
    status: contract.status.toLowerCase(),
    fileName: contract.fileName,
    fileSize: Number(contract.fileSize),
    mimeType: contract.mimeType,
    currentStep,
    currentStepName: PROCESSING_STAGES[currentStep].name,
    progress: Math.round(progress),
    stageProgress: Math.round(stageProgress),
    timing: {
      elapsedMs,
      elapsedFormatted: formatDuration(elapsedMs),
      estimatedRemainingMs: estimatedTimeRemainingMs,
      estimatedRemainingFormatted: formatDuration(estimatedTimeRemainingMs),
      processingDurationMs,
      processingDurationFormatted: formatDuration(processingDurationMs),
    },
    artifactsGenerated,
    totalArtifacts,
    artifactTypes,
    hasOverview,
    hasFinancial,
    hasRisk,
    hasCompliance,
    hasClauses,
    artifactTiming,
    processingJob: processingJob ? {
      id: processingJob.id,
      status: processingJob.status,
      queueId: processingJob.queueId,
      priority: processingJob.priority,
      retryCount: processingJob.retryCount,
      maxRetries: processingJob.maxRetries,
      error: processingJob.error,
    } : null,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
    error: contract.status === 'FAILED'
      ? (processingJob?.error || 'Processing failed')
      : null,
  });
}

export async function patchContractStatus(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const isTenantAdmin = context.userRole === 'admin' || context.userRole === 'owner';
  if (!isTenantAdmin) {
    return createErrorResponse(context, 'FORBIDDEN', 'Forbidden - Admin access required', 403);
  }

  const body = statusUpdateSchema.parse(await request.json());
  const { status: newStatus, reason, workflowExecutionId } = body;
  const normalizedStatus = newStatus.toUpperCase();

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: { id: true, status: true, metadata: true, contractTitle: true, fileName: true },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const currentStatus = (contract.status || 'DRAFT').toUpperCase();
  const allowedTargets = VALID_TRANSITIONS[currentStatus];

  if (!VALID_STATUSES.has(normalizedStatus)) {
    return createErrorResponse(
      context,
      'INVALID_STATUS',
      `Unsupported contract status: ${normalizedStatus}`,
      422,
    );
  }

  if (!allowedTargets || !allowedTargets.has(normalizedStatus)) {
    return createErrorResponse(
      context,
      'INVALID_TRANSITION',
      `Cannot transition from ${currentStatus} to ${normalizedStatus}. Allowed: ${allowedTargets ? [...allowedTargets].join(', ') : 'none'}`,
      422,
    );
  }

  const meta = (contract.metadata || {}) as Record<string, unknown>;
  const statusHistory = (meta.statusHistory as Array<Record<string, unknown>>) || [];
  statusHistory.push({
    from: currentStatus,
    to: normalizedStatus,
    at: new Date().toISOString(),
    by: context.tenantId,
    reason: reason || undefined,
    workflowExecutionId: workflowExecutionId || undefined,
  });

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: normalizedStatus as ContractStatus,
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

  if (workflowExecutionId) {
    try {
      await prisma.workflowExecution.update({
        where: { id: workflowExecutionId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    } catch {
      // Non-critical.
    }
  }

  if (normalizedStatus === 'TERMINATED') {
    const { notes, effectiveDate, notifyCounterparty, notifyStakeholders } = body;

    try {
      await prisma.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'CONTRACT_TERMINATED',
          resourceType: 'Contract',
          entityType: 'Contract',
          entityId: contractId,
          resource: contractId,
          details: { description: `Contract "${contract.contractTitle || contract.fileName}" terminated. Reason: ${reason || 'Not specified'}` },
          metadata: {
            reason,
            notes,
            effectiveDate,
            notifyCounterparty,
            notifyStakeholders,
            previousStatus: currentStatus,
          },
        },
      });
    } catch (auditErr) {
      logger.error('Failed to create termination audit log', auditErr instanceof Error ? auditErr : undefined);
    }

    pushAgentNotification({
      tenantId: context.tenantId,
      type: 'risk_alert',
      severity: 'high',
      title: 'Contract Terminated',
      message: `"${contract.contractTitle || contract.fileName}" has been terminated. Reason: ${reason || 'Not specified'}`,
      source: 'termination-workflow',
      metadata: { contractId, reason, effectiveDate },
      actionUrl: `/contracts/${contractId}`,
    });

    if (notifyStakeholders) {
      pushAgentNotification({
        tenantId: context.tenantId,
        type: 'compliance_issue',
        severity: 'medium',
        title: 'Stakeholder Notification Required',
        message: `Internal stakeholders should be notified about the termination of "${contract.contractTitle || contract.fileName}"`,
        source: 'termination-workflow',
        metadata: { contractId, action: 'notify_stakeholders' },
        actionUrl: `/contracts/${contractId}`,
      });
    }

    if (notifyCounterparty) {
      pushAgentNotification({
        tenantId: context.tenantId,
        type: 'deadline',
        severity: 'high',
        title: 'Counterparty Notice Required',
        message: `Send termination notice to counterparty for "${contract.contractTitle || contract.fileName}"`,
        source: 'termination-workflow',
        metadata: { contractId, action: 'notify_counterparty' },
        actionUrl: `/contracts/${contractId}`,
      });
    }

    logger.info('Contract terminated with notifications', {
      contractId,
      reason,
      notifyCounterparty,
      notifyStakeholders,
    });
  }

  return createSuccessResponse(context, {
    contractId: updated.id,
    previousStatus: currentStatus,
    newStatus: normalizedStatus,
    contractTitle: updated.contractTitle || updated.fileName,
    updatedAt: updated.updatedAt.toISOString(),
  });
}