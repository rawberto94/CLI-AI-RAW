import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';

/**
 * GET /api/reports/filter-options
 * Get available filter options for AI Report Builder
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;

  // Get unique suppliers
  const suppliersData = await prisma.contract.findMany({
    where: { tenantId },
    select: { supplierName: true },
    distinct: ['supplierName'],
  });
  
  const suppliers = suppliersData
    .map(c => c.supplierName)
    .filter((s): s is string => !!s && s.trim() !== '')
    .sort();

  // Get unique categories (from categoryL1)
  const categoriesData = await prisma.contract.findMany({
    where: { tenantId },
    select: { categoryL1: true },
    distinct: ['categoryL1'],
  });
  
  const categories = categoriesData
    .map(c => c.categoryL1)
    .filter((c): c is string => !!c && c.trim() !== '')
    .sort();

  return createSuccessResponse(ctx, {
    suppliers,
    categories,
  });
});
