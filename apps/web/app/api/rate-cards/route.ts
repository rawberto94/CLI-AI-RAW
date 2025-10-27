import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardEntryService } from '@/packages/data-orchestration/src/services/rate-card-entry.service';

const rateCardService = new RateCardEntryService(prisma);

/**
 * GET /api/rate-cards
 * List rate card entries with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // TODO: Get tenantId from session/auth
    const tenantId = searchParams.get('tenantId') || 'default-tenant';

    // Parse filters
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
    };

    // Parse pagination
    const pagination = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 50,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
    };

    const result = await rateCardService.listEntries(tenantId, filters, pagination);

    return NextResponse.json(result);
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

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating rate card:', error);
    return NextResponse.json(
      { error: 'Failed to create rate card', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
