import { NextRequest } from 'next/server';
import { analyticalIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const contractId = searchParams.get('contractId');
  const supplierId = searchParams.get('supplierId');

  const rateCardEngine = analyticalIntelligenceService.getRateCardEngine();

  switch (action) {
    case 'parse':
      if (!contractId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID required', 400);
      }
      const parseResult = await rateCardEngine.parseRateCards(contractId);
      return createSuccessResponse(ctx, parseResult);

    case 'report':
      if (!supplierId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Supplier ID required', 400);
      }
      const report = await rateCardEngine.generateRateCardReport(supplierId);
      return createSuccessResponse(ctx, report);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { action, rates, cohort: _cohort, currentRates, benchmarks: _benchmarks } = body;

  const rateCardEngine = analyticalIntelligenceService.getRateCardEngine();

  switch (action) {
    case 'calculate-benchmarks':
      if (!rates) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Rates required', 400);
      }
      const benchmarkResult = await rateCardEngine.calculateBenchmarks(rates);
      return createSuccessResponse(ctx, benchmarkResult);

    case 'estimate-savings':
      if (!currentRates) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Current rates required', 400);
      }
      const savingsResult = await rateCardEngine.estimateSavings(currentRates);
      return createSuccessResponse(ctx, savingsResult);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});
