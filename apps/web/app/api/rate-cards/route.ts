import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardEntryService } from '@/packages/data-orchestration/src/services/rate-card-entry.service';
import { AdvancedFilterService } from '@/packages/data-orchestration/src/services/advanced-filter.service';

const rateCardService = new RateCardEntryService(prisma);
const advancedFilterService = new AdvancedFilterService(prisma);

/**
 * GET /api/rate-cards
 * List rate card entries with filtering and pagination
 * Supports both simple filters and advanced filter objects
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // TODO: Get tenantId from session/auth
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    // Check if advanced filter is provided
    const advancedFilterParam = searchParams.get('advancedFilter');
    
    if (advancedFilterParam) {
      // Use advanced filtering
      const advancedFilter = JSON.parse(advancedFilterParam);
      
      const pagination = {
        skip: searchParams.get('skip') ? parseInt(searchParams.get('skip')!) : undefined,
        take: searchParams.get('take') ? parseInt(searchParams.get('take')!) : 50,
        orderBy: searchParams.get('sortBy') ? {
          [searchParams.get('sortBy')!]: searchParams.get('sortOrder') || 'desc'
        } : { createdAt: 'desc' },
      };

      const rateCards = await advancedFilterService.applyFilter(
        tenantId,
        advancedFilter,
        pagination
      );

      // Get total count
      const matchCount = await advancedFilterService.calculateMatchCount(
        tenantId,
        advancedFilter
      );

      return NextResponse.json({
        data: rateCards,
        total: matchCount.count,
        executionTime: matchCount.executionTime,
      });
    } else {
      // Use simple filtering (existing logic)
      const filters = {
        supplierId: searchParams.get('supplierId') || undefined,
        supplierName: searchParams.get('supplierName') || undefined,
        roleStandardized: searchParams.get('roleStandardized') || undefined,
        seniority: searchParams.get('seniority') as any || undefined,
        lineOfService: searchParams.get('lineOfService') || undefined,
        country: searchParams.get('country') || undefined,
        region: searchParams.get('region') || undefined,
        minRate: searchParams.get('minRate') ? parseFloat(searchParams.get('minRate')!) : undefined,
        maxRate: searchParams.get('maxRate') ? parseFloat(searchParams.get('maxRate')!) : undefined,
        effectiveDateFrom: searchParams.get('effectiveDateFrom') ? new Date(searchParams.get('effectiveDateFrom')!) : undefined,
        effectiveDateTo: searchParams.get('effectiveDateTo') ? new Date(searchParams.get('effectiveDateTo')!) : undefined,
        source: searchParams.get('source') as any || undefined,
        clientName: searchParams.get('clientName') || undefined,
        isBaseline: searchParams.get('isBaseline') === 'true' ? true : searchParams.get('isBaseline') === 'false' ? false : undefined,
        isNegotiated: searchParams.get('isNegotiated') === 'true' ? true : searchParams.get('isNegotiated') === 'false' ? false : undefined,
      };

      const pagination = {
        page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
        pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50,
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      };

      const result = await rateCardService.listEntries(tenantId, filters, pagination);

      return NextResponse.json(result);
    }
  } catch (error) {
    console.error('Error listing rate cards:', error);
    return NextResponse.json(
      { error: 'Failed to list rate cards', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rate-cards
 * Create a new rate card entry
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // TODO: Get tenantId and userId from session/auth
    const tenantId = body.tenantId || 'default-tenant';
    const userId = body.userId || 'system';

    // Convert date strings to Date objects
    if (body.effectiveDate) {
      body.effectiveDate = new Date(body.effectiveDate);
    }
    if (body.expiryDate) {
      body.expiryDate = new Date(body.expiryDate);
    }

    const entry = await rateCardService.createEntry(body, tenantId, userId);

    // Emit event for real-time updates and cache invalidation
    const { rateCardEvents } = await import('@/../../packages/data-orchestration/src/services/event-integration.helper');
    await rateCardEvents.created(entry.id, {
      supplierName: entry.supplierName,
      roleStandardized: entry.roleStandardized,
    }, tenantId);

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating rate card:', error);
    return NextResponse.json(
      { error: 'Failed to create rate card', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
