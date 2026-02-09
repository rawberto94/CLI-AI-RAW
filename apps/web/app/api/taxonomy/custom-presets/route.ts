/**
 * Custom Taxonomy Presets API
 * 
 * GET /api/taxonomy/custom-presets - List all custom presets for tenant
 * POST /api/taxonomy/custom-presets - Save current taxonomy as a custom preset
 * DELETE /api/taxonomy/custom-presets/[id] - Delete a custom preset
 * 
 * Custom presets are stored in the database and can be:
 * - Saved from current taxonomy
 * - Applied to create/overwrite taxonomy
 * - Shared between tenants (if marked as shared)
 */

import { NextRequest } from "next/server";
import cors from "@/lib/security/cors";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { withAuthApiHandler, withApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from "@/lib/api-middleware";
import type { AuthenticatedApiContext } from "@/lib/api-middleware";
import { taxonomyService } from 'data-orchestration/services';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PresetCategory {
  name: string;
  description?: string | null;
  keywords: string[];
  aiClassificationPrompt?: string | null;
  color: string;
  icon: string;
  children?: PresetCategory[];
}

const SavePresetSchema = z.object({
  name: z.string().min(1, "Preset name is required").max(100),
  description: z.string().max(500).optional(),
  isShared: z.boolean().optional().default(false),
});

const ApplyPresetSchema = z.object({
  presetId: z.string().min(1, "Preset ID is required"),
  clearExisting: z.boolean().optional().default(false),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build hierarchical preset structure from flat categories
 */
function buildPresetTree(
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    keywords: string[];
    aiClassificationPrompt: string | null;
    color: string;
    icon: string;
  }>,
  parentId: string | null = null
): PresetCategory[] {
  return categories
    .filter((cat) => cat.parentId === parentId)
    .map((cat) => {
      const children = buildPresetTree(categories, cat.id);
      const presetCat: PresetCategory = {
        name: cat.name,
        description: cat.description,
        keywords: cat.keywords || [],
        aiClassificationPrompt: cat.aiClassificationPrompt,
        color: cat.color,
        icon: cat.icon,
      };
      
      if (children.length > 0) {
        presetCat.children = children;
      }
      
      return presetCat;
    });
}

/**
 * Create categories from preset structure
 */
async function createCategoriesFromPreset(
  categories: PresetCategory[],
  tenantId: string,
  parentId: string | null = null,
  parentPath: string = '',
  level: number = 0,
  startSortOrder: number = 0
): Promise<number> {
  let createdCount = 0;
  
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    if (!cat) continue;
    
    const path = parentPath ? `${parentPath}/${cat.name}` : `/${cat.name}`;
    
    const created = await prisma.taxonomyCategory.create({
      data: {
        tenantId,
        name: cat.name,
        description: cat.description,
        parentId,
        level,
        path,
        keywords: cat.keywords || [],
        aiClassificationPrompt: cat.aiClassificationPrompt,
        color: cat.color || '#3B82F6',
        icon: cat.icon || 'folder',
        sortOrder: startSortOrder + i,
        isActive: true,
      },
    });
    createdCount++;
    
    // Create children recursively
    if (cat.children && cat.children.length > 0) {
      createdCount += await createCategoriesFromPreset(
        cat.children,
        tenantId,
        created.id,
        path,
        level + 1,
        0
      );
    }
  }
  
  return createdCount;
}

/**
 * Count categories in preset
 */
function countCategories(categories: PresetCategory[]): number {
  return categories.reduce((acc, cat) => {
    return acc + 1 + (cat.children ? countCategories(cat.children) : 0);
  }, 0);
}

// ============================================================================
// GET - List custom presets
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const includeShared = searchParams.get('includeShared') !== 'false';
  
  // Build where clause
  const whereConditions: { tenantId?: string; isShared?: boolean }[] = [{ tenantId }];
  if (includeShared) {
    whereConditions.push({ isShared: true });
  }
  
  const presets = await prisma.taxonomyPreset.findMany({
    where: { OR: whereConditions },
    orderBy: [{ isShared: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      description: true,
      categoryCount: true,
      isShared: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  return createSuccessResponse(ctx, {
    data: presets.map((p) => ({
      ...p,
      isOwn: p.tenantId === tenantId,
    })),
    total: presets.length,
  });
});

// ============================================================================
// POST - Save current taxonomy as preset OR apply a preset
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const body = await request.json();
  
  // Check if this is an apply request
  if ('presetId' in body) {
    return applyPreset(ctx, tenantId, body);
  }
  
  // Otherwise it's a save request
  return savePreset(ctx, tenantId, body);
});

/**
 * Save current taxonomy as a custom preset
 */
async function savePreset(
  ctx: AuthenticatedApiContext,
  tenantId: string,
  body: unknown
): Promise<Response> {
  // Validate input
  const validation = SavePresetSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid input', 400);
  }
  
  const { name, description, isShared } = validation.data;
  
  // Check for duplicate name
  const existing = await prisma.taxonomyPreset.findFirst({
    where: { tenantId, name },
  });
  
  if (existing) {
    return createErrorResponse(ctx, 'CONFLICT', `A preset named "${name}" already exists`, 409);
  }
  
  // Fetch current taxonomy
  const categories = await prisma.taxonomyCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      keywords: true,
      aiClassificationPrompt: true,
      color: true,
      icon: true,
    },
  });
  
  if (categories.length === 0) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Create some categories first before saving as a preset', 400);
  }
  
  // Build hierarchical structure
  const processedCategories = categories.map((cat) => ({
    ...cat,
    keywords: cat.keywords || [],
  }));
  const presetCategories = buildPresetTree(processedCategories);
  const categoryCount = countCategories(presetCategories);
  
  // Create preset
  const preset = await prisma.taxonomyPreset.create({
    data: {
      tenantId,
      name,
      description,
      categories: presetCategories as unknown as Prisma.InputJsonValue,
      categoryCount,
      isShared,
    },
  });
  
  return createSuccessResponse(ctx, {
    data: {
      id: preset.id,
      name: preset.name,
      description: preset.description,
      categoryCount,
      isShared: preset.isShared,
      createdAt: preset.createdAt,
    },
    message: `Saved "${name}" with ${categoryCount} categories`,
  });
}

