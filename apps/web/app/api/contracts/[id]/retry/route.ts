/**
 * Contract Processing Retry API
 * POST /api/contracts/:id/retry - Retry failed processing job and regenerate artifacts
 */

import { NextRequest, NextResponse } from "next/server";
import { contractService } from "@/lib/data-orchestration";
import {
  ensureProcessingJob,
  retryProcessingJob,
} from "@/lib/contract-processing";
import { triggerArtifactGeneration } from "@/lib/artifact-trigger";
import { prisma } from "@/lib/prisma";

// Using singleton prisma instance from @/lib/prisma

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
    
    // Get contract from database
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId: tenantId
      }
    });

    if (!contract) {
      return NextResponse.json(
        { error: "No contract found for this ID" },
        { status: 404 }
      );
    }

    // Trigger artifact generation
    await triggerArtifactGeneration({
      contractId: contract.id,
      tenantId: contract.tenantId,
      filePath: contract.storagePath,
      mimeType: contract.mimeType,
      useQueue: false
    });

    ensureProcessingJob(contractId);
    const job = retryProcessingJob(contractId);

    return NextResponse.json(
      {
        message: "AI analysis started - artifacts will be generated shortly",
        contractId,
        jobId: job.id,
        status: "PROCESSING",
        progress: job.progress,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error retrying contract processing:", error);
    return NextResponse.json(
      {
        error: "Failed to start AI analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
