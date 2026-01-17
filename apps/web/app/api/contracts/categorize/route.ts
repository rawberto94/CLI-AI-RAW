/**
 * Contract Categorization API
 * POST /api/contracts/categorize - Categorize contract(s) using tenant taxonomy
 * 
 * ✅ Single and bulk categorization
 * ✅ AI-powered with keyword fallback
 * ✅ Multi-tenant taxonomy isolation
 */

import { NextRequest, NextResponse } from "next/server";
import cors from "@/lib/security/cors";
import {
  categorizeContract,
  categorizeContracts,
  suggestCategories,
  CategorizationResult,
  BulkCategorizationResult,
} from "@/lib/categorization-service";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SingleCategorizationRequest {
  contractId: string;
  forceRecategorize?: boolean;
}

interface BulkCategorizationRequest {
  contractIds: string[];
  forceRecategorize?: boolean;
  batchSize?: number;
}

interface SuggestCategorizationRequest {
  text: string;
}

type CategorizationRequest =
  | SingleCategorizationRequest
  | BulkCategorizationRequest
  | SuggestCategorizationRequest;

// ============================================================================
// POST - Categorize contract(s)
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.headers.get("x-tenant-id");
    
    // Require tenant ID for data isolation
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Tenant ID is required" },
        { status: 400 }
      );
    }
    
    const body: CategorizationRequest = await request.json();

    // Determine request type
    if ("text" in body) {
      // Suggest categories for text (preview mode)
      const { text } = body as SuggestCategorizationRequest;

      if (!text || typeof text !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: "Text is required for category suggestions",
          },
          { status: 400 }
        );
      }

      const result = await suggestCategories(text, tenantId);

      return NextResponse.json({
        success: true,
        data: result,
      });
    } else if ("contractIds" in body) {
      // Bulk categorization
      const {
        contractIds,
        forceRecategorize = false,
        batchSize = 5,
      } = body as BulkCategorizationRequest;

      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "contractIds array is required",
          },
          { status: 400 }
        );
      }

      // Limit bulk size
      if (contractIds.length > 100) {
        return NextResponse.json(
          {
            success: false,
            error: "Maximum 100 contracts per bulk request",
          },
          { status: 400 }
        );
      }

      const result: BulkCategorizationResult = await categorizeContracts(
        contractIds,
        tenantId,
        { forceRecategorize, batchSize }
      );

      return NextResponse.json({
        success: result.success,
        data: result,
        message: `Categorized ${result.categorized}/${result.total} contracts`,
      });
    } else if ("contractId" in body) {
      // Single categorization
      const { contractId, forceRecategorize = false } =
        body as SingleCategorizationRequest;

      if (!contractId || typeof contractId !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: "contractId is required",
          },
          { status: 400 }
        );
      }

      const result: CategorizationResult = await categorizeContract({
        contractId,
        tenantId,
        forceRecategorize,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Categorization failed",
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: `Contract categorized as "${result.category}" with ${result.confidence}% confidence`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request. Provide contractId, contractIds array, or text for suggestions.",
        },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: "Categorization failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return cors.optionsResponse(request, "POST, OPTIONS");
}
