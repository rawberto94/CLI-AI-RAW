/**
 * Contract Processing Retry API
 * POST /api/contracts/:id/retry - Retry failed processing job and regenerate artifacts
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerTenantId } from "@/lib/tenant-server";
import { triggerArtifactGeneration } from "@/lib/artifact-trigger";
import { prisma } from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/publish";

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

    const tenantId = await getServerTenantId();
    
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

    // Reset contract status to PROCESSING
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'PROCESSING' }
    });

    void publishRealtimeEvent({
      event: 'processing:started',
      data: { tenantId: contract.tenantId, contractId },
      source: 'api:contracts/retry',
    });

    // Reset or create processing job
    const existingJob = await prisma.processingJob.findFirst({
      where: { contractId }
    });

    if (existingJob) {
      await prisma.processingJob.update({
        where: { id: existingJob.id },
        data: {
          status: 'PENDING',
          progress: 0,
          currentStep: 'queued',
          error: null,
          errorStack: null,
          retryCount: { increment: 1 }
        }
      });
    } else {
      await prisma.processingJob.create({
        data: {
          contractId,
          tenantId: contract.tenantId,
          status: 'PENDING',
          progress: 0,
          currentStep: 'queued'
        }
      });
    }

    // Delete any existing artifacts to regenerate them
    await prisma.artifact.deleteMany({
      where: { contractId }
    });

    // Trigger artifact generation via queue
    const queueResult = await triggerArtifactGeneration({
      contractId: contract.id,
      tenantId: contract.tenantId,
      filePath: contract.storagePath ?? '',
      mimeType: contract.mimeType,
      useQueue: true,
      isReprocess: true,
      source: 'reprocess'
    });

    return NextResponse.json(
      {
        message: "AI analysis started - artifacts will be generated shortly",
        contractId,
        jobId: queueResult.jobId || `retry-${Date.now()}`,
        status: "PROCESSING",
        progress: 5,
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
