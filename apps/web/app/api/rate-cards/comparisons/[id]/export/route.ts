import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/security/tenant';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { rateCardBenchmarkingService } from 'data-orchestration/services';

/**
 * GET /api/rate-cards/comparisons/[id]/export
 * Export comparison to PDF
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'pdf';

    // Fetch the comparison with all details - tenant isolated
    const comparison = await prisma.rateComparison.findUnique({
      where: { id: params.id, tenantId },
      include: {
        targetRate: true,
      },
    });

    if (!comparison) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Comparison not found', 404);
    }

    // For now, return JSON data that can be used by client-side PDF generation
    // In production, you might want to use a library like puppeteer or pdfkit
    if (format === 'json') {
      return createSuccessResponse(ctx, { comparison });
    }

    // Generate CSV format
    if (format === 'csv') {
      // Get comparison rates from the JSON field
      const rateCards = Array.isArray(comparison.comparisonRates) ? comparison.comparisonRates : [];
      const lowestRate = 0; // Would need to fetch actual rate data

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
          const rcData = rc as any; // Cast JsonValue to any for CSV export
          const variance = ((rcData.dailyRateUSD - lowestRate) / lowestRate) * 100;
          const savings = rcData.dailyRateUSD - lowestRate;
          return [
            rcData.supplierName,
            rcData.roleStandardized,
            rcData.seniority,
            rcData.country,
            rcData.dailyRateUSD,
            variance.toFixed(2),
            savings.toFixed(2),
            rcData.lineOfService,
            new Date(rcData.effectiveDate).toISOString().split('T')[0],
            rcData.source,
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
    return createSuccessResponse(ctx, { 
      comparison,
      message: 'Use client-side PDF generation with this data',
    });

  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to export comparison. Please try again.', 500);
  }
}
