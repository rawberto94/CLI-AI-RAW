/**
 * Contract Post-Processing API
 * POST /api/contracts/[id]/post-process - Trigger post-processing hooks
 * 
 * Called after artifact generation to:
 * - Auto-categorize contract
 * - Calculate health score
 * - Trigger notifications
 */

import { NextRequest, NextResponse } from "next/server";
import { runPostProcessingHooks } from "@/lib/post-processing-hooks";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ============================================================================
// POST - Trigger post-processing
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: contractId } = await params;
    const tenantId = request.headers.get("x-tenant-id") || "demo";

    console.log(`🔧 Post-processing request for contract: ${contractId}`);

    // Get options from body
    const body = await request.json().catch(() => ({}));
    const { hooks = ["categorization"] } = body;

    // Run selected hooks
    const results: Record<string, any> = {};

    if (hooks.includes("categorization")) {
      const { runPostProcessingHooks } = await import("@/lib/post-processing-hooks");
      const hookResults = await runPostProcessingHooks(contractId, tenantId);
      results.categorization = hookResults.categorization;
    }

    return NextResponse.json({
      success: true,
      contractId,
      results,
      message: "Post-processing completed",
    });
  } catch (error) {
    console.error("Post-processing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Post-processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
    },
  });
}
