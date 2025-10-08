/**
 * Contract Processing Trigger API
 * POST /api/contracts/:id/process - Start AI analysis for an uploaded contract
 */

import { NextRequest, NextResponse } from "next/server";
import { mockDatabase } from "@/lib/mock-database";
import {
  ensureProcessingJob,
  startProcessingJob,
} from "@/lib/contract-processing";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const contractId = params?.id;

  if (!contractId) {
    return NextResponse.json(
      { error: "Contract ID is required" },
      { status: 400 }
    );
  }

  try {
    const contract = await mockDatabase.getContract(contractId);

    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    ensureProcessingJob(contractId);
    const job = startProcessingJob(contractId);

    return NextResponse.json(
      {
        success: true,
        contractId,
        message:
          "Processing started - AI analysis is running in the background",
        status: job.status,
        jobId: job.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error starting processing:", error);
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}
