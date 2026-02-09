/**
 * Contract Processing Trigger API
 * POST /api/contracts/:id/process - Start AI analysis for an uploaded contract
 */

import { NextRequest } from "next/server";
import { contractService } from "@/lib/data-orchestration";
import { getServerTenantId } from "@/lib/tenant-server";
import {
  ensureProcessingJob,
  startProcessingJob,
} from "@/lib/contract-processing";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
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

    ensureProcessingJob(contractId);
    const job = startProcessingJob(contractId);

    return createSuccessResponse(ctx, {
        success: true,
        contractId,
        message:
          "Processing started - AI analysis is running in the background",
        status: job.status,
        jobId: job.id,
      });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
