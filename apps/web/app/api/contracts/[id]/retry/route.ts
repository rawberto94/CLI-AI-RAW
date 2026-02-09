/**
 * Contract Processing Retry API
 * POST /api/contracts/:id/retry - Retry failed processing job and regenerate artifacts
 */

import { NextRequest } from "next/server";
import { getServerTenantId } from "@/lib/tenant-server";
import { triggerArtifactGeneration } from "@/lib/artifact-trigger";
import { prisma } from "@/lib/prisma";
import { contractService } from 'data-orchestration/services';
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const params = await context.params;
    const contractId = params?.id;

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    const tenantId = await getServerTenantId();
    
    // Get contract from database via service layer
    const contractResult = await contractService.getContract(contractId, tenantId!);

    if (!contractResult.success || !contractResult.data) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'No contract found for this ID', 404);
    }

    const contract = contractResult.data;

    // Reset contract status to PROCESSING via service layer
    await contractService.updateContract(contractId, tenantId!, { status: 'PROCESSING' as any });

    void publishRealtimeEvent({
      event: 'processing:started',
      data: { tenantId: contract.tenantId, contractId },
      source: 'api:contracts/retry',
    });

    // Reset or create processing job
    const existingJob = await prisma.processingJob.findFirst({
      where: { contractId }
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
          retryCount: { increment: 1 }
        }
      });
    } else {
      await prisma.processingJob.create({
        data: {
          contractId,
          tenantId: contract.tenantId,
          status: 'PENDING',
          progress: 0,
          currentStep: 'queued'
        }
      });
    }

    // Delete any existing artifacts to regenerate them
    await prisma.artifact.deleteMany({
      where: { contractId }
    });

    // Trigger artifact generation via queue
    const queueResult = await triggerArtifactGeneration({
      contractId: contract.id,
      tenantId: contract.tenantId,
      filePath: contract.storagePath ?? '',
      mimeType: contract.mimeType,
      useQueue: true,
      isReprocess: true,
      source: 'reprocess'
    });

    return createSuccessResponse(ctx, {
        message: "AI analysis started - artifacts will be generated shortly",
        contractId,
        jobId: queueResult.jobId || `retry-${Date.now()}`,
        status: "PROCESSING",
        progress: 5,
      });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
