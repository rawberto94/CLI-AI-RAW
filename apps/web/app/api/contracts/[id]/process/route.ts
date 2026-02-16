/**
 * Contract Processing Trigger API
 * POST /api/contracts/:id/process - Start AI analysis for an uploaded contract
 */

import { NextRequest } from "next/server";
import { contractService } from "@/lib/data-orchestration";
import { getServerTenantId } from "@/lib/tenant-server";
import { triggerArtifactGeneration, PROCESSING_PRIORITY } from "@/lib/artifact-trigger";
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const params = await context.params;
  const contractId = params?.id;

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  try {
    const tenantId = await getServerTenantId();
    
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
}
