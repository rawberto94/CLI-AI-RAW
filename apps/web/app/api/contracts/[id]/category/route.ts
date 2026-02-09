/**
 * Contract Category API
 * 
 * Handles category assignment, AI categorization, and feedback tracking.
 * Supports the learning loop for improving categorization accuracy.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { contractService } from 'data-orchestration/services';
import { getServerTenantId } from "@/lib/tenant-server";
import { getServerSession } from "@/lib/auth";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

/**
 * GET /api/contracts/[id]/category
 * Get current category and suggested alternatives
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractCategoryId: true,
        categoryL1: true,
        categoryL2: true,
        contractType: true,
        metadata: true,
        classifiedAt: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get current category details
    let currentCategory = null;
    if (contract.contractCategoryId) {
      currentCategory = await prisma.taxonomyCategory.findUnique({
        where: { id: contract.contractCategoryId },
        include: {
          parent: {
            select: { id: true, name: true, color: true, icon: true },
          },
        },
      });
    }

    // Get pending/suggested categorization from metadata
    const meta = (contract.metadata as any) || {};
    const categorization = meta._categorization || meta._pendingCategorization;
    const alternatives = categorization?.taxonomy?.alternatives || 
                         categorization?.suggestedTaxonomy?.alternatives || [];

    // Get all L1 categories for manual selection
    const l1Categories = await prisma.taxonomyCategory.findMany({
      where: { tenantId, level: 0, isActive: true },
      select: { id: true, name: true, color: true, icon: true },
      orderBy: { sortOrder: "asc" },
    });

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        contractId,
        current: currentCategory ? {
          id: currentCategory.id,
          name: currentCategory.name,
          color: currentCategory.color,
          icon: currentCategory.icon,
          level: currentCategory.level,
          parent: currentCategory.parent,
          l1: contract.categoryL1,
          l2: contract.categoryL2,
        } : null,
        contractType: contract.contractType,
        classifiedAt: contract.classifiedAt,
        confidence: categorization?.overallConfidence || null,
        matchScore: categorization?.taxonomy?.categoryL2?.matchScore || 
                    categorization?.taxonomy?.categoryL1?.matchScore || null,
        alternatives,
        needsReview: !!meta._pendingCategorization?.needsReview,
        reviewReason: meta._pendingCategorization?.reviewReason || null,
        availableCategories: l1Categories,
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * PUT /api/contracts/[id]/category
 * Update contract category (manual or from suggestions)
 * Tracks feedback for learning loop
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();
    const body = await request.json();

    const { categoryId, feedbackType = "correction" } = body;
    // feedbackType: "confirmation" (AI was right), "correction" (user changed it), "rejection" (user removed it)

    if (!categoryId && feedbackType !== "rejection") {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'categoryId is required', 400);
    }

    // Get contract with current category
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        contractCategoryId: true,
        categoryL1: true,
        categoryL2: true,
        contractType: true,
        metadata: true,
        rawText: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Get the new category details
    let newCategory = null;
    let newL1Name: string | null = null;
    let newL2Name: string | null = null;

    if (categoryId) {
      newCategory = await prisma.taxonomyCategory.findUnique({
        where: { id: categoryId },
        include: {
          parent: { select: { id: true, name: true } },
        },
      });

      if (!newCategory) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Category not found', 404);
      }

      // Determine L1/L2 names
      if (newCategory.level === 0) {
        newL1Name = newCategory.name;
        newL2Name = null;
      } else if (newCategory.level === 1) {
        newL2Name = newCategory.name;
        newL1Name = newCategory.parent?.name || null;
      }
    }

    // Track the correction for learning loop
    const originalCategoryId = contract.contractCategoryId;
    const wasCorrect = originalCategoryId === categoryId;
    const meta = (contract.metadata as any) || {};
    const categorization = meta._categorization || meta._pendingCategorization;

    await prisma.extractionCorrection.create({
      data: {
        tenantId,
        contractId,
        fieldName: "category",
        originalValue: originalCategoryId || null,
        correctedValue: categoryId || null,
        confidence: categorization?.overallConfidence 
          ? categorization.overallConfidence / 100 
          : null,
        wasCorrect,
        source: "ai",
        feedbackType,
        contractType: contract.contractType,
        documentLength: contract.rawText?.length || null,
        modelUsed: categorization?.metadata?.model || "gpt-4o-mini",
        metadata: {
          originalL1: contract.categoryL1,
          originalL2: contract.categoryL2,
          newL1: newL1Name,
          newL2: newL2Name,
          matchScore: categorization?.taxonomy?.categoryL2?.matchScore || 
                      categorization?.taxonomy?.categoryL1?.matchScore || null,
          alternatives: categorization?.taxonomy?.alternatives?.slice(0, 3) || [],
        },
      },
    });

    // Update the contract with new category
    const existingMeta = (contract.metadata as Record<string, unknown>) || {};
    
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        contractCategoryId: categoryId,
        categoryL1: newL1Name,
        categoryL2: newL2Name,
        classifiedAt: new Date(),
        metadata: JSON.parse(JSON.stringify({
          ...existingMeta,
          _categorization: {
            ...meta._categorization,
            manualOverride: feedbackType !== "confirmation",
            overriddenAt: new Date().toISOString(),
            overriddenBy: (await getServerSession())?.user?.id || "system",
          },
          // Remove pending if it existed
          _pendingCategorization: undefined,
        })),
        updatedAt: new Date(),
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        categoryId,
        categoryL1: newL1Name,
        categoryL2: newL2Name,
        feedbackRecorded: true,
        wasCorrect,
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * POST /api/contracts/[id]/category
 * Trigger AI re-categorization
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();
    const body = await request.json().catch(() => ({}));
    const { force = false, useAISelection: _useAISelection = true } = body;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, status: true },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Queue categorization job
    const { queueCategorizationJob } = await import("@repo/workers/categorization-worker");
    
    const jobId = await queueCategorizationJob({
      contractId,
      tenantId,
      forceRecategorize: force,
      autoApply: true,
      autoApplyThreshold: 0.7,
      source: "manual",
    });

    return createSuccessResponse(ctx, {
      success: true,
      data: {
        jobId,
        message: "Categorization job queued",
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
