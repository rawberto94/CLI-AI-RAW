/**
 * Word Add-in Template Folders API
 * Lists distinct categories used as folders and manages custom categories.
 * Categories/folders are derived from the ContractTemplate.category field.
 */

import { NextRequest } from 'next/server';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

/** Built-in categories that always appear */
const BUILT_IN_CATEGORIES = ['MSA', 'SOW', 'NDA', 'AMENDMENT', 'SLA', 'OTHER'];

/** GET — list all folders (built-in + custom) with template counts */
export async function GET(req: NextRequest) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);

    // Count templates per category
    const categoryCounts = await prisma.contractTemplate.groupBy({
      by: ['category'],
      where: { tenantId: ctx.tenantId, isActive: true },
      _count: { id: true },
    });

    const countMap = new Map(
      categoryCounts.map((c) => [c.category || 'OTHER', c._count.id])
    );

    // Build full folder list: built-in + any custom categories from DB
    const allCategories = new Set([
      ...BUILT_IN_CATEGORIES,
      ...categoryCounts.map((c) => c.category || 'OTHER'),
    ]);

    const folders = [...allCategories].sort().map((cat) => ({
      name: cat,
      count: countMap.get(cat) || 0,
      isBuiltIn: BUILT_IN_CATEGORIES.includes(cat),
    }));

    // Total count
    const totalCount = categoryCounts.reduce((sum, c) => sum + c._count.id, 0);

    return createSuccessResponse(ctx, {
      folders,
      totalCount,
    });
  } catch (error) {
    console.error('Word Add-in folders error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to fetch folders', 500);
  }
}

/** POST — move templates to a folder (category) or rename a folder */
export async function POST(req: NextRequest) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { action, templateIds, folder, oldFolder, newFolder } = body;

    if (action === 'move' && templateIds && folder) {
      // Move templates to a folder
      await prisma.contractTemplate.updateMany({
        where: {
          id: { in: templateIds },
          tenantId: ctx.tenantId,
        },
        data: { category: folder },
      });
      return createSuccessResponse(ctx, { moved: templateIds.length });
    }

    if (action === 'rename' && oldFolder && newFolder) {
      // Rename a folder — updates all templates in that category
      const result = await prisma.contractTemplate.updateMany({
        where: {
          tenantId: ctx.tenantId,
          category: oldFolder,
        },
        data: { category: newFolder },
      });
      return createSuccessResponse(ctx, { renamed: result.count });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Use "move" or "rename".', 400);
  } catch (error) {
    console.error('Word Add-in folder action error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to perform folder action', 500);
  }
}
