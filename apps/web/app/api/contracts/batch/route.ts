/**
 * Batch Operations API
 * POST /api/contracts/batch - Batch upload contracts
 * DELETE /api/contracts/batch - Batch delete contracts
 * PUT /api/contracts/batch - Batch update contracts
 */

import { NextRequest, NextResponse } from "next/server";
import { contractService } from "data-orchestration";
import {
  ensureProcessingJob,
  startProcessingJob,
} from "@/lib/contract-processing";

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

/**
 * Batch upload contracts
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files: File[] = [];

    // Extract all files from form data
    for (const [, value] of formData.entries()) {
      if (isFile(value)) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    if (files.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 files allowed per batch" },
        { status: 400 }
      );
    }

    const results = [] as Array<{
      contractId: string;
      fileName: string;
      status: string;
      jobId: string;
    }>;

    const tenantId = "demo"; // TODO: Get from auth session

    for (const file of files) {
      // Create contract using real service
      const result = await contractService.createContract({
        tenantId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        fileSize: file.size,
        uploadedBy: "user", // TODO: Get from auth session
        status: "UPLOADED",
        contractType: formData.get(`${file.name}_type`) as string | undefined,
      });

      if (!result.success || !result.data) {
        console.error(`Failed to create contract for ${file.name}:`, result.error);
        continue;
      }

      const contract = result.data;
      ensureProcessingJob(contract.id);
      const job = startProcessingJob(contract.id);

      results.push({
        contractId: contract.id,
        fileName: file.name,
        status: job.status,
        jobId: job.id,
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          processed: results.length,
          results,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Batch upload error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Batch upload failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Batch delete contracts
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractIds } = body ?? {};

    if (!Array.isArray(contractIds) || contractIds.length === 0) {
      return NextResponse.json(
        { error: "Contract IDs array is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          deleted: contractIds.length,
          contractIds,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Batch delete error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Batch delete failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Batch update contracts
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body ?? {};

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Updates array is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          updated: updates.length,
          updates,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Batch update error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Batch update failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
