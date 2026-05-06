import { NextRequest } from 'next/server';
import { currencyAdvancedService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const baseCurrency = searchParams.get('baseCurrency') || 'USD';
  const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    // Detect currency volatility
    const volatilityAlerts = await currencyAdvancedService.detectVolatility(baseCurrency);

    // Get affected rates for tenant
    const affectedRates = await currencyAdvancedService.getRatesAffectedByVolatility(tenantId);

    return createSuccessResponse(ctx, {
      baseCurrency,
      alertCount: volatilityAlerts.length,
      alerts: volatilityAlerts,
      affectedRates: affectedRates.length,
      affectedRateDetails: affectedRates,
    });
  });
