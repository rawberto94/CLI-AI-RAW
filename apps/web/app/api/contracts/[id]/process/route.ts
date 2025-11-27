/**
 * Contract Processing Trigger API
 * POST /api/contracts/:id/process - Start AI analysis for an uploaded contract
 */

import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/data-orchestration";
import { getServerTenantId } from "@/lib/tenant-server";
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
    const tenantId = await getServerTenantId();
    
    // Get contract using real service
    const result = await contractService.getContract(contractId, tenantId);

    if (!result.success || !result.data) {
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
