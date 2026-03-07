import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { enhancedRateAnalyticsService } from 'data-orchestration/services';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const tenantId = ctx.tenantId;

    // Require tenant ID for security
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID is required', 400);
    }

    // Get total rate cards tracked
    const totalRateCards = await prisma.rateCardEntry.count({
      where: { tenantId },
    });

    // Get total suppliers
    const totalSuppliers = await prisma.rateCardSupplier.count({
      where: { tenantId },
    });

    // Get geographic coverage (unique countries)
    const geographicCoverage = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: { country: true },
      distinct: ['country'],
    });

    // Get service line coverage (unique lines of service)
    const serviceLineCoverage = await prisma.rateCardEntry.findMany({
      where: { tenantId },
      select: { lineOfService: true },
      distinct: ['lineOfService'],
    });

    return createSuccessResponse(ctx, {
      totalRateCards,
      totalSuppliers,
      geographicCoverage: geographicCoverage.length,
      serviceLineCoverage: serviceLineCoverage.length,
      countries: geographicCoverage.map(g => g.country).filter(Boolean),
      serviceLines: serviceLineCoverage.map(s => s.lineOfService).filter(Boolean),
    });
  });
