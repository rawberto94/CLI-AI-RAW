/**
 * Rate Card Export API
 * 
 * Export filtered rate cards to CSV, Excel, or PDF with filter metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      format = 'csv', 
      filters = {}, 
      advancedFilter = null,
      includeFilterMetadata = true,
      tenantId = 'default-tenant'
    } = body;

    // Build WHERE clause based on filters
    const conditions: string[] = [`"tenantId" = '${tenantId}'`];
    
    if (filters.supplier) {
      conditions.push(`"supplierName" ILIKE '%${filters.supplier}%'`);
    }
    if (filters.role) {
      conditions.push(`"roleStandardized" ILIKE '%${filters.role}%'`);
    }
    if (filters.seniority) {
      conditions.push(`"seniority" = '${filters.seniority}'`);
    }
    if (filters.lineOfService) {
      conditions.push(`"lineOfService" = '${filters.lineOfService}'`);
    }
    if (filters.country) {
      conditions.push(`"country" = '${filters.country}'`);
    }
    if (filters.region) {
      conditions.push(`"region" = '${filters.region}'`);
    }
    if (filters.dateFrom) {
      conditions.push(`"effectiveDate" >= '${filters.dateFrom}'`);
    }
    if (filters.dateTo) {
      conditions.push(`"effectiveDate" <= '${filters.dateTo}'`);
    }
    if (filters.rateMin) {
      conditions.push(`"dailyRateUSD" >= ${filters.rateMin}`);
    }
    if (filters.rateMax) {
      conditions.push(`"dailyRateUSD" <= ${filters.rateMax}`);
    }

    const whereClause = conditions.join(' AND ');

    // Fetch rate cards with new fields
    const rateCards = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
        "clientName",
        "clientId",
        "supplierName",
        "roleOriginal",
        "roleStandardized",
        "seniority",
        "lineOfService",
        "country",
        "region",
        "dailyRate",
        "currency",
        "dailyRateUSD",
        "dailyRateCHF",
        "effectiveDate",
        "expiryDate",
        "volumeCommitted",
        "marketRateMedian",
        "percentileRank",
        "savingsAmount",
        "isBaseline",
        "baselineType",
        "isNegotiated",
        "negotiationDate",
        "negotiatedBy",
        "msaReference",
        "isEditable",
        "editedBy",
        "editedAt",
        "createdAt"
      FROM "RateCardEntry"
      WHERE ${whereClause}
      ORDER BY "createdAt" DESC
    `);

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

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  } catch (error) {
    console.error('Error exporting rate cards:', error);
    return NextResponse.json(
      { error: 'Failed to export rate cards' },
      { status: 500 }
    );
  }
}

/**
 * Generate human-readable filter summary
 */
function generateFilterSummary(filters: any): string {
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
function exportToCSV(rateCards: any[], filterMetadata: any = null): NextResponse {
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
 * Export to Excel format (simplified - returns CSV with .xlsx extension)
 * For full Excel support, would need a library like exceljs
 */
function exportToExcel(rateCards: any[], filterMetadata: any = null): NextResponse {
  // For now, return CSV with Excel-friendly formatting
  const csvResponse = exportToCSV(rateCards, filterMetadata);
  
  return new NextResponse(csvResponse.body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rate-cards-${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  });
}

/**
 * Export to PDF format (simplified - returns text)
 * For full PDF support, would need a library like pdfkit or puppeteer
 */
function exportToPDF(rateCards: any[], filterMetadata: any = null): NextResponse {
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
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rate-cards-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
