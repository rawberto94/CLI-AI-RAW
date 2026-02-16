import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

// NOTE: Using direct Prisma queries instead of data-orchestration services
// The data-orchestration package has 60+ TypeScript errors that need extensive refactoring
// This bypass provides full database functionality while that work is completed

// OPTIMIZATION: Cache GET requests for 5 minutes (rate cards change infrequently)
export const revalidate = 300;

/**
 * GET /api/rate-cards
 * List rate card entries with filtering and pagination
 * Supports both simple filters and advanced filter objects
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;
    
    // Require tenant ID for data isolation
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required. Please authenticate or provide x-tenant-id header.', 400);
    }
    
    // Build where clause from filters - using any to avoid complex Prisma typing
    const where: any = { tenantId };
    
    if (searchParams.get('contractId')) where.contractId = searchParams.get('contractId');
    if (searchParams.get('supplierId')) where.supplierId = searchParams.get('supplierId');
    if (searchParams.get('supplierName')) where.supplierName = { contains: searchParams.get('supplierName'), mode: 'insensitive' };
    if (searchParams.get('roleStandardized')) where.roleStandardized = { contains: searchParams.get('roleStandardized'), mode: 'insensitive' };
    if (searchParams.get('seniority')) where.seniority = searchParams.get('seniority');
    if (searchParams.get('lineOfService')) where.lineOfService = searchParams.get('lineOfService');
    if (searchParams.get('country')) where.country = searchParams.get('country');
    if (searchParams.get('region')) where.region = searchParams.get('region');
    if (searchParams.get('source')) where.source = searchParams.get('source');
    if (searchParams.get('clientName')) where.clientName = { contains: searchParams.get('clientName'), mode: 'insensitive' };
    
    // Rate range filters
    if (searchParams.get('minRate') || searchParams.get('maxRate')) {
      where.dailyRate = {};
      if (searchParams.get('minRate')) where.dailyRate.gte = parseFloat(searchParams.get('minRate')!);
      if (searchParams.get('maxRate')) where.dailyRate.lte = parseFloat(searchParams.get('maxRate')!);
    }
    
    // Date filters
    if (searchParams.get('effectiveDateFrom') || searchParams.get('effectiveDateTo')) {
      where.effectiveDate = {};
      if (searchParams.get('effectiveDateFrom')) where.effectiveDate.gte = new Date(searchParams.get('effectiveDateFrom')!);
      if (searchParams.get('effectiveDateTo')) where.effectiveDate.lte = new Date(searchParams.get('effectiveDateTo')!);
    }
    
    // Boolean filters
    if (searchParams.get('isBaseline') === 'true') where.isBaseline = true;
    if (searchParams.get('isBaseline') === 'false') where.isBaseline = false;
    if (searchParams.get('isNegotiated') === 'true') where.isNegotiated = true;
    if (searchParams.get('isNegotiated') === 'false') where.isNegotiated = false;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const skip = (page - 1) * pageSize;
    
    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const orderBy = { [sortBy]: sortOrder };

    // Execute queries
    const [rateCards, total] = await Promise.all([
      prisma.rateCardEntry.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          contract: {
            select: {
              id: true,
              fileName: true,
              clientName: true,
            }
          }
        }
      }),
      prisma.rateCardEntry.count({ where })
    ]);

    // Deduplicate rate cards based on role, seniority, and rate
    type RateCardWithContract = Awaited<ReturnType<typeof prisma.rateCardEntry.findMany>>[number];
    const deduplicatedData = rateCards.reduce((acc: RateCardWithContract[], card: RateCardWithContract) => {
      const key = `${card.roleStandardized || card.roleOriginal}-${card.seniority}-${card.dailyRate}-${card.supplierName}`;
      const exists = acc.some(existing => 
        `${existing.roleStandardized || existing.roleOriginal}-${existing.seniority}-${existing.dailyRate}-${existing.supplierName}` === key
      );
      if (!exists) {
        acc.push(card);
      }
      return acc;
    }, []);

    return createSuccessResponse(ctx, {
      data: deduplicatedData,
      total: deduplicatedData.length,
      originalTotal: total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
});

/**
 * POST /api/rate-cards
 * Create a new rate card entry
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    
    // Get authenticated user from session
    const tenantId = ctx.tenantId || ctx.tenantId;
    
    // Require tenant ID for data isolation
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required. Please authenticate or provide x-tenant-id header.', 400);
    }
    
    const userId = ctx.userId || body.userId || 'system';

    // Convert date strings to Date objects
    if (body.effectiveDate) {
      body.effectiveDate = new Date(body.effectiveDate);
    }
    if (body.expiryDate) {
      body.expiryDate = new Date(body.expiryDate);
    }

    // Create entry using direct Prisma
    const entry = await prisma.rateCardEntry.create({
      data: {
        ...body,
        tenantId,
        createdBy: userId,
        updatedBy: userId,
      }
    });

    return createSuccessResponse(ctx, entry, { status: 201 });
  });
