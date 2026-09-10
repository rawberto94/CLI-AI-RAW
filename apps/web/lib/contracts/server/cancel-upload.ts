import { NextRequest } from 'next/server';
import { ContractStatus } from '@prisma/client';

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { checkContractWritePermission } from '@/lib/security/contract-acl';
import { safeDeleteContract } from '@/lib/services/contract-deletion.service';
import { applyContractChangeSideEffects } from '@/lib/contracts/server/contract-change-side-effects';

import type { ContractApiContext } from '@/lib/contracts/server/context';

const CANCELLABLE_STATUSES: ContractStatus[] = [
  ContractStatus.UPLOADED,
  ContractStatus.QUEUED,
  ContractStatus.PROCESSING,
  ContractStatus.PENDING,
  ContractStatus.DRAFT,
  ContractStatus.FAILED,
];

async function removeQueuedJobs(contractId: string): Promise<void> {
  try {
    const { getInitializedQueueService } = await import('@/lib/queue-init');
    const queueService = getInitializedQueueService();
    if (!queueService) return;

    const jobs: Array<[string, string]> = [
      ['contract-processing', `contract-${contractId}`],
      ['artifact-generation', `artifacts-${contractId}`],
      ['rag-indexing', `rag-index-${contractId}`],
      ['metadata-extraction', `metadata-${contractId}`],
      ['contract-categorization', `categorize-${contractId}`],
      ['policy-evaluation', `policy-${contractId}`],
      ['agent-orchestration', `agent-${contractId}-0`],
    ];

    await Promise.all(
      jobs.map(([queue, jobId]) =>
        queueService.removeJob(queue, jobId).catch(() => undefined),
      ),
    );
  } catch (error) {
    logger.warn('[CancelUpload] Queue job removal skipped', {
      contractId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function postCancelUpload(
  _request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  try {
    if (!contractId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
    }
    if (!context.tenantId) {
      return createErrorResponse(context, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId: context.tenantId },
      select: { id: true, status: true, isDeleted: true, fileName: true },
    });

    if (!contract || contract.isDeleted) {
      return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
    }

    const aclDecision = await checkContractWritePermission({
      contractId,
      tenantId: context.tenantId,
      userId: context.userId,
      userRole: context.userRole,
      required: 'EDIT',
    });
    if (!aclDecision.allowed) {
      return createErrorResponse(
        context,
        'FORBIDDEN',
        'You do not have permission to cancel this upload',
        403,
      );
    }

    if (!CANCELLABLE_STATUSES.includes(contract.status)) {
      return createErrorResponse(
        context,
        'CONFLICT',
        `Cannot cancel a contract in ${contract.status} status. Delete it from the contract page instead.`,
        409,
        { retryable: false },
      );
    }

    await removeQueuedJobs(contractId);

    const result = await safeDeleteContract(contractId, context.tenantId, {
      deleteFromStorage: true,
      userId: context.userId,
      reason: 'user_cancelled_upload',
    });

    if (!result.success) {
      return createErrorResponse(
        context,
        'INTERNAL_ERROR',
        result.error || 'Failed to cancel upload',
        500,
        { retryable: true },
      );
    }

    await applyContractChangeSideEffects({
      tenantId: context.tenantId,
      contractId,
      userId: context.userId,
      changedFields: ['deleted'],
      source: 'api:contracts/[id]/cancel-upload',
    }).catch(() => undefined);

    void publishRealtimeEvent({
      event: 'contract:deleted',
      data: { tenantId: context.tenantId, contractId, reason: 'user_cancelled_upload' },
      source: 'api:contracts/cancel-upload',
    });

    logger.info('[CancelUpload] Upload cancelled and contract removed', {
      contractId,
      fileName: contract.fileName,
      previousStatus: contract.status,
    });

    return createSuccessResponse(context, {
      cancelled: true,
      contractId,
      message: 'Upload cancelled. The contract was removed.',
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}
