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
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

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

export const POST = withContractApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  
  // Require tenant ID for data isolation
  if (!tenantId) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
  }
  
  const body: CategorizationRequest = await request.json();

  // Determine request type
  if ("text" in body) {
    // Suggest categories for text (preview mode)
    const { text } = body as SuggestCategorizationRequest;

    if (!text || typeof text !== "string") {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Text is required for category suggestions', 400);
    }

    const result = await suggestCategories(text, tenantId);

    return createSuccessResponse(ctx, result);
  } else if ("contractIds" in body) {
    // Bulk categorization
    const {
      contractIds,
      forceRecategorize = false,
      batchSize = 5,
    } = body as BulkCategorizationRequest;

    if (!Array.isArray(contractIds) || contractIds.length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractIds array is required', 400);
    }

    // Limit bulk size
    if (contractIds.length > 100) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Maximum 100 contracts per bulk request', 400);
    }

    const result: BulkCategorizationResult = await categorizeContracts(
      contractIds,
      tenantId,
      { forceRecategorize, batchSize }
    );

    return createSuccessResponse(ctx, result);
  } else if ("contractId" in body) {
    // Single categorization
    const { contractId, forceRecategorize = false } =
      body as SingleCategorizationRequest;

    if (!contractId || typeof contractId !== "string") {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'contractId is required', 400);
    }

    const result: CategorizationResult = await categorizeContract({
      contractId,
      tenantId,
      forceRecategorize,
    });

    if (!result.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', result.error || 'Categorization failed', 400);
    }

    return createSuccessResponse(ctx, result);
  } else {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid request. Provide contractId, contractIds array, or text for suggestions.', 400);
  }
});

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const ctx = getApiContext(request);
  return cors.optionsResponse(request, "POST, OPTIONS");
}
