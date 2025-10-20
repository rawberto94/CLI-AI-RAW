/**
 * Contract Processing Retry API
 * POST /api/contracts/:id/retry - Retry failed processing job
 */

import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/data-orchestration";
import {
  ensureProcessingJob,
  retryProcessingJob,
} from "@/lib/contract-processing";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params?.id;

    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }

    const tenantId = "demo"; // TODO: Get from auth session
    
    // Get contract using real service
    const result = await contractService.getContract(contractId, tenantId);
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: "No contract found for this ID" },
        { status: 404 }
      );
    }

    ensureProcessingJob(contractId);
    const job = retryProcessingJob(contractId);

    return NextResponse.json(
      {
        message: "Processing retry initiated",
        contractId,
        jobId: job.id,
        status: job.status,
        progress: job.progress,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error retrying contract processing:", error);
    return NextResponse.json(
      {
        error: "Failed to retry contract processing",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
