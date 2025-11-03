import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/rate-cards/comparisons/[id]/export
 * Export comparison to PDF
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'pdf';

    // Fetch the comparison with all details
    const comparison = await prisma.rateComparison.findUnique({
      where: { id: params.id },
      include: {
        rateCardEntries: {
          include: {
            rateCardEntry: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!comparison) {
      return NextResponse.json(
        { error: 'Comparison not found' },
        { status: 404 }
      );
    }

    // For now, return JSON data that can be used by client-side PDF generation
    // In production, you might want to use a library like puppeteer or pdfkit
    if (format === 'json') {
      return NextResponse.json({ comparison });
    }

    // Generate CSV format
    if (format === 'csv') {
      const rateCards = comparison.rateCardEntries.map(entry => entry.rateCardEntry);
      const lowestRate = Math.min(...rateCards.map(rc => rc.dailyRateUSD));

      const csvRows = [
        // Header
        [
          'Supplier',
          'Role',
          'Seniority',
          'Country',
          'Daily Rate (USD)',
          'Variance from Best (%)',
          'Daily Savings vs Best',
          'Line of Service',
          'Effective Date',
          'Source',
        ].join(','),
        // Data rows
        ...rateCards.map(rc => {
          const variance = ((rc.dailyRateUSD - lowestRate) / lowestRate) * 100;
          const savings = rc.dailyRateUSD - lowestRate;
          return [
            rc.supplierName,
            rc.roleStandardized,
            rc.seniority,
            rc.country,
            rc.dailyRateUSD,
            variance.toFixed(2),
            savings.toFixed(2),
            rc.lineOfService,
            new Date(rc.effectiveDate).toISOString().split('T')[0],
            rc.source,
          ].join(',');
        }),
      ];

      const csv = csvRows.join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="rate-comparison-${params.id}.csv"`,
        },
      });
    }

    // For PDF, return the data that can be used by client-side PDF generation
    return NextResponse.json({ 
      comparison,
      message: 'Use client-side PDF generation with this data',
    });

  } catch (error) {
    console.error('Error exporting comparison:', error);
    return NextResponse.json(
      { error: 'Failed to export comparison', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
