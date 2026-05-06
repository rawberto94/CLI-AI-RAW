import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { rateCardEntryService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  
  const roles = searchParams.get('roles')?.split(',').filter(Boolean) || [];
  const suppliers = searchParams.get('suppliers')?.split(',').filter(Boolean) || [];
  const regions = searchParams.get('regions')?.split(',').filter(Boolean) || [];
  const seniority = searchParams.get('seniority');
  const minRate = searchParams.get('minRate');
  const maxRate = searchParams.get('maxRate');
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '100') || 100), 200);
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

  try {
    // Build where clause
    const where: Prisma.RateCardEntryWhereInput = { tenantId };
    
    // Role filter using correct field names
    if (roles.length > 0) {
      where.OR = [
        { roleOriginal: { in: roles, mode: 'insensitive' } },
        { roleStandardized: { in: roles, mode: 'insensitive' } },
        ...roles.map(r => ({ roleOriginal: { contains: r, mode: 'insensitive' as const } })),
        ...roles.map(r => ({ roleStandardized: { contains: r, mode: 'insensitive' as const } })),
      ];
    }

    // Supplier filter via relation
    if (suppliers.length > 0) {
      where.supplier = {
        name: { in: suppliers, mode: 'insensitive' },
      };
    }

    // Region filter
    if (regions.length > 0) {
      where.region = { in: regions, mode: 'insensitive' };
    }

    // Seniority filter
    if (seniority) {
      where.seniority = seniority as Prisma.EnumSeniorityLevelFilter['equals'];
    }

    // Rate range filter
    if (minRate || maxRate) {
      where.dailyRate = {};
      if (minRate) where.dailyRate.gte = parseFloat(minRate);
      if (maxRate) where.dailyRate.lte = parseFloat(maxRate);
    }

    // Fetch entries with supplier info
    const [entries, totalCount] = await Promise.all([
      prisma.rateCardEntry.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              tier: true,
            },
          },
        },
      }),
      prisma.rateCardEntry.count({ where }),
    ]);

    // Map to response format
    const mapped = entries.map(e => ({
      id: e.id,
      roleOriginal: e.roleOriginal || '',
      roleStandardized: e.roleStandardized || e.roleOriginal || '',
      seniority: e.seniority || 'MID',
      supplierName: e.supplierName || e.supplier?.name || 'Unknown',
      supplierTier: e.supplierTier || e.supplier?.tier || 'TIER_2',
      dailyRateUSD: Number(e.dailyRateUSD || 0),
      currency: e.currency || 'USD',
      country: e.country || 'Unknown',
      region: e.region || 'Unknown',
      lineOfService: e.lineOfService || 'General',
      effectiveDate: e.effectiveDate?.toISOString().split('T')[0] || '',
      expiryDate: e.expiryDate?.toISOString().split('T')[0] || null,
      volumeCommitted: e.volumeCommitted || 0,
      isNegotiated: e.isNegotiated || false,
      confidence: e.confidence ? Number(e.confidence) : 0.5,
      source: e.source || 'CONTRACT',
      supplierId: e.supplierId,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    return createSuccessResponse(ctx, {
      success: true,
      entries: mapped,
      total: totalCount,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch rate card entries', 500)
  }
});
