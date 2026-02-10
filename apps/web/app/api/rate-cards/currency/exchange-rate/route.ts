import { NextRequest } from 'next/server';
import { currencyAdvancedService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const date = searchParams.get('date');

    if (!from || !to) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required parameters: from, to', 400);
    }

    let rate: number;
    let timestamp: Date;

    if (date) {
      // Historical rate
      const historicalDate = new Date(date);
      rate = await currencyAdvancedService.getHistoricalRate(from, to, historicalDate);
      timestamp = historicalDate;
    } else {
      // Current rate
      rate = await currencyAdvancedService.getExchangeRate(from, to);
      timestamp = new Date();
    }

    return createSuccessResponse(ctx, {
      from,
      to,
      rate,
      timestamp,
      source: 'exchangerate-api.io',
    });
  });
