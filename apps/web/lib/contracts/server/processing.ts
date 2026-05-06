import { NextRequest } from 'next/server';

import { triggerArtifactGeneration } from '@/lib/artifact-trigger';
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { publishRealtimeEvent } from '@/lib/realtime/publish';
import { contractService } from 'data-orchestration/services';

import type { ContractApiContext } from '@/lib/contracts/server/context';

export async function postContractProcessingRetry(
  _request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  try {
    if (!contractId) {
      return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    const tenantId = context.tenantId;
    const contractResult = await contractService.getContract(contractId, tenantId);

    if (!contractResult.success || !contractResult.data) {
      return createErrorResponse(context, 'NOT_FOUND', 'No contract found for this ID', 404);
    }

    const contract = contractResult.data;

    await contractService.updateContract(contractId, tenantId, { status: 'PROCESSING' as any });

    void publishRealtimeEvent({
      event: 'processing:started',
      data: { tenantId: contract.tenantId, contractId },
      source: 'api:contracts/retry',
    });

    const existingJob = await prisma.processingJob.findFirst({
      where: { contractId },
    });

    if (existingJob) {
      await prisma.processingJob.update({
        where: { id: existingJob.id },
        data: {
          status: 'PENDING',
          progress: 0,
          currentStep: 'queued',
          error: null,
          errorStack: null,
          retryCount: { increment: 1 },
        },
      });
    } else {
      await prisma.processingJob.create({
        data: {
          contractId,
          tenantId: contract.tenantId,
          status: 'PENDING',
          progress: 0,
          currentStep: 'queued',
        },
      });
    }

    await prisma.artifact.deleteMany({
      where: { contractId },
    });

    const queueResult = await triggerArtifactGeneration({
      contractId: contract.id,
      tenantId: contract.tenantId,
      filePath: contract.storagePath ?? '',
      mimeType: contract.mimeType,
      useQueue: true,
      isReprocess: true,
      source: 'reprocess',
    });

    return createSuccessResponse(context, {
      message: 'AI analysis started - artifacts will be generated shortly',
      contractId,
      jobId: queueResult.jobId || `retry-${Date.now()}`,
      status: 'PROCESSING',
      progress: 5,
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}