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

// ============================================================================
// POST - Queue bulk extraction
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    
    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }
    
    const body = await request.json();

    const { 
      contractIds, 
      priority = "normal",
      options = {} 
    } = body;

    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return NextResponse.json(
        { error: "contractIds is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    // Limit batch size
    const maxBatchSize = 100;
    if (contractIds.length > maxBatchSize) {
      return NextResponse.json(
        { 
          error: `Batch size exceeds maximum of ${maxBatchSize}. ` +
                 `Please split into smaller batches.` 
        },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
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
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to queue bulk extraction",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Get queue status
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    
    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    
    const contractId = searchParams.get("contractId");
    const jobId = searchParams.get("jobId");
    const includeStats = searchParams.get("stats") === "true";

    const queue = getExtractionQueue();

    // Get specific job
    if (jobId) {
      const job = queue.getJob(jobId);
      if (!job) {
        return NextResponse.json(
          { error: `Job ${jobId} not found` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
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
            // ExtractionResult is a single field, use it directly
            fieldId: job.result.fieldId,
            fieldName: job.result.fieldName,
            confidence: job.result.confidence,
            validationStatus: job.result.validationStatus,
          } : null,
        },
      });
    }

    // Get jobs for a contract
    if (contractId) {
      const jobs = queue.getJobsForContract(contractId);
      return NextResponse.json({
        success: true,
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

    return NextResponse.json(response);
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get queue status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Cancel pending jobs
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    const queue = getExtractionQueue();
    const cancelled = queue.cancelJob(jobId);

    if (!cancelled) {
      return NextResponse.json(
        { error: `Job ${jobId} cannot be cancelled (not found or not pending)` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId,
      message: "Job cancelled successfully",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to cancel job",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, "GET, POST, DELETE, OPTIONS");
}
