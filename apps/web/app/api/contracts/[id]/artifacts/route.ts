/**
 * Contract Artifacts API
 * GET /api/contracts/[id]/artifacts - Get all artifacts for a contract
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ArtifactService with automatic caching
 * - Type-safe with consistent error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { artifactService } from "@/lib/data-orchestration";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();

  try {
    const { id: contractId } = await params;
    const tenantId = "demo"; // TODO: Get from auth session

    if (!contractId) {
      return NextResponse.json(
        { success: false, error: "Contract ID is required" },
        { status: 400 }
      );
    }

    // Use data-orchestration service (handles caching automatically)
    const result = await artifactService.getContractArtifacts(
      contractId,
      tenantId
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error.message,
          code: result.error.code,
        },
        { status: 500 }
      );
    }

    const responseTime = Date.now() - startTime;

    // Transform artifacts for UI compatibility
    const transformedArtifacts = result.data.map((artifact) => ({
      id: artifact.id,
      type: artifact.type,
      data: artifact.data,
      metadata: artifact.metadata,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
    }));

    return NextResponse.json(
      {
        success: true,
        data: transformedArtifacts,
        meta: {
          count: transformedArtifacts.length,
          contractId,
          responseTime: `${responseTime}ms`,
          cached: responseTime < 50,
          dataSource: "data-orchestration",
        },
      },
      {
        headers: {
          "X-Response-Time": `${responseTime}ms`,
          "X-Data-Source": "data-orchestration",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching artifacts:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch artifacts",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
