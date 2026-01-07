/**
 * Tags Management API
 * GET /api/tags - List all tags for a tenant
 * POST /api/tags - Create a new tag
 * 
 * Tags are managed at the tenant level and can be applied to contracts.
 * This API provides centralized tag management with usage statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface TagWithUsage {
  name: string;
  color?: string;
  description?: string;
  contractCount: number;
  createdAt?: Date;
  createdBy?: string;
}

/** Predefined tag entry stored in tenant settings */
interface TagEntry {
  name: string;
  color?: string;
  description?: string;
  createdAt?: string;
}

/**
 * GET /api/tags
 * Get all unique tags for a tenant with usage counts
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'name'; // 'name', 'usage', 'recent'
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get all contracts with their tags
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
      },
      select: {
        id: true,
        tags: true,
        updatedAt: true,
      },
    });

    // Aggregate tags with usage counts
    const tagMap = new Map<string, TagWithUsage>();

    for (const contract of contracts) {
      const contractTags = contract.tags as string[] || [];
      for (const tag of contractTags) {
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

    // Also check TenantSettings for predefined tags
    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
      select: { customFields: true },
    });

    const predefinedTags = (tenantSettings?.customFields as any)?.predefinedTags || [];
    for (const predefinedTag of predefinedTags) {
      const tagName = typeof predefinedTag === 'string' ? predefinedTag : predefinedTag.name;
      const tagColor = typeof predefinedTag === 'object' ? predefinedTag.color : undefined;
      const tagDescription = typeof predefinedTag === 'object' ? predefinedTag.description : undefined;
      
      const normalized = tagName.trim().toLowerCase();
      if (normalized && (!search || normalized.includes(search.toLowerCase()))) {
        const existing = tagMap.get(normalized);
        if (existing) {
          // Keep usage count but add metadata from predefined
          existing.color = tagColor;
          existing.description = tagDescription;
        } else {
          tagMap.set(normalized, {
            name: tagName.trim(),
            color: tagColor,
            description: tagDescription,
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

    return NextResponse.json({
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
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tags
 * Create or update predefined tags in tenant settings
 */
export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, color, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 });
    }

    // Get or create tenant settings
    let tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
    });

    if (!tenantSettings) {
      tenantSettings = await prisma.tenantSettings.create({
        data: {
          tenantId,
          customFields: { predefinedTags: [] },
        },
      });
    }

    const customFields = (tenantSettings.customFields as Record<string, unknown>) || {};
    const predefinedTags = (customFields.predefinedTags as Array<string | TagEntry>) || [];

    // Check if tag already exists
    const existingIndex = predefinedTags.findIndex(
      (t) => (typeof t === 'string' ? t : t.name).toLowerCase() === normalizedName.toLowerCase()
    );

    const newTag = {
      name: normalizedName,
      color: color || '#3B82F6',
      description: description || '',
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Update existing tag
      predefinedTags[existingIndex] = newTag;
    } else {
      // Add new tag
      predefinedTags.push(newTag);
    }

    // Update tenant settings
    await prisma.tenantSettings.update({
      where: { id: tenantSettings.id },
      data: {
        customFields: { ...customFields, predefinedTags } as any,
      },
    });

    return NextResponse.json({
      success: true,
      data: newTag,
      message: existingIndex >= 0 ? 'Tag updated successfully' : 'Tag created successfully',
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: 'Failed to create tag', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tags
 * Delete a predefined tag from tenant settings
 */
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const tagName = searchParams.get('name');

    if (!tagName) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    // Get tenant settings
    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
    });

    if (!tenantSettings) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    const customFields = (tenantSettings.customFields as Record<string, unknown>) || {};
    const predefinedTags = (customFields.predefinedTags as Array<string | TagEntry>) || [];

    // Filter out the tag to delete
    const filteredTags = predefinedTags.filter(
      (t) => (typeof t === 'string' ? t : t.name).toLowerCase() !== tagName.toLowerCase()
    );

    if (filteredTags.length === predefinedTags.length) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Update tenant settings
    await prisma.tenantSettings.update({
      where: { id: tenantSettings.id },
      data: {
        customFields: { ...customFields, predefinedTags: filteredTags } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { error: 'Failed to delete tag', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
