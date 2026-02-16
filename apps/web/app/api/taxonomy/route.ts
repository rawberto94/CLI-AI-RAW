/**
 * Taxonomy Management API
 * GET /api/taxonomy - List taxonomy categories for a tenant
 * POST /api/taxonomy - Create a new taxonomy category
 * 
 * ✅ Multi-tenant support with tenantId isolation
 * ✅ Hierarchical categories with parent-child relationships
 * ✅ Keywords for auto-classification
 */

import { NextRequest } from "next/server";
import cors from "@/lib/security/cors";
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { taxonomyService } from 'data-orchestration/services';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TaxonomyCategoryInput {
  name: string;
  description?: string;
  parentId?: string;
  keywords?: string[];
  aiClassificationPrompt?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

interface TaxonomyCategoryResponse {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  level: number;
  path: string;
  keywords: string[];
  aiClassificationPrompt?: string | null;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  contractCount?: number;
  children?: TaxonomyCategoryResponse[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Build hierarchical tree from flat list of categories
 */
function buildCategoryTree(
  categories: TaxonomyCategoryResponse[],
  parentId: string | null = null
): TaxonomyCategoryResponse[] {
  return categories
    .filter((cat) => cat.parentId === parentId)
    .map((cat) => ({
      ...cat,
      children: buildCategoryTree(categories, cat.id),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Calculate category path from parent
 */
async function calculateCategoryPath(
  tenantId: string,
  parentId: string | null,
  name: string
): Promise<{ path: string; level: number }> {
  if (!parentId) {
    return { path: `/${name}`, level: 0 };
  }

  const parent = await prisma.taxonomyCategory.findFirst({
    where: { id: parentId, tenantId },
    select: { path: true, level: true },
  });

  if (!parent) {
    return { path: `/${name}`, level: 0 };
  }

  return {
    path: `${parent.path}/${name}`,
    level: parent.level + 1,
  };
}

// ============================================================================
// GET - List taxonomy categories
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const { searchParams } = new URL(request.url);

  const includeInactive = searchParams.get("includeInactive") === "true";
  const flat = searchParams.get("flat") === "true";
  const parentId = searchParams.get("parentId");
  const withContractCounts = searchParams.get("withContractCounts") === "true";

  // Build where clause
  const where: Record<string, unknown> = { tenantId };
  if (!includeInactive) {
    where.isActive = true;
  }
  if (parentId) {
    where.parentId = parentId;
  }

  // Fetch categories
  const categories = await prisma.taxonomyCategory.findMany({
    where,
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  // Optionally include contract counts
  let categoriesWithCounts = categories.map((cat) => ({
    ...cat,
    keywords: cat.keywords || [],
    contractCount: 0,
  }));

  if (withContractCounts) {
    const counts = await prisma.contract.groupBy({
      by: ["category"],
      where: { tenantId },
      _count: { id: true },
    });

    const countMap = new Map(counts.map((c) => [c.category, c._count.id]));

    categoriesWithCounts = categoriesWithCounts.map((cat) => ({
      ...cat,
      contractCount: countMap.get(cat.name) || 0,
    }));
  }

  // Return flat or tree structure
  const result = flat
    ? categoriesWithCounts
    : buildCategoryTree(categoriesWithCounts as TaxonomyCategoryResponse[]);

  return createSuccessResponse(ctx, result);
});

// ============================================================================
// POST - Create taxonomy category
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const body: TaxonomyCategoryInput = await request.json();

  // Validate required fields
  if (!body.name || typeof body.name !== "string") {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid input', 400);
  }

  // Check for duplicate name at same level
  const existing = await prisma.taxonomyCategory.findFirst({
    where: {
      tenantId,
      name: body.name,
      parentId: body.parentId || null,
    },
  });

  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', `A category named "${body.name}" already exists at this level`, 409);
  }

  // If parent specified, verify it exists
  if (body.parentId) {
    const parent = await prisma.taxonomyCategory.findFirst({
      where: { id: body.parentId, tenantId },
    });

    if (!parent) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid parent', 400);
    }
  }

  // Calculate path and level
  const { path, level } = await calculateCategoryPath(
    tenantId,
    body.parentId || null,
    body.name
  );

  // Get max sort order for this level
  const maxSortOrder = await prisma.taxonomyCategory.findFirst({
    where: {
      tenantId,
      parentId: body.parentId || null,
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  // Create category
  const category = await prisma.taxonomyCategory.create({
    data: {
      tenantId,
      name: body.name,
      description: body.description,
      parentId: body.parentId || null,
      level,
      path,
      keywords: body.keywords || [],
      aiClassificationPrompt: body.aiClassificationPrompt,
      color: body.color || "#3B82F6",
      icon: body.icon || "folder",
      sortOrder: body.sortOrder ?? (maxSortOrder?.sortOrder ?? 0) + 1,
      isActive: true,
    },
  });

  return createSuccessResponse(ctx, {
      ...category,
      keywords: category.keywords || [],
      contractCount: 0,
      children: [],
      message: "Category created successfully",
  }, { status: 201 });
});

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export const OPTIONS = withAuthApiHandler(async (request: NextRequest, ctx) => {
  return cors.optionsResponse(request, "GET, POST, PUT, DELETE, OPTIONS");
});
