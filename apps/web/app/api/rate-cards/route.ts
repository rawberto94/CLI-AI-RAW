import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

// NOTE: Using direct Prisma queries instead of data-orchestration services
// The data-orchestration package has 60+ TypeScript errors that need extensive refactoring
// This bypass provides full database functionality while that work is completed

// OPTIMIZATION: Cache GET requests for 5 minutes (rate cards change infrequently)
export const revalidate = 300;

// Mock rate cards data for testing
/**
 * Mock rate card entry structure
 */
interface MockRateCard {
  id: string;
  rateCardId: string;
  originalRoleName: string;
  standardizedRole: string;
  roleCategory: string;
  seniorityLevel: string;
  serviceLine: string;
  lineOfService: string;
  country: string;
  dailyRate: number;
  currency: string;
  supplierId: string;
  supplierName: string;
  effectiveDate: string;
  expiryDate: string;
  isBaseline: boolean;
  isNegotiated: boolean;
}

/**
 * Return mock rate card data for testing
 */
function returnMockRateCards(searchParams: URLSearchParams) {
  // Get pagination params
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');
  
  const mockRateCards: MockRateCard[] = [
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
  
  // Explicitly serialize to plain object to avoid ReadableStream issues
  const responseData = {
    data: JSON.parse(JSON.stringify(paginatedData)),
    total: Number(total),
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Number(totalPages),
  };
  
  return new Response(JSON.stringify(responseData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * GET /api/rate-cards
 * List rate card entries with filtering and pagination
 * Supports both simple filters and advanced filter objects
 * Supports mock data mode via x-data-mode header
 */
export const GET = withAuthApiHandler(async (request, ctx) => {
  const ctx = getApiContext(request);
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Check data mode from header
    const dataMode = request.headers.get('x-data-mode') || 'real';
    
    // Use mock data if requested
    if (dataMode === 'mock') {
      return returnMockRateCards(searchParams);
    }
    
    // ===== REAL DATA MODE: Direct Prisma Queries =====
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
