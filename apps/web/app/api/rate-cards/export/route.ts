/**
 * Rate Card Export API
 * 
 * Export filtered rate cards to CSV, Excel, or PDF with filter metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { rateCardManagementService } from 'data-orchestration/services';

/**
 * Rate card filter types
 */
interface RateCardFilters {
  supplier?: string;
  role?: string;
  seniority?: string;
  lineOfService?: string;
  country?: string;
  region?: string;
  dateFrom?: string;
  dateTo?: string;
  rateMin?: string;
  rateMax?: string;
  rootGroup?: unknown; // For advanced filter
}

/**
 * Rate card export entry
 */
interface RateCardExportEntry {
  id: string;
  clientName: string | null;
  clientId: string | null;
  supplierName: string | null;
  roleOriginal: string | null;
  roleStandardized: string | null;
  seniority: string | null;
  lineOfService: string | null;
  country: string | null;
  region: string | null;
  dailyRate: Prisma.Decimal | number | null;
  currency: string | null;
  dailyRateUSD: Prisma.Decimal | number | null;
  dailyRateCHF: Prisma.Decimal | number | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  volumeCommitted: Prisma.Decimal | number | null;
  marketRateMedian: Prisma.Decimal | number | null;
  percentileRank: Prisma.Decimal | number | null;
  savingsAmount: Prisma.Decimal | number | null;
  isBaseline: boolean | null;

  baselineType?: string | null;
  isNegotiated?: boolean | null;
  negotiationDate?: Date | string | null;
  negotiatedBy?: string | null;
  msaReference?: string | null;
  isEditable?: boolean | null;
  editedBy?: string | null;
  editedAt?: Date | string | null;
  createdAt: Date | string;
}

/**
 * Filter metadata for export
 */
interface FilterMetadata {
  exportDate: string;
  totalRecords: number;
  filterSummary: string;
  filters: RateCardFilters;
  advancedFilter?: unknown;
}

/**
 * POST /api/rate-cards/export
 * Export rate cards based on filters
 * 
 * Body:
 * - format: 'csv' | 'excel' | 'pdf'
 * - filters: RateCardFilterCriteria
 * - advancedFilter: AdvancedFilter (optional)
 * - includeFilterMetadata: boolean (default: true)
 * - tenantId: string
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    const body = await request.json();
    const { 
      format = 'csv', 
      filters = {}, 
      advancedFilter = null,
      includeFilterMetadata = true
    } = body;

    // Build WHERE clause using Prisma's safe ORM (no raw SQL injection)
    const whereClause: Prisma.RateCardEntryWhereInput = { tenantId };
    
    if (filters.supplier) {
      whereClause.supplierName = { contains: filters.supplier, mode: 'insensitive' };
    }
    if (filters.role) {
      whereClause.roleStandardized = { contains: filters.role, mode: 'insensitive' };
    }
    if (filters.seniority) {
      whereClause.seniority = filters.seniority;
    }
    if (filters.lineOfService) {
      whereClause.lineOfService = filters.lineOfService;
    }
    if (filters.country) {
      whereClause.country = filters.country;
    }
    if (filters.region) {
      whereClause.region = filters.region;
    }
    if (filters.dateFrom || filters.dateTo) {
      whereClause.effectiveDate = {};
      if (filters.dateFrom) {
        whereClause.effectiveDate.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        whereClause.effectiveDate.lte = new Date(filters.dateTo);
      }
    }
    if (filters.rateMin || filters.rateMax) {
      whereClause.dailyRateUSD = {};
      if (filters.rateMin) {
        whereClause.dailyRateUSD.gte = parseFloat(filters.rateMin);
      }
      if (filters.rateMax) {
        whereClause.dailyRateUSD.lte = parseFloat(filters.rateMax);
      }
    }

    // Fetch rate cards with safe ORM query
    const rateCards = await prisma.rateCardEntry.findMany({
      where: whereClause,
      select: {
        id: true,
        clientName: true,
        clientId: true,
        supplierName: true,
        roleOriginal: true,
        roleStandardized: true,
        seniority: true,
        lineOfService: true,
        country: true,
        region: true,
        dailyRate: true,
        currency: true,
        dailyRateUSD: true,
        dailyRateCHF: true,
        effectiveDate: true,
        expiryDate: true,
        volumeCommitted: true,
        marketRateMedian: true,
        percentileRank: true,
        savingsAmount: true,
        isBaseline: true,
        baselineType: true,
        isNegotiated: true,
        negotiationDate: true,
        negotiatedBy: true,
        msaReference: true,
        isEditable: true,
        editedBy: true,
        editedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Prepare filter metadata
    const filterMetadata = includeFilterMetadata ? {
      exportDate: new Date().toISOString(),
      totalRecords: rateCards.length,
      filters: advancedFilter || filters,
      filterSummary: generateFilterSummary(advancedFilter || filters),
    } : null;

    if (format === 'csv') {
      return exportToCSV(rateCards, filterMetadata);
    } else if (format === 'excel') {
      return exportToExcel(rateCards, filterMetadata);
    } else if (format === 'pdf') {
      return exportToPDF(rateCards, filterMetadata);
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid format', 400);
  });

/**
 * Generate human-readable filter summary
 */
