import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RateCardEntryService } from 'data-orchestration/services';
import { AdvancedFilterService } from 'data-orchestration/services';

const rateCardService = new RateCardEntryService(prisma);
const advancedFilterService = new AdvancedFilterService(prisma);

// Mock rate cards data
function returnMockRateCards(searchParams: URLSearchParams) {
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 50;
  
  const mockRateCards = [
    {
      id: "rate-acc-se1",
      rateCardId: "card-acc-001",
      originalRoleName: "Senior Software Engineer",
      standardizedRole: "Software Engineer",
      roleCategory: "Technology",
      seniorityLevel: "SENIOR",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "United States",
      dailyRate: 1200,
      currency: "USD",
      supplierId: "sup-acc",
      supplierName: "Accenture",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: true,
      isNegotiated: true,
    },
    {
      id: "rate-acc-arch1",
      rateCardId: "card-acc-001",
      originalRoleName: "Principal Architect",
      standardizedRole: "Solution Architect",
      roleCategory: "Technology",
      seniorityLevel: "PRINCIPAL",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "United States",
      dailyRate: 1800,
      currency: "USD",
      supplierId: "sup-acc",
      supplierName: "Accenture",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: true,
      isNegotiated: false,
    },
    {
      id: "rate-acc-ds1",
      rateCardId: "card-acc-001",
      originalRoleName: "Data Scientist",
      standardizedRole: "Data Scientist",
      roleCategory: "Data",
      seniorityLevel: "SENIOR",
      serviceLine: "Data & Analytics",
      lineOfService: "Data & Analytics",
      country: "United States",
      dailyRate: 1400,
      currency: "USD",
      supplierId: "sup-acc",
      supplierName: "Accenture",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: false,
      isNegotiated: true,
    },
    {
      id: "rate-acc-devops1",
      rateCardId: "card-acc-001",
      originalRoleName: "DevOps Engineer",
      standardizedRole: "DevOps Engineer",
      roleCategory: "Technology",
      seniorityLevel: "MID",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "United States",
      dailyRate: 1000,
      currency: "USD",
      supplierId: "sup-acc",
      supplierName: "Accenture",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: false,
      isNegotiated: false,
    },
    {
      id: "rate-tw-fs1",
      rateCardId: "card-tw-001",
      originalRoleName: "Full Stack Developer",
      standardizedRole: "Software Engineer",
      roleCategory: "Technology",
      seniorityLevel: "SENIOR",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "United States",
      dailyRate: 950,
      currency: "USD",
      supplierId: "sup-tw",
      supplierName: "Thoughtworks",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: true,
      isNegotiated: true,
    },
    {
      id: "rate-tw-tl1",
      rateCardId: "card-tw-001",
      originalRoleName: "Tech Lead",
      standardizedRole: "Technical Lead",
      roleCategory: "Technology",
      seniorityLevel: "SENIOR",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "United States",
      dailyRate: 1300,
      currency: "USD",
      supplierId: "sup-tw",
      supplierName: "Thoughtworks",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: false,
      isNegotiated: true,
    },
    {
      id: "rate-inf-dev1",
      rateCardId: "card-inf-001",
      originalRoleName: "Senior Developer",
      standardizedRole: "Software Engineer",
      roleCategory: "Technology",
      seniorityLevel: "SENIOR",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "India",
      dailyRate: 650,
      currency: "USD",
      supplierId: "sup-inf",
      supplierName: "Infosys",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: false,
      isNegotiated: false,
    },
    {
      id: "rate-inf-arch1",
      rateCardId: "card-inf-001",
      originalRoleName: "Solution Architect",
      standardizedRole: "Solution Architect",
      roleCategory: "Technology",
      seniorityLevel: "PRINCIPAL",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "India",
      dailyRate: 850,
      currency: "USD",
      supplierId: "sup-inf",
      supplierName: "Infosys",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: true,
      isNegotiated: false,
    },
    {
      id: "rate-del-dev1",
      rateCardId: "card-del-001",
      originalRoleName: "Senior Developer",
      standardizedRole: "Software Engineer",
      roleCategory: "Technology",
      seniorityLevel: "SENIOR",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "United States",
      dailyRate: 1150,
      currency: "USD",
      supplierId: "sup-del",
      supplierName: "Deloitte",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: false,
      isNegotiated: true,
    },
    {
      id: "rate-del-arch1",
      rateCardId: "card-del-001",
      originalRoleName: "Lead Architect",
      standardizedRole: "Solution Architect",
      roleCategory: "Technology",
      seniorityLevel: "PRINCIPAL",
      serviceLine: "Technology",
      lineOfService: "Technology",
      country: "United States",
      dailyRate: 1650,
      currency: "USD",
      supplierId: "sup-del",
      supplierName: "Deloitte",
      effectiveDate: "2024-01-01",
      expiryDate: "2025-12-31",
      isBaseline: true,
      isNegotiated: true,
    },
  ];
  
  const total = mockRateCards.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedData = mockRateCards.slice(start, end);
  
  return NextResponse.json({
    data: paginatedData,
    total,
    page,
    pageSize,
    totalPages,
  });
}

/**
 * GET /api/rate-cards
 * List rate card entries with filtering and pagination
 * Supports both simple filters and advanced filter objects
 * Supports mock data mode via x-data-mode header
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Check data mode from header
    const dataMode = request.headers.get('x-data-mode') || 'real';
    
    // If mock mode, return mock data
    if (dataMode === 'mock') {
      return returnMockRateCards(searchParams);
    }
    
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
