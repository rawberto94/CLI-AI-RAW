/**
 * AI-Powered Contract Categorization API
 * POST /api/contracts/[id]/categorize - Trigger AI categorization for a contract
 * 
 * Uses AI-extracted metadata (supplier, service description, deliverables, etc.)
 * to intelligently categorize contracts into the tenant's taxonomy.
 */

import { NextRequest } from "next/server";
import { categorizeContract } from "@/lib/categorization-service";
import { prisma } from "@/lib/prisma";
import { withContractApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * Validate that a taxonomy category belongs to the tenant
 * Prevents cross-tenant category assignment attacks
 */
async function _validateCategoryOwnership(
  categoryId: string,
  tenantId: string
): Promise<boolean> {
  const category = await prisma.taxonomyCategory.findFirst({
    where: { id: categoryId, tenantId },
  });
  return !!category;
}

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    // Get optional body parameters
    const body = await request.json().catch(() => ({}));
    const { forceRecategorize = true } = body;

    // Check contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractTitle: true,
        category: true,
        supplierName: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Run AI categorization
    const result = await categorizeContract({
      contractId,
      tenantId,
      forceRecategorize,
    });

    if (result.success) {
      return createSuccessResponse(ctx, {
        success: true,
        contractId,
        previousCategory: contract.category,
        newCategory: result.category,
        categoryPath: result.categoryPath,
        confidence: result.confidence,
        method: result.method,
        reasoning: result.reasoning,
        alternativeCategories: result.alternativeCategories,
        message: `Contract categorized as "${result.category}" with ${result.confidence}% confidence`,
      });
    } else {
      return createErrorResponse(ctx, 'BAD_REQUEST', result.error ?? 'Categorization failed', 400);
    }
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})

// GET - Get current category and suggestions
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractTitle: true,
        category: true,
        categoryL1: true,
        categoryL2: true,
        supplierName: true,
        contractType: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get available categories
    const categories = await prisma.taxonomyCategory.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        path: true,
        level: true,
        description: true,
      },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
    });

    return createSuccessResponse(ctx, {
      success: true,
      contractId,
      currentCategory: contract.category,
      categoryL1: contract.categoryL1,
      categoryL2: contract.categoryL2,
      contractInfo: {
        title: contract.contractTitle,
        supplier: contract.supplierName,
        type: contract.contractType,
      },
      availableCategories: categories,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
})
