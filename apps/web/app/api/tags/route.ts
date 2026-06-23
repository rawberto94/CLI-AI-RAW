/**
 * Tags Management API
 * GET /api/tags - List all tags for a tenant
 * POST /api/tags - Create a new tag
 * 
 * Tags are managed at the tenant level and can be applied to contracts.
 * This API provides centralized tag management with usage statistics.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import {
  deleteTenantTag,
  getTenantTagRegistry,
  normalizeTagName,
  upsertTenantTags,
} from '@/lib/contracts/server/tag-registry';

interface TagWithUsage {
  name: string;
  color?: string;
  description?: string;
  contractCount: number;
  createdAt?: Date;
  createdBy?: string;
}

/** Predefined tag entry stored in tenant settings */
/**
 * GET /api/tags
 * Get all unique tags for a tenant with usage counts
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'name'; // 'name', 'usage', 'recent'
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100') || 100), 200);

  // Get all metadata tag assignments (source of truth for tags).
  const metadataRows = await prisma.contractMetadata.findMany({
    where: { tenantId },
    select: { tags: true },
  });

  // Aggregate tags with usage counts
  const tagMap = new Map<string, TagWithUsage>();

  for (const metadata of metadataRows) {
    for (const tag of metadata.tags || []) {
      const normalized = tag.trim().toLowerCase();
      if (normalized && (!search || normalized.includes(search.toLowerCase()))) {
        const existing = tagMap.get(normalized);
        if (existing) {
          existing.contractCount++;
        } else {
          tagMap.set(normalized, {
            name: tag.trim(),
            contractCount: 1,
          });
        }
      }
    }
  }

  // Merge tenant tag registry metadata (color/description).
  const tenantTagRegistry = await getTenantTagRegistry(tenantId);
  for (const predefinedTag of tenantTagRegistry.values()) {
    const normalized = predefinedTag.name.trim().toLowerCase();
    if (normalized && (!search || normalized.includes(search.toLowerCase()))) {
      const existing = tagMap.get(normalized);
      if (existing) {
        // Keep usage count but add metadata from predefined
        existing.color = predefinedTag.color;
        existing.description = predefinedTag.description;
      } else {
        tagMap.set(normalized, {
          name: predefinedTag.name,
          color: predefinedTag.color,
          description: predefinedTag.description,
          contractCount: 0,
        });
      }
    }
  }

  // Convert to array and sort
  let tags = Array.from(tagMap.values());

  switch (sortBy) {
    case 'usage':
      tags.sort((a, b) => b.contractCount - a.contractCount);
      break;
    case 'recent':
      tags.sort((a, b) => (b.contractCount - a.contractCount)); // Fallback to usage
      break;
    case 'name':
    default:
      tags.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  // Apply limit
  tags = tags.slice(0, limit);

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      tags,
      total: tags.length,
      summary: {
        totalTags: tagMap.size,
        totalUsage: Array.from(tagMap.values()).reduce((sum, t) => sum + t.contractCount, 0),
      },
    },
  });
});

/**
 * POST /api/tags
 * Create or update predefined tags in tenant settings
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const body = await request.json();
  const { name, color, description } = body;

  if (!name || typeof name !== 'string') {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tag name is required', 400);
  }

  const normalizedName = normalizeTagName(name);
  if (!normalizedName) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tag name cannot be empty', 400);
  }

  const existingRegistry = await getTenantTagRegistry(tenantId);
  const existedBefore = existingRegistry.has(normalizedName);

  const newTagInput = {
    name: normalizedName,
    color: color || '#8B5CF6',
    description: description || '',
    createdAt: new Date().toISOString(),
    createdBy: ctx.userId || 'system',
  };

  const [persistedTag] = await upsertTenantTags(tenantId, [newTagInput], {
    createdBy: ctx.userId || 'system',
  });

  return createSuccessResponse(ctx, {
    success: true,
    data: persistedTag,
    message: existedBefore ? 'Tag updated successfully' : 'Tag created successfully',
  });
});

/**
 * DELETE /api/tags
 * Delete a predefined tag from tenant settings
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const { searchParams } = new URL(request.url);
  const tagName = searchParams.get('name');

  if (!tagName) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tag name is required', 400);
  }

  const wasDeleted = await deleteTenantTag(tenantId, tagName);
  if (!wasDeleted) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Tag not found', 404);
  }

  return createSuccessResponse(ctx, {
    success: true,
    message: 'Tag deleted successfully',
  });
});
