import { NextRequest } from 'next/server';
import { pppAdjustmentService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { rate, fromCountry, toCountry } = body;

    if (!rate || !fromCountry) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required parameters: rate, fromCountry', 400);
    }

    const adjusted = pppAdjustmentService.adjustRateForPPP(
      rate,
      fromCountry,
      toCountry || 'USA'
    );

    return createSuccessResponse(ctx, adjusted);
  });

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    if (action === 'factors') {
      // Get all PPP factors
      const factors = pppAdjustmentService.getAllPPPFactors();
      return createSuccessResponse(ctx, { factors });
    }

    if (action === 'compare') {
      // Compare two rates with PPP adjustment
      const rate1 = parseFloat(searchParams.get('rate1') || '0');
      const country1 = searchParams.get('country1');
      const rate2 = parseFloat(searchParams.get('rate2') || '0');
      const country2 = searchParams.get('country2');

      if (!rate1 || !country1 || !rate2 || !country2) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required parameters for comparison', 400);
      }

      const comparison = pppAdjustmentService.compareRatesWithPPP(
        { value: rate1, country: country1 },
        { value: rate2, country: country2 }
      );

      return createSuccessResponse(ctx, comparison);
    }

    return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action parameter', 400);
  });
