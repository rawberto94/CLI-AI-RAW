/**
 * Custom Taxonomy Upload API
 * POST /api/taxonomy/upload - Upload and import custom taxonomy from CSV/JSON/Excel
 * 
 * Supports importing client-provided category structures:
 * - CSV format (name, description, parent, keywords, color, icon)
 * - JSON format (hierarchical or flat)
 * - Excel format (.xlsx with sheet "Categories")
 * 
 * Features:
 * - Validates structure before import
 * - Handles hierarchical relationships
 * - Deduplicates existing categories
 * - Provides detailed import report
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiTenantId } from "@/lib/tenant-server";
import { z } from "zod";

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

const CategoryRowSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional().nullable(),
  parent: z.string().optional().nullable(),
  parentPath: z.string().optional().nullable(),
  keywords: z.union([
    z.string(),
    z.array(z.string()),
  ]).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional().nullable(),
  icon: z.string().optional().nullable(),
  aiClassificationPrompt: z.string().optional().nullable(),
});

type CategoryRow = z.infer<typeof CategoryRowSchema>;

interface HierarchicalCategory {
  name: string;
  description?: string | null;
  keywords?: string[] | null;
  color?: string | null;
  icon?: string | null;
  aiClassificationPrompt?: string | null;
  children?: HierarchicalCategory[];
}

interface ImportResult {
  success: boolean;
  categoriesCreated: number;
  categoriesUpdated: number;
  categoriesSkipped: number;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse CSV content into category rows
 */
function parseCSV(content: string): CategoryRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error('CSV header row is empty');
  }
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  
  // Validate required columns
  if (!headers.includes('name')) {
    throw new Error('CSV must have a "name" column');
  }

  const rows: CategoryRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    // Handle quoted values with commas inside
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    // Parse keywords from comma/semicolon separated string
    let keywords: string[] | undefined;
    if (row.keywords) {
      keywords = row.keywords.split(/[;|]/).map(k => k.trim()).filter(Boolean);
    }

    rows.push({
      name: row.name || '',
      description: row.description || null,
      parent: row.parent || null,
      parentPath: row.parentpath || row.parent_path || null,
      keywords: keywords || null,
      color: row.color || null,
      icon: row.icon || null,
      aiClassificationPrompt: row.aiclassificationprompt || row.ai_prompt || null,
    });
  }

  return rows;
}

/**
 * Parse JSON content - supports both flat and hierarchical formats
 */
function parseJSON(content: string): { rows: CategoryRow[]; isHierarchical: boolean } {
  const data = JSON.parse(content);
  
  // Check if it's an array of flat categories or hierarchical
  if (Array.isArray(data)) {
    // Check if any item has 'children' - hierarchical format
    const hasChildren = data.some((item: any) => item.children && Array.isArray(item.children));
    
    if (hasChildren) {
      // Flatten hierarchical structure
      const rows: CategoryRow[] = [];
      
      function flattenHierarchy(categories: HierarchicalCategory[], parentName?: string) {
        for (const cat of categories) {
          rows.push({
            name: cat.name,
            description: cat.description,
            parent: parentName,
            keywords: cat.keywords,
            color: cat.color,
            icon: cat.icon,
            aiClassificationPrompt: cat.aiClassificationPrompt,
          });
          
          if (cat.children && cat.children.length > 0) {
            flattenHierarchy(cat.children, cat.name);
          }
        }
      }
      
      flattenHierarchy(data);
      return { rows, isHierarchical: true };
    } else {
      // Flat array format
      return {
        rows: data.map((item: any) => ({
          name: item.name,
          description: item.description,
          parent: item.parent || item.parentName,
          parentPath: item.parentPath,
          keywords: typeof item.keywords === 'string' 
            ? item.keywords.split(/[,;|]/).map((k: string) => k.trim())
            : item.keywords,
          color: item.color,
          icon: item.icon,
          aiClassificationPrompt: item.aiClassificationPrompt || item.aiPrompt,
        })),
        isHierarchical: false,
      };
    }
  } else if (data.categories) {
    // Object with 'categories' property
    return parseJSON(JSON.stringify(data.categories));
  }
  
  throw new Error('Invalid JSON format: expected array of categories or object with "categories" property');
}

