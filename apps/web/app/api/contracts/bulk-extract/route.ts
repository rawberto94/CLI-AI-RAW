/**
 * Bulk Metadata Extraction API
 * 
 * POST /api/contracts/bulk-extract - Queue multiple contracts for extraction
 * GET /api/contracts/bulk-extract - Get queue status and stats
 */

import { NextRequest, NextResponse } from "next/server";
import cors from "@/lib/security/cors";
import { 
  queueBulkMetadataExtraction, 
  getExtractionQueue,
  type BatchExtractionResult,
} from "@/lib/ai";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// ============================================================================
// POST - Queue bulk extraction
// ============================================================================

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  
  // Require tenant ID for data isolation
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }
  
  const body = await request.json();

  const { 
    contractIds, 
    priority = "normal",
    options = {} 
  } = body;

  if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractIds is required and must be a non-empty array', 400);
  }

  // Limit batch size
  const maxBatchSize = 100;
  if (contractIds.length > maxBatchSize) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', `Batch size exceeds maximum of ${maxBatchSize}. Please split into smaller batches.`, 400);
  }

  // Queue the batch
  const result: BatchExtractionResult = await queueBulkMetadataExtraction(
    contractIds,
    tenantId,
    {
      ...options,
      priority: priority as "high" | "normal" | "low",
    }
  );

  return createSuccessResponse(ctx, {
    batchId: result.batchId,
    totalContracts: result.totalContracts,
    estimatedTimeMs: result.estimatedTime,
    jobs: result.jobs.map(job => ({
      id: job.id,
      contractId: job.contractId,
      status: job.status,
      priority: job.priority,
    })),
    message: `Queued ${result.totalContracts} contracts for extraction`,
  });
});

// ============================================================================
// GET - Get queue status
// ============================================================================

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  
  // Require tenant ID for data isolation
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }
  
  const { searchParams } = new URL(request.url);
  
  const contractId = searchParams.get("contractId");
  const jobId = searchParams.get("jobId");
  const _includeStats = searchParams.get("stats") === "true";

  const queue = getExtractionQueue();

  // Get specific job
  if (jobId) {
    const job = queue.getJob(jobId);
    if (!job) {
      return createErrorResponse(ctx, 'NOT_FOUND', `Job ${jobId} not found`, 404);
    }

    return createSuccessResponse(ctx, {
      job: {
        id: job.id,
        contractId: job.contractId,
        status: job.status,
        priority: job.priority,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        retryCount: job.retryCount,
        error: job.error,
        result: job.result ? {
          // ExtractionResult uses metadata from extraction
          fieldId: (job.result as unknown as Record<string, unknown>).fieldId ?? job.id,
          fieldName: (job.result as unknown as Record<string, unknown>).fieldName ?? 'extracted',
          confidence: (job.result as unknown as Record<string, unknown>).confidence ?? 0,
          validationStatus: (job.result as unknown as Record<string, unknown>).validationStatus ?? 'pending',
        } : null,
      },
    });
  }

  // Get jobs for a contract
  if (contractId) {
    const jobs = queue.getJobsForContract(contractId);
    return createSuccessResponse(ctx, {
      contractId,
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        priority: job.priority,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      })),
    });
  }

  // Get overall queue stats
  const stats = queue.getStats();

  interface BulkExtractResponse {
    success: boolean;
    stats: {
      pending: number;
      running: number;
      completed: number;
      failed: number;
      successRate: number;
      averageProcessingTimeMs: number;
    };
  }

  const response: BulkExtractResponse = {
    success: true,
    stats: {
      pending: stats.pending,
      running: stats.running,
      completed: stats.completed,
      failed: stats.failed,
      successRate: Math.round(stats.successRate * 100),
      averageProcessingTimeMs: Math.round(stats.averageProcessingTime),
    },
  };

  return createSuccessResponse(ctx, response.stats);
});

// ============================================================================
// DELETE - Cancel pending jobs
// ============================================================================

export const DELETE = withAuthApiHandler(async (request, ctx) => {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'jobId is required', 400);
  }

  const queue = getExtractionQueue();
  const cancelled = queue.cancelJob(jobId);

  if (!cancelled) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', `Job ${jobId} cannot be cancelled (not found or not pending)`, 400);
  }

  return createSuccessResponse(ctx, {
    jobId,
    message: "Job cancelled successfully",
  });
});

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const ctx = getApiContext(request);
  return cors.optionsResponse(request, "GET, POST, DELETE, OPTIONS");
}