function generateFilterSummary(filters: RateCardFilters | null): string {
  if (!filters) return 'No filters applied';

  // Handle advanced filter
  if (filters.rootGroup) {
    return 'Advanced filter applied (see filter details)';
  }

  // Handle simple filters
  const parts: string[] = [];
  
  if (filters.supplier) parts.push(`Supplier: ${filters.supplier}`);
  if (filters.role) parts.push(`Role: ${filters.role}`);
  if (filters.seniority) parts.push(`Seniority: ${filters.seniority}`);
  if (filters.lineOfService) parts.push(`Service: ${filters.lineOfService}`);
  if (filters.country) parts.push(`Country: ${filters.country}`);
  if (filters.region) parts.push(`Region: ${filters.region}`);
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom || 'start';
    const to = filters.dateTo || 'end';
    parts.push(`Date: ${from} to ${to}`);
  }
  if (filters.rateMin || filters.rateMax) {
    const min = filters.rateMin || '0';
    const max = filters.rateMax || '∞';
    parts.push(`Rate: $${min} - $${max}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'No filters applied';
}

/**
 * Export to CSV format
 */
function exportToCSV(rateCards: RateCardExportEntry[], filterMetadata: FilterMetadata | null = null): NextResponse {
  const lines: string[] = [];

  // Add filter metadata as comments
  if (filterMetadata) {
    lines.push(`# Rate Card Export`);
    lines.push(`# Export Date: ${new Date(filterMetadata.exportDate).toLocaleString()}`);
    lines.push(`# Total Records: ${filterMetadata.totalRecords}`);
    lines.push(`# Filters Applied: ${filterMetadata.filterSummary}`);
    lines.push('');
  }

  const headers = [
    'ID',
    'Client Name',
    'Client ID',
    'Supplier',
    'Role (Original)',
    'Role (Standardized)',
    'Seniority',
    'Line of Service',
    'Country',
    'Region',
    'Daily Rate',
    'Currency',
    'Daily Rate (USD)',
    'Daily Rate (CHF)',
    'Effective Date',
    'Expiry Date',
    'Volume Committed',
    'Market Median',
    'Percentile Rank',
    'Savings Amount',
    'Is Baseline',
    'Baseline Type',
    'Is Negotiated',
    'Negotiation Date',
    'Negotiated By',
    'MSA Reference',
    'Editable',
    'Last Edited By',
    'Last Edited At',
    'Created At',
  ];

  const rows = rateCards.map(rc => [
    rc.id,
    rc.clientName || '',
    rc.clientId || '',
    rc.supplierName,
    rc.roleOriginal,
    rc.roleStandardized,
    rc.seniority,
    rc.lineOfService,
    rc.country,
    rc.region,
    rc.dailyRate,
    rc.currency,
    rc.dailyRateUSD,
    rc.dailyRateCHF,
    rc.effectiveDate ? new Date(rc.effectiveDate).toISOString().split('T')[0] : '',
    rc.expiryDate ? new Date(rc.expiryDate).toISOString().split('T')[0] : '',
    rc.volumeCommitted || '',
    rc.marketRateMedian || '',
    rc.percentileRank || '',
    rc.savingsAmount || '',
    rc.isBaseline ? 'Yes' : 'No',
    rc.baselineType || '',
    rc.isNegotiated ? 'Yes' : 'No',
    rc.negotiationDate ? new Date(rc.negotiationDate).toISOString().split('T')[0] : '',
    rc.negotiatedBy || '',
    rc.msaReference || '',
    rc.isEditable ? 'Yes' : 'No',
    rc.editedBy || '',
    rc.editedAt ? new Date(rc.editedAt).toISOString() : '',
    new Date(rc.createdAt).toISOString(),
  ]);

  lines.push(headers.join(','));
  lines.push(...rows.map(row => row.map(cell => `"${cell}"`).join(',')));

  const csvContent = lines.join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="rate-cards-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

/**
 * Export to Excel format (returns CSV — install exceljs for native xlsx)
 */
function exportToExcel(rateCards: RateCardExportEntry[], filterMetadata: FilterMetadata | null = null): NextResponse {
  const csvResponse = exportToCSV(rateCards, filterMetadata);
  
  return new NextResponse(csvResponse.body, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="rate-cards-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}

/**
 * Export to PDF format (simplified - returns text)
 * For full PDF support, would need a library like pdfkit or puppeteer
 */
function exportToPDF(rateCards: RateCardExportEntry[], filterMetadata: FilterMetadata | null = null): NextResponse {
  let content = `Rate Card Export Report
Generated: ${new Date().toLocaleString()}
Total Records: ${rateCards.length}
`;

  if (filterMetadata) {
    content += `Filter Summary: ${filterMetadata.filterSummary}
`;
  }

  content += `
${rateCards.map((rc, index) => `
${index + 1}. ${rc.roleStandardized} - ${rc.supplierName}
   Seniority: ${rc.seniority}
   Location: ${rc.country}, ${rc.region}
   Rate: $${rc.dailyRateUSD}/day (${rc.currency} ${rc.dailyRate})
   Effective: ${rc.effectiveDate ? new Date(rc.effectiveDate).toLocaleDateString() : 'N/A'}
   Market Position: ${rc.percentileRank ? `${rc.percentileRank}th percentile` : 'N/A'}
   ${rc.savingsAmount ? `Potential Savings: $${rc.savingsAmount}/day` : ''}
`).join('\n')}`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="rate-cards-${new Date().toISOString().split('T')[0]}.txt"`,
    },
  });
}
