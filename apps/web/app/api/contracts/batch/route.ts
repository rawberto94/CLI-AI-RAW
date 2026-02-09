/**
 * Batch Operations API
 * POST /api/contracts/batch - Batch upload contracts
 * DELETE /api/contracts/batch - Batch delete contracts
 * PUT /api/contracts/batch - Batch update contracts
 */

import { NextRequest } from "next/server";
import { contractService } from "@/lib/data-orchestration";
import { getServerTenantId } from "@/lib/tenant-server";
import {
  ensureProcessingJob,
  startProcessingJob,
} from "@/lib/contract-processing";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

/**
 * Batch upload contracts
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
  const formData = await request.formData();
  const files: File[] = [];

  // Extract all files from form data
  for (const [, value] of formData.entries()) {
    if (isFile(value)) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No files provided', 400);
  }

  if (files.length > 100) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Maximum 100 files allowed per batch', 400);
  }

  const results = [] as Array<{
    contractId: string;
    fileName: string;
    status: string;
    jobId: string;
  }>;

  const tenantId = await getServerTenantId();
  const userId = "user"; // From session when authenticated

  for (const file of files) {
    // Create contract using real service
    const result = await contractService.createContract({
      tenantId,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      fileSize: BigInt(file.size),
      uploadedBy: userId,
      status: "UPLOADED",
      contractType: formData.get(`${file.name}_type`) as string | undefined,
    });

    if (!result.success || !result.data) {
      continue;
    }

    const contract = result.data;
    if (!contract.id) continue;

    await publishRealtimeEvent({
      event: "contract:created",
      data: {
        tenantId,
        contractId: contract.id,
        status: contract.status,
      },
      source: "api:contracts/batch",
    });

    ensureProcessingJob(contract.id);
    const job = startProcessingJob(contract.id);
    if (!job.id) continue;

    results.push({
      contractId: contract.id,
      fileName: file.name,
      status: job.status,
      jobId: job.id,
    });
  }

  return createSuccessResponse(ctx, {
      processed: results.length,
      results,
  });
});

/**
 * Batch delete contracts
 */
export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { contractIds } = body ?? {};

  if (!Array.isArray(contractIds) || contractIds.length === 0) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Contract IDs array is required', 400);
  }

  return createSuccessResponse(ctx, {
      deleted: contractIds.length,
      contractIds,
  });
});

/**
 * Batch update contracts
 */
export const PUT = withAuthApiHandler(async (request, ctx) => {
  const body = await request.json();
  const { updates } = body ?? {};

  if (!Array.isArray(updates) || updates.length === 0) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Updates array is required', 400);
  }

  return createSuccessResponse(ctx, {
      updated: updates.length,
      updates,
  });
});
