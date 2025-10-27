/**
 * Rate Card Export API
 * 
 * Export filtered rate cards to CSV, Excel, or PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/rate-cards/export
 * Export rate cards based on filters
 * 
 * Body:
 * - format: 'csv' | 'excel' | 'pdf'
 * - filters: RateCardFilterCriteria
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { format = 'csv', filters = {} } = body;

    // Build WHERE clause based on filters
    const conditions: string[] = [`"tenantId" = '${session.user.tenantId}'`];
    
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

    // Fetch rate cards
    const rateCards = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
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
        "isNegotiated",
        "createdAt"
      FROM "rate_card_entries"
      WHERE ${whereClause}
      ORDER BY "createdAt" DESC
    `);

    if (format === 'csv') {
      return exportToCSV(rateCards);
    } else if (format === 'excel') {
      return exportToExcel(rateCards);
    } else if (format === 'pdf') {
      return exportToPDF(rateCards);
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
 * Export to CSV format
 */
function exportToCSV(rateCards: any[]): NextResponse {
  const headers = [
    'ID',
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
    'Negotiated',
    'Created At',
  ];

  const rows = rateCards.map(rc => [
    rc.id,
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
    rc.isNegotiated ? 'Yes' : 'No',
    new Date(rc.createdAt).toISOString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

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
function exportToExcel(rateCards: any[]): NextResponse {
  // For now, return CSV with Excel-friendly formatting
  const csvResponse = exportToCSV(rateCards);
  
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
function exportToPDF(rateCards: any[]): NextResponse {
  const content = `
Rate Card Export Report
Generated: ${new Date().toLocaleString()}
Total Records: ${rateCards.length}

${rateCards.map((rc, index) => `
${index + 1}. ${rc.roleStandardized} - ${rc.supplierName}
   Seniority: ${rc.seniority}
   Location: ${rc.country}, ${rc.region}
   Rate: $${rc.dailyRateUSD}/day (${rc.currency} ${rc.dailyRate})
   Effective: ${rc.effectiveDate ? new Date(rc.effectiveDate).toLocaleDateString() : 'N/A'}
   Market Position: ${rc.percentileRank ? `${rc.percentileRank}th percentile` : 'N/A'}
   ${rc.savingsAmount ? `Potential Savings: $${rc.savingsAmount}/day` : ''}
`).join('\n')}
  `.trim();

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rate-cards-${new Date().toISOString().split('T')[0]}.pdf"`,
    },
  });
}