/**
 * Apply a custom preset
 */
async function applyPreset(
  ctx: AuthenticatedApiContext,
  tenantId: string,
  body: unknown
): Promise<Response> {
  // Validate input
  const validation = ApplyPresetSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid input', 400);
  }
  
  const { presetId, clearExisting } = validation.data;
  
  // Find preset (own or shared)
  const preset = await prisma.taxonomyPreset.findFirst({
    where: {
      id: presetId,
      OR: [{ tenantId }, { isShared: true }],
    },
  });
  
  if (!preset) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Preset not found', 404);
  }
  
  // Clear existing if requested
  if (clearExisting) {
    await prisma.taxonomyCategory.deleteMany({
      where: { tenantId },
    });
  }
  
  // Create categories from preset
  const categories = preset.categories as unknown as PresetCategory[];
  const createdCount = await createCategoriesFromPreset(categories, tenantId);
  
  return createSuccessResponse(ctx, {
    message: `Applied "${preset.name}" preset with ${createdCount} categories`,
    categoriesCreated: createdCount,
  });
}

// ============================================================================
// DELETE - Delete a custom preset
// ============================================================================

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const presetId = searchParams.get('id');
  
  if (!presetId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Preset ID is required', 400);
  }
  
  // Only allow deleting own presets
  const preset = await prisma.taxonomyPreset.findFirst({
    where: { id: presetId, tenantId },
  });
  
  if (!preset) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Preset not found or not owned by you', 404);
  }
  
  await prisma.taxonomyPreset.delete({
    where: { id: presetId },
  });
  
  return createSuccessResponse(ctx, {
    message: `Deleted preset "${preset.name}"`,
  });
});

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export const OPTIONS = withApiHandler(async (request: NextRequest) => {
  return cors.optionsResponse(request, 'GET, POST, DELETE, OPTIONS');
});
