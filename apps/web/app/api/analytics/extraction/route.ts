/**
 * Extraction Analytics API
 * 
 * GET /api/analytics/extraction - Get extraction analytics
 * POST /api/analytics/extraction/feedback - Record feedback
 */

import { NextRequest, NextResponse } from "next/server";
import cors from "@/lib/security/cors";
import { 
  getExtractionAnalytics,
  recordExtractionFeedback,
} from "@/lib/ai";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// ============================================================================
// GET - Get extraction analytics
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
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
    return createSuccessResponse(ctx, {
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

  return createSuccessResponse(ctx, {
    scope: "tenant",
    tenantId,
    analytics: result,
    recommendations: includeRecommendations ? recommendations : undefined,
  });
});

// ============================================================================
// POST - Record feedback for calibration
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
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
    return createErrorResponse(ctx, 'MISSING_FIELDS', 'fieldKey, fieldType, and action are required', 400);
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
      return createErrorResponse(ctx, 'INVALID_ACTION', `Invalid action: ${action}`, 400);
  }

  return createSuccessResponse(ctx, {
    message: "Feedback recorded successfully",
    action,
    fieldKey,
  });
});

// ============================================================================
// OPTIONS HANDLER FOR CORS (stays unwrapped)
// ============================================================================

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const ctx = getApiContext(request);
  return cors.optionsResponse(request, "GET, POST, OPTIONS");
}