/**
 * Generate a color based on category name (for categories without specified color)
 */
function generateColor(name: string): string {
  const colors = [
    '#3B82F6', // blue
    '#8B5CF6', // purple
    '#10B981', // emerald
    '#F59E0B', // amber
    '#EF4444', // red
    '#06B6D4', // cyan
    '#EC4899', // pink
    '#6366F1', // indigo
    '#14B8A6', // teal
    '#F97316', // orange
  ];
  
  // Simple hash based on name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length] || '#3B82F6';
}

/**
 * Import categories into the database
 */
async function importCategories(
  tenantId: string,
  rows: CategoryRow[],
  options: { clearExisting?: boolean; updateExisting?: boolean }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    categoriesCreated: 0,
    categoriesUpdated: 0,
    categoriesSkipped: 0,
    errors: [],
    warnings: [],
  };

  // Optionally clear existing categories
  if (options.clearExisting) {
    await prisma.taxonomyCategory.deleteMany({
      where: { tenantId },
    });
    result.warnings.push('Cleared all existing categories');
  }

  // Build a map of category names to their database IDs for parent resolution
  const categoryMap = new Map<string, string>();
  
  // First, get existing categories
  const existingCategories = await prisma.taxonomyCategory.findMany({
    where: { tenantId },
    select: { id: true, name: true, path: true },
  });
  
  for (const cat of existingCategories) {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
    if (cat.path) {
      categoryMap.set(cat.path.toLowerCase(), cat.id);
    }
  }

  // Sort rows by parent dependency (parents first)
  const sortedRows = [...rows].sort((a, b) => {
    // Categories without parents come first
    if (!a.parent && b.parent) return -1;
    if (a.parent && !b.parent) return 1;
    return 0;
  });

  // Process categories
  for (const row of sortedRows) {
    try {
      // Validate row
      const validation = CategoryRowSchema.safeParse(row);
      if (!validation.success) {
        result.errors.push(`Invalid category "${row.name}": ${validation.error.message}`);
        continue;
      }

      // Check for existing category
      const existingId = categoryMap.get(row.name.toLowerCase());
      
      // Resolve parent ID
      let parentId: string | undefined;
      let level = 0;
      let path = `/${row.name}`;
      
      if (row.parent) {
        parentId = categoryMap.get(row.parent.toLowerCase());
        if (!parentId && row.parentPath) {
          parentId = categoryMap.get(row.parentPath.toLowerCase());
        }
        
        if (!parentId) {
          result.warnings.push(`Parent "${row.parent}" not found for category "${row.name}" - creating as top-level`);
        } else {
          // Get parent info for path and level
          const parentCat = await prisma.taxonomyCategory.findUnique({
            where: { id: parentId },
            select: { level: true, path: true },
          });
          if (parentCat) {
            level = parentCat.level + 1;
            path = `${parentCat.path}/${row.name}`;
          }
        }
      }

      // Prepare keywords array
      const keywords = Array.isArray(row.keywords) 
        ? row.keywords 
        : row.keywords 
          ? row.keywords.split(/[,;|]/).map(k => k.trim()).filter(Boolean)
          : [];

      const categoryData = {
        name: row.name,
        description: row.description || null,
        icon: row.icon || 'folder',
        color: row.color || generateColor(row.name),
        level,
        path,
        parentId: parentId || null,
        keywords,
        aiClassificationPrompt: row.aiClassificationPrompt || null,
        isActive: true,
      };

      if (existingId && options.updateExisting) {
        // Update existing category
        await prisma.taxonomyCategory.update({
          where: { id: existingId },
          data: categoryData,
        });
        result.categoriesUpdated++;
      } else if (existingId) {
        // Skip existing
        result.categoriesSkipped++;
        result.warnings.push(`Skipped existing category "${row.name}"`);
      } else {
        // Create new category
        const created = await prisma.taxonomyCategory.create({
          data: {
            tenantId,
            ...categoryData,
            sortOrder: result.categoriesCreated,
          },
        });
        categoryMap.set(row.name.toLowerCase(), created.id);
        categoryMap.set(path.toLowerCase(), created.id);
        result.categoriesCreated++;
      }
    } catch (error) {
      result.errors.push(`Error processing "${row.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

// ============================================================================
// POST - Upload and import taxonomy
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = await getApiTenantId(request);
    const contentType = request.headers.get('content-type') || '';
    
    let rows: CategoryRow[] = [];
    let format = 'unknown';
    let clearExisting = false;
    let updateExisting = true;

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      clearExisting = formData.get('clearExisting') === 'true';
      updateExisting = formData.get('updateExisting') !== 'false';
      
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'No file provided' },
          { status: 400 }
        );
      }

      const content = await file.text();
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.csv')) {
        format = 'csv';
        rows = parseCSV(content);
      } else if (fileName.endsWith('.json')) {
        format = 'json';
        const parsed = parseJSON(content);
        rows = parsed.rows;
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Excel format not yet supported. Please convert to CSV or JSON.',
            hint: 'Export your Excel file as CSV, or convert it to JSON format.'
          },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { success: false, error: `Unsupported file format: ${fileName}. Use .csv or .json` },
          { status: 400 }
        );
      }
    } 
    // Handle JSON body (direct API call)
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      format = 'json-body';
      clearExisting = body.clearExisting === true;
      updateExisting = body.updateExisting !== false;
      
      if (body.categories) {
        const parsed = parseJSON(JSON.stringify(body.categories));
        rows = parsed.rows;
      } else if (Array.isArray(body)) {
        const parsed = parseJSON(JSON.stringify(body));
        rows = parsed.rows;
      } else {
        return NextResponse.json(
          { success: false, error: 'JSON body must contain "categories" array or be an array of categories' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Content-Type must be multipart/form-data (file upload) or application/json' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid categories found in uploaded data' },
        { status: 400 }
      );
    }

    console.log(`📁 Importing ${rows.length} categories from ${format} format for tenant ${tenantId}`);

    // Import categories
    const result = await importCategories(tenantId, rows, { clearExisting, updateExisting });

    console.log(`✅ Import complete: ${result.categoriesCreated} created, ${result.categoriesUpdated} updated, ${result.categoriesSkipped} skipped`);

    return NextResponse.json({
      message: `Imported taxonomy with ${result.categoriesCreated} new categories`,
      format,
      ...result,
    });

  } catch (error) {
    console.error('Error importing taxonomy:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import taxonomy',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Return expected format/template
// ============================================================================

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    message: 'Taxonomy upload endpoint - POST a file or JSON to import categories',
    supportedFormats: ['csv', 'json'],
    csvTemplate: {
      description: 'CSV file with the following columns',
      columns: ['name', 'description', 'parent', 'keywords', 'color', 'icon'],
      example: `name,description,parent,keywords,color,icon
IT & Technology,Technology contracts,,software;hardware;IT,#3B82F6,laptop
Software,Software licenses,IT & Technology,license;saas;software,#8B5CF6,code
Hardware,Hardware purchases,IT & Technology,computer;server;equipment,#10B981,cpu`,
    },
    jsonTemplate: {
      description: 'JSON array of categories (flat or hierarchical)',
      flatExample: [
        {
          name: 'IT & Technology',
          description: 'Technology contracts',
          keywords: ['software', 'hardware', 'IT'],
          color: '#3B82F6',
          icon: 'laptop',
        },
        {
          name: 'Software',
          description: 'Software licenses',
          parent: 'IT & Technology',
          keywords: ['license', 'saas'],
        },
      ],
      hierarchicalExample: [
        {
          name: 'IT & Technology',
          description: 'Technology contracts',
          color: '#3B82F6',
          icon: 'laptop',
          children: [
            {
              name: 'Software',
              description: 'Software licenses',
              keywords: ['license', 'saas'],
            },
            {
              name: 'Hardware',
              description: 'Hardware purchases',
            },
          ],
        },
      ],
    },
    options: {
      clearExisting: 'Set to true to delete all existing categories before import',
      updateExisting: 'Set to true (default) to update existing categories with matching names',
    },
  });
}

// ============================================================================
// OPTIONS - CORS
// ============================================================================

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
    },
  });
}
