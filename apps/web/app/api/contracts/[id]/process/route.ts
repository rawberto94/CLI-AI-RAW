/**
 * Contract Processing Trigger API
 * POST /api/contracts/:id/process - Start AI analysis for an uploaded contract
 */

import { NextRequest } from "next/server";
import { contractService } from "@/lib/data-orchestration";
import { triggerArtifactGeneration, PROCESSING_PRIORITY } from "@/lib/artifact-trigger";
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  try {
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    // Get contract using real service
    const result = await contractService.getContract(contractId, tenantId);

    if (!result.success || !result.data) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const contract = result.data;

    // Queue for real BullMQ processing with HIGH priority (interactive reprocess)
    const queueResult = await triggerArtifactGeneration({
      contractId,
      tenantId,
      filePath: contract.storagePath || '',
      mimeType: contract.mimeType || 'application/pdf',
      useQueue: true,
      priority: PROCESSING_PRIORITY.HIGH,
      isReprocess: true,
      source: 'reprocess',
    });

    return createSuccessResponse(ctx, {
        success: true,
        contractId,
        message:
          "Processing started - AI analysis is running in the background",
        status: queueResult.status,
        jobId: queueResult.jobId || null,
      });
  } catch (error) {
    return handleApiError(ctx, error);
  }
})
