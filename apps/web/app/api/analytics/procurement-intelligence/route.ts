import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';

type DataMode = 'real' | 'mock';
type ProviderType = 
  | 'rate-benchmarking'
  | 'supplier-analytics'
  | 'negotiation-prep'
  | 'savings-pipeline'
  | 'renewal-radar';

/**
 * Unified Procurement Intelligence API
 * Single endpoint for all procurement intelligence modules
 */

// GET /api/analytics/procurement-intelligence - Get data from any module
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const tenantId = session?.user?.tenantId;

    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get('module') as ProviderType | null;
    
    if (!moduleName) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Module parameter is required',
          availableModules: [
            'rate-benchmarking',
            'supplier-analytics',
            'negotiation-prep',
            'savings-pipeline',
            'renewal-radar'
          ]
        },
        { status: 400 }
      );
    }

    // Validate moduleName
    const validModules: ProviderType[] = [
      'rate-benchmarking',
      'supplier-analytics',
      'negotiation-prep',
      'savings-pipeline',
      'renewal-radar'
    ];

    if (!validModules.includes(moduleName)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid moduleName: ${moduleName}`,
          availableModules: validModules
        },
        { status: 400 }
      );
    }

    // Check for data mode parameter
    const dataMode = searchParams.get('mode') as DataMode | null;
    const mode: DataMode = dataMode === 'mock' ? 'mock' : 'real';

    // Build params object from all query parameters
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== 'moduleName' && key !== 'mode') {
        params[key] = value;
      }
    });

    // Get data based on moduleName and mode
    let data: unknown;
    let source: string;
    
    if (mode === 'mock') {
      // Use mock data
      switch (moduleName) {
        case 'supplier-analytics':
          data = {
            suppliers: [
              { id: '1', name: 'Acme Consulting', score: 92, spend: 450000 },
              { id: '2', name: 'Tech Solutions', score: 85, spend: 320000 },
            ],
          };
          source = 'mock-data-generator';
          break;
        case 'negotiation-prep':
          data = {
            recommendations: ['Focus on volume discounts', 'Request better payment terms'],
          };
          source = 'mock-data-generator';
          break;
        case 'savings-pipeline':
          data = {
            opportunities: [
              { id: '1', supplier: 'Acme', potential: 25000, confidence: 'high' },
            ],
          };
          source = 'mock-data-generator';
          break;
        case 'renewal-radar':
          data = {
            upcomingRenewals: [
              { contractId: 'C1', supplier: 'Acme', daysUntilRenewal: 30 },
            ],
          };
          source = 'mock-data-generator';
          break;
        case 'rate-benchmarking':
          // Rate benchmarking uses JSON file
          const rateCards = await import('@/lib/mock-data/rate-cards.json');
          data = rateCards.default;
          source = 'mock-data-file';
          break;
        default:
          throw new Error(`Mock data not implemented for moduleName: ${moduleName}`);
      }
    } else {
      // Real data mode - fetch from database
      switch (moduleName) {
        case 'supplier-analytics':
          data = await getSupplierAnalyticsReal(tenantId, params);
          source = 'database';
          break;
        case 'negotiation-prep':
          data = await getNegotiationPrepReal(tenantId, params);
          source = 'database';
          break;
        case 'savings-pipeline':
          data = await getSavingsPipelineReal(tenantId, params);
          source = 'database';
          break;
        case 'renewal-radar':
          data = await getRenewalRadarReal(tenantId, params);
          source = 'database';
          break;
        case 'rate-benchmarking':
          data = await getRateBenchmarkingReal(tenantId, params);
          source = 'database';
          break;
        default:
          throw new Error(`Real data not implemented for moduleName: ${moduleName}`);
      }
    }

    return NextResponse.json({
      success: true,
      moduleName,
      data,
      metadata: {
        source,
        mode,
        lastUpdated: new Date().toISOString(),
        recordCount: Array.isArray(data) ? data.length : 1,
        confidence: mode === 'real' ? 0.95 : 0.75,
        description: mode === 'mock' ? 'Mock data for testing' : 'Real data (fallback to mock)'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get procurement intelligence data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/procurement-intelligence - Handle actions like health checks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'health-check') {
      // Return health status for all modules
      const status = {
        'rate-benchmarking': { real: false, mock: true },
        'supplier-analytics': { real: false, mock: true },
        'negotiation-prep': { real: false, mock: true },
        'savings-pipeline': { real: false, mock: true },
        'renewal-radar': { real: false, mock: true }
      };

      return NextResponse.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get-metadata') {
      const { moduleName, mode } = body;
      
      if (!moduleName) {
        return NextResponse.json(
          { success: false, error: 'Module parameter is required' },
          { status: 400 }
        );
      }

      const metadata = {
        source: mode === 'mock' ? 'mock-data-generator' : 'mock-fallback',
        mode: mode || 'real',
        lastUpdated: new Date().toISOString(),
        recordCount: 0,
        confidence: mode === 'mock' ? 0.75 : 0.95,
        description: `${moduleName} data provider`
      };

      return NextResponse.json({
        success: true,
        data: metadata,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action specified' },
      { status: 400 }
    );

  } catch (error: unknown) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function _generateSupplierAnalyticsMock(params: Record<string, string>) {
  return {
    suppliers: [],
    params,
    note: 'Mock fallback (real mode not implemented)',
  };
}

function _generateNegotiationPrepMock(params: Record<string, string>) {
  return {
    recommendations: [],
    params,
    note: 'Mock fallback (real mode not implemented)',
  };
}

function _generateSavingsPipelineMock(params: Record<string, string>) {
  return {
    opportunities: [],
    params,
    note: 'Mock fallback (real mode not implemented)',
  };
}

function _generateRenewalRadarMock(params: Record<string, string>) {
  return {
    upcomingRenewals: [],
    params,
    note: 'Mock fallback (real mode not implemented)',
  };
}

// =============================================================================
// Real Data Providers
// =============================================================================

async function getSupplierAnalyticsReal(tenantId: string | undefined, params: Record<string, string>) {
  const where: Record<string, unknown> = {};
  if (tenantId) where.tenantId = tenantId;

  // Get suppliers with their contract counts and total values
  const suppliers = await prisma.party.findMany({
    where: {
      ...where,
      type: 'VENDOR',
    },
    include: {
      _count: {
        select: { supplierContracts: true },
      },
    },
    take: parseInt(params.limit || '50'),
  });

  // Get spend data from contracts
  const spendBySupplier = await prisma.contract.groupBy({
    by: ['supplierId'],
    where: tenantId ? { tenantId } : {},
    _sum: { totalValue: true },
    _count: { id: true },
  });

  const spendMap = new Map(spendBySupplier.map(s => [s.supplierId, s]));

  return {
    suppliers: suppliers.map(s => ({
      id: s.id,
      name: s.name,
      contractCount: s._count.supplierContracts,
      totalSpend: spendMap.get(s.id)?._sum.totalValue || 0,
      type: s.type,
    })),
    totalSuppliers: suppliers.length,
  };
}

async function getNegotiationPrepReal(tenantId: string | undefined, params: Record<string, string>) {
  const contractId = params.contractId;
  
  if (contractId) {
    // Get specific contract with related data
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        ...(tenantId ? { tenantId } : {}),
      },
      include: {
        supplier: true,
        rateCardEntries: true,
      },
    });

    if (!contract) {
      return { recommendations: [], error: 'Contract not found' };
    }

    // Get benchmark data for similar contracts
    const benchmarks = await prisma.benchmarkSnapshot.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { snapshotDate: 'desc' },
      take: 5,
    });

    return {
      contract: {
        id: contract.id,
        title: contract.contractTitle,
        supplier: contract.supplier?.name,
        totalValue: contract.totalValue,
      },
      benchmarks: benchmarks.map(b => ({
        median: b.median,
        p25: b.percentile25,
        p75: b.percentile75,
      })),
      recommendations: [
        'Review rate benchmarks before negotiation',
        'Consider volume discount opportunities',
        'Evaluate payment term flexibility',
      ],
    };
  }

  return { recommendations: [], note: 'Provide contractId parameter for specific recommendations' };
}

async function getSavingsPipelineReal(tenantId: string | undefined, _params: Record<string, string>) {
  // Get savings opportunities from database
  const opportunities = await prisma.rateSavingsOpportunity.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      status: { in: ['IDENTIFIED', 'IN_PROGRESS'] },
    },
    orderBy: { annualSavingsPotential: 'desc' },
    take: 20,
    include: {
      rateCardEntry: {
        select: {
          roleStandardized: true,
          supplierName: true,
        },
      },
    },
  });

  const totalPotential = opportunities.reduce((sum, o) => sum + Number(o.annualSavingsPotential || 0), 0);

  return {
    opportunities: opportunities.map(o => ({
      id: o.id,
      title: o.title,
      category: o.category,
      potential: o.annualSavingsPotential,
      confidence: o.confidence,
      status: o.status,
      supplier: o.rateCardEntry?.supplierName,
      role: o.rateCardEntry?.roleStandardized,
    })),
    totalPotentialSavings: totalPotential,
    opportunityCount: opportunities.length,
  };
}

async function getRenewalRadarReal(tenantId: string | undefined, params: Record<string, string>) {
  const daysAhead = parseInt(params.days || '90');
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const renewals = await prisma.contract.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      endDate: {
        gte: new Date(),
        lte: futureDate,
      },
      status: { in: ['ACTIVE', 'COMPLETED'] },
    },
    orderBy: { endDate: 'asc' },
    include: {
      supplier: { select: { name: true } },
    },
    take: 50,
  });

  return {
    upcomingRenewals: renewals.map(r => ({
      contractId: r.id,
      title: r.contractTitle,
      supplier: r.supplier?.name || 'Unknown',
      endDate: r.endDate,
      daysUntilRenewal: r.endDate ? Math.ceil((r.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
      totalValue: r.totalValue,
      status: r.status,
    })),
    totalUpcoming: renewals.length,
    withinPeriodDays: daysAhead,
  };
}

async function getRateBenchmarkingReal(tenantId: string | undefined, params: Record<string, string>) {
  const role = params.role;
  const country = params.country;

  const where: Record<string, unknown> = {};
  if (tenantId) where.tenantId = tenantId;
  if (role) where.roleStandardized = role;
  if (country) where.country = country;

  // Get rate card entries with aggregations
  const rateCards = await prisma.rateCardEntry.findMany({
    where,
    orderBy: { effectiveDate: 'desc' },
    take: parseInt(params.limit || '100'),
  });

  // Calculate statistics
  const rates = rateCards.map(r => Number(r.dailyRateUSD)).filter(r => r > 0);
  const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const sorted = [...rates].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  return {
    rateCards: rateCards.slice(0, 20).map(r => ({
      id: r.id,
      role: r.roleStandardized,
      seniority: r.seniority,
      supplier: r.supplierName,
      dailyRate: r.dailyRateUSD,
      country: r.country,
      effectiveDate: r.effectiveDate,
    })),
    statistics: {
      count: rates.length,
      average: Math.round(avg * 100) / 100,
      median: Math.round(median * 100) / 100,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
    },
    filters: { role, country },
  };
}
