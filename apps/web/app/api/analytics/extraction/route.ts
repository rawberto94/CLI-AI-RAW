/**
 * Extraction Analytics API
 * 
 * GET /api/analytics/extraction - Get extraction analytics
 * POST /api/analytics/extraction/feedback - Record feedback
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  getExtractionAnalytics,
  recordExtractionFeedback,
} from "@/lib/ai";
import { getApiTenantId } from "@/lib/tenant-server";

// ============================================================================
// GET - Get extraction analytics
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = await getApiTenantId(request);
    const { searchParams } = new URL(request.url);
    
    const scope = searchParams.get("scope") || "tenant"; // "tenant" or "global"
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const includeRecommendations = searchParams.get("recommendations") === "true";

    const analytics = getExtractionAnalytics();

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    if (scope === "global") {
      // Global analytics (admin only in production)
      const result = await analytics.getGlobalAnalytics(start, end);
      return NextResponse.json({
        success: true,
        scope: "global",
        analytics: result,
      });
    }

    // Tenant-specific analytics
    const result = await analytics.getTenantAnalytics(tenantId, start, end);
    
    let recommendations: string[] = [];
    if (includeRecommendations) {
      recommendations = await analytics.getRecommendations(tenantId);
    }

    return NextResponse.json({
      success: true,
      scope: "tenant",
      tenantId,
      analytics: result,
      recommendations: includeRecommendations ? recommendations : undefined,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Record feedback for calibration
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = await getApiTenantId(request);
    const body = await request.json();

    const {
      contractId,
      fieldKey,
      fieldType,
      extractedValue,
      correctedValue,
      action, // "approved" | "corrected" | "rejected"
      originalConfidence,
    } = body;

    if (!fieldKey || !fieldType || !action) {
      return NextResponse.json(
        { error: "fieldKey, fieldType, and action are required" },
        { status: 400 }
      );
    }

    const analytics = getExtractionAnalytics();

    // Record the appropriate event
    switch (action) {
      case "approved":
        await analytics.recordFieldAutoApplied(
          contractId,
          tenantId,
          fieldKey,
          fieldType,
          extractedValue,
          originalConfidence ?? 1
        );
        break;

      case "corrected":
        await analytics.recordFieldCorrected(
          contractId,
          tenantId,
          fieldKey,
          fieldType,
          extractedValue,
          correctedValue,
          originalConfidence
        );
        // Also record for confidence calibration
        await recordExtractionFeedback({
          contractId,
          tenantId,
          fieldName: fieldKey,
          fieldType,
          extractedValue,
          correctedValue,
          aiConfidence: originalConfidence ?? 0.5,
          wasCorrect: false,
          correctionType: 'modified',
          timestamp: new Date(),
        });
        break;

      case "rejected":
        await analytics.recordFieldRejected(
          contractId,
          tenantId,
          fieldKey,
          fieldType,
          extractedValue,
          originalConfidence
        );
        // Also record for confidence calibration
        await recordExtractionFeedback({
          contractId,
          tenantId,
          fieldName: fieldKey,
          fieldType,
          extractedValue,
          aiConfidence: originalConfidence ?? 0.5,
          wasCorrect: false,
          correctionType: 'rejected',
          timestamp: new Date(),
        });
        break;

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }

    console.log(`📊 Recorded feedback: ${action} for ${fieldKey} (${fieldType})`);

    return NextResponse.json({
      success: true,
      message: "Feedback recorded successfully",
      action,
      fieldKey,
    });
  } catch (error) {
    console.error("Feedback recording error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to record feedback",
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
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
    },
  });
}
