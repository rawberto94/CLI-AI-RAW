/**
 * Taxonomy Export API
 * GET /api/taxonomy/export - Export current taxonomy as JSON or CSV
 * 
 * Query params:
 * - format: 'json' | 'csv' (default: json)
 * - flat: 'true' | 'false' - flat list or hierarchical (default: false)
 * 
 * Returns downloadable file with tenant's taxonomy
 */

import { NextRequest, NextResponse } from "next/server";
import cors from "@/lib/security/cors";
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { taxonomyService } from 'data-orchestration/services';
// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ExportCategory {
  name: string;
  description?: string | null;
  parentPath?: string | null;
  keywords: string[];
  aiClassificationPrompt?: string | null;
  color: string;
  icon: string;
  children?: ExportCategory[];
}

interface FlatExportCategory {
  name: string;
  description?: string | null;
  parent?: string | null;
  path: string;
  level: number;
  keywords: string;
  aiClassificationPrompt?: string | null;
  color: string;
  icon: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build hierarchical export structure
 */
function buildExportTree(
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    path: string;
    level: number;
    keywords: string[];
    aiClassificationPrompt: string | null;
    color: string;
    icon: string;
  }>,
  parentId: string | null = null
): ExportCategory[] {
  return categories
    .filter((cat) => cat.parentId === parentId)
    .map((cat) => {
      const children = buildExportTree(categories, cat.id);
      const exportCat: ExportCategory = {
        name: cat.name,
        description: cat.description,
        keywords: cat.keywords || [],
        aiClassificationPrompt: cat.aiClassificationPrompt,
        color: cat.color,
        icon: cat.icon,
      };
      
      if (children.length > 0) {
        exportCat.children = children;
      }
      
      return exportCat;
    });
}

/**
 * Convert categories to flat CSV format
 */
function toCSV(categories: FlatExportCategory[]): string {
  const headers = [
    'name',
    'description',
    'parent',
    'path',
    'level',
    'keywords',
    'aiClassificationPrompt',
    'color',
    'icon',
  ];
  
  const rows = categories.map((cat) => {
    return [
      escapeCSV(cat.name),
      escapeCSV(cat.description || ''),
      escapeCSV(cat.parent || ''),
      escapeCSV(cat.path),
      cat.level.toString(),
      escapeCSV(cat.keywords),
      escapeCSV(cat.aiClassificationPrompt || ''),
      cat.color,
      cat.icon,
    ].join(',');
  });
  
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Escape CSV value
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ============================================================================
// GET - Export taxonomy
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);

  const format = searchParams.get('format') || 'json';
  const flat = searchParams.get('flat') === 'true';

  // Fetch all active categories
  const categories = await prisma.taxonomyCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      parentId: true,
      path: true,
      level: true,
      keywords: true,
      aiClassificationPrompt: true,
      color: true,
      icon: true,
    },
  });

  if (categories.length === 0) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'No categories to export', 404);
  }

  // Build parent name lookup
  const idToName = new Map(categories.map((c) => [c.id, c.name]));

  if (format === 'csv') {
    // Flat CSV format
    const flatCategories: FlatExportCategory[] = categories.map((cat) => ({
      name: cat.name,
      description: cat.description,
      parent: cat.parentId ? idToName.get(cat.parentId) || null : null,
      path: cat.path,
      level: cat.level,
      keywords: (cat.keywords || []).join('; '),
      aiClassificationPrompt: cat.aiClassificationPrompt,
      color: cat.color,
      icon: cat.icon,
    }));

    const csv = toCSV(flatCategories);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="taxonomy-${tenantId}-${Date.now()}.csv"`,
      },
    });
  }

  // JSON format
  const processedCategories = categories.map((cat) => ({
    ...cat,
    keywords: cat.keywords || [],
  }));

  const exportData = flat
    ? processedCategories.map((cat) => ({
        name: cat.name,
        description: cat.description,
        parent: cat.parentId ? idToName.get(cat.parentId) || null : null,
        path: cat.path,
        level: cat.level,
        keywords: cat.keywords,
        aiClassificationPrompt: cat.aiClassificationPrompt,
        color: cat.color,
        icon: cat.icon,
      }))
    : buildExportTree(processedCategories);

  const jsonExport = {
    exportedAt: new Date().toISOString(),
    tenantId,
    version: '1.0',
    categoryCount: categories.length,
    format: flat ? 'flat' : 'hierarchical',
    categories: exportData,
  };

  return new NextResponse(JSON.stringify(jsonExport, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="taxonomy-${tenantId}-${Date.now()}.json"`,
    },
  });
});

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

export const OPTIONS = withAuthApiHandler(async (request: NextRequest, ctx) => {
  return cors.optionsResponse(request, 'GET, OPTIONS');
});
