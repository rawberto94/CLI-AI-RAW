/**
 * Word Add-in Template Folders API
 * Lists distinct categories used as folders and manages custom categories.
 * Categories/folders are derived from the ContractTemplate.category field.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const folderActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('move'),
    templateIds: z.array(z.string()).min(1, 'At least one template ID required'),
    folder: z.string().min(1, 'Folder name is required').max(50),
  }),
  z.object({
    action: z.literal('rename'),
    oldFolder: z.string().min(1, 'Old folder name required'),
    newFolder: z.string().min(1, 'New folder name required').max(50),
  }),
]);

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
    logger.error('Word Add-in folders error:', error);
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
    const parsed = folderActionSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }

    if (parsed.data.action === 'move') {
      const { templateIds, folder } = parsed.data;
      await prisma.contractTemplate.updateMany({
        where: {
          id: { in: templateIds },
          tenantId: ctx.tenantId,
        },
        data: { category: folder },
      });
      return createSuccessResponse(ctx, { moved: templateIds.length });
    }

    if (parsed.data.action === 'rename') {
      const { oldFolder, newFolder } = parsed.data;
      const result = await prisma.contractTemplate.updateMany({
        where: {
          tenantId: ctx.tenantId,
          category: oldFolder,
        },
        data: { category: newFolder },
      });
      return createSuccessResponse(ctx, { renamed: result.count });
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action.', 400);
  } catch (error) {
    logger.error('Word Add-in folder action error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Failed to perform folder action', 500);
  }
}
