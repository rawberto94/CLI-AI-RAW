import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';

// NOTE: Using direct Prisma queries instead of data-orchestration services
// The data-orchestration package has 60+ TypeScript errors that need extensive refactoring
// This bypass provides full database functionality while that work is completed

// OPTIMIZATION: Cache GET requests for 5 minutes (rate cards change infrequently)
export const revalidate = 300;

// Mock rate cards data for testing
/**
 * Return mock rate card data for testing
 */
function returnMockRateCards(searchParams: URLSearchParams) {
  // Get pagination params
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');
  
  const mockRateCards: any[] = [
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
export async function GET(request: NextRequest) {
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
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || searchParams.get('tenantId') || 'default-tenant';
    
    // Build where clause from filters
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
    const deduplicatedData = rateCards.reduce((acc: any[], card: any) => {
      const key = `${card.roleStandardized || card.roleOriginal}-${card.seniority}-${card.dailyRate}-${card.supplierName}`;
      const exists = acc.some(existing => 
        `${existing.roleStandardized || existing.roleOriginal}-${existing.seniority}-${existing.dailyRate}-${existing.supplierName}` === key
      );
      if (!exists) {
        acc.push(card);
      }
      return acc;
    }, []);

    return NextResponse.json({
      data: deduplicatedData,
      total: deduplicatedData.length,
      originalTotal: total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
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
    
    // Get authenticated user from session
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId || body.tenantId || 'default-tenant';
    const userId = session?.user?.id || body.userId || 'system';

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

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating rate card:', error);
    return NextResponse.json(
      { error: 'Failed to create rate card', details: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
