/**
 * Contract Processing Status API
 * GET /api/contracts/:id/status - Get current processing status and progress
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ensureProcessingJob,
  getProcessingJob,
} from "@/lib/contract-processing";

export async function GET(
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

    const job = getProcessingJob(contractId) ?? ensureProcessingJob(contractId);

    const now = Date.now();
    const startedAtMs = job.startedAt?.getTime?.() ?? now;
    const completedAtMs = job.completedAt?.getTime?.();
    const duration = completedAtMs
      ? completedAtMs - startedAtMs
      : Math.max(0, now - startedAtMs);

    const estimatedTimeRemaining =
      job.status === "PROCESSING"
        ? Math.max(
            0,
            Math.round(((100 - job.progress) / Math.max(job.progress, 1)) * 300)
          )
        : 0;

    return NextResponse.json(
      {
        contractId: job.contractId,
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        currentStep: job.currentStep,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        duration,
        estimatedTimeRemaining,
        isProcessing: job.status === "PROCESSING",
        isCompleted: job.status === "COMPLETED",
        isFailed: job.status === "FAILED",
        canRetry: job.status === "FAILED" || job.status === "COMPLETED",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching contract status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch contract status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
