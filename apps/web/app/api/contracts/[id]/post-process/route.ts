/**
 * Contract Post-Processing API
 * POST /api/contracts/[id]/post-process - Trigger post-processing hooks
 * 
 * Called after artifact generation to:
 * - Auto-extract metadata using AI
 * - Auto-categorize contract
 * - Calculate health score
 * - Trigger notifications
 */

import { NextRequest, NextResponse } from "next/server";
import { runPostProcessingHooks } from "@/lib/post-processing-hooks";
import { AutoPopulateService, type AutoPopulateConfig } from "@/lib/services/auto-populate.service";
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from "@/lib/tenant-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Available post-processing hooks
type HookType = 
  | "metadata-extraction"  // AI-powered metadata extraction
  | "categorization"       // Auto-categorize contract type
  | "health-score"         // Calculate contract health
  | "notifications";       // Send relevant notifications

interface PostProcessRequest {
  hooks?: HookType[];
  metadataOptions?: {
    autoApplyThreshold?: number;      // Auto-approve above this (default 0.85)
    skipBelowThreshold?: number;      // Skip below this (default 0.4)
    forceReExtract?: boolean;         // Re-extract even if metadata exists
    onlyEmptyFields?: boolean;        // Only fill empty fields
  };
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
    const tenantId = await getApiTenantId(request);

    console.log(`🔧 Post-processing request for contract: ${contractId}`);

    // Get options from body
    const body: PostProcessRequest = await request.json().catch(() => ({}));
    const { 
      hooks = ["metadata-extraction", "categorization"], 
      metadataOptions = {} 
    } = body;

    // Run selected hooks in order
    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // 1. Metadata Extraction (should run first)
    if (hooks.includes("metadata-extraction")) {
      try {
        console.log(`📊 Running metadata extraction for ${contractId}...`);
        
        const config: Partial<AutoPopulateConfig> = {
          autoApproveThreshold: metadataOptions.autoApplyThreshold ?? 0.85,
          requireReviewThreshold: metadataOptions.skipBelowThreshold ?? 0.6,
          overwriteExisting: !(metadataOptions.onlyEmptyFields ?? true),
        };
        
        // Get contract text for extraction
        const contract = await prisma.contract.findUnique({
          where: { id: contractId },
          select: { rawText: true },
        });
        
        const autoPopulateService = new AutoPopulateService(config);
        const extractionResult = await autoPopulateService.processContract(
          contractId,
          tenantId,
          contract?.rawText || ''
        );
        
        results.metadataExtraction = {
          success: true,
          ...extractionResult,
        };
        
        console.log(`✅ Metadata extraction complete: ${extractionResult.appliedFields.length} auto-applied, ${extractionResult.reviewRequiredFields.length} need review`);
      } catch (error) {
        console.error("Metadata extraction error:", error);
        errors.metadataExtraction = error instanceof Error ? error.message : "Unknown error";
        results.metadataExtraction = { success: false };
      }
    }

    // 2. Categorization
    if (hooks.includes("categorization")) {
      try {
        console.log(`📁 Running categorization for ${contractId}...`);
        const { runPostProcessingHooks } = await import("@/lib/post-processing-hooks");
        const hookResults = await runPostProcessingHooks(contractId, tenantId);
        const { success: _, ...categorizationData } = hookResults.categorization || {};
        results.categorization = {
          success: true,
          ...categorizationData,
        };
      } catch (error) {
        console.error("Categorization error:", error);
        errors.categorization = error instanceof Error ? error.message : "Unknown error";
        results.categorization = { success: false };
      }
    }

    // 3. Health Score (placeholder for future implementation)
    if (hooks.includes("health-score")) {
      try {
        console.log(`💚 Calculating health score for ${contractId}...`);
        // TODO: Implement health score calculation
        results.healthScore = {
          success: true,
          score: null,
          message: "Health score calculation not yet implemented",
        };
      } catch (error) {
        console.error("Health score error:", error);
        errors.healthScore = error instanceof Error ? error.message : "Unknown error";
      }
    }

    // 4. Notifications (placeholder for future implementation)
    if (hooks.includes("notifications")) {
      try {
        console.log(`🔔 Processing notifications for ${contractId}...`);
        // TODO: Implement notification triggers
        results.notifications = {
          success: true,
          sent: [],
          message: "Notification system not yet implemented",
        };
      } catch (error) {
        console.error("Notifications error:", error);
        errors.notifications = error instanceof Error ? error.message : "Unknown error";
      }
    }

    const hasErrors = Object.keys(errors).length > 0;
    const allFailed = Object.values(results).every(r => !r.success);

    return NextResponse.json({
      success: !allFailed,
      contractId,
      hooks: hooks,
      results,
      errors: hasErrors ? errors : undefined,
      message: allFailed 
        ? "All post-processing hooks failed" 
        : hasErrors 
          ? "Post-processing completed with some errors"
          : "Post-processing completed successfully",
    }, { status: allFailed ? 500 : 200 });
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
