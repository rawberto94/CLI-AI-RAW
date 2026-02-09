import { NextRequest } from 'next/server';
import { analyticalIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const supplierId = searchParams.get('supplierId');

  const spendEngine = analyticalIntelligenceService.getSpendEngine();

  switch (action) {
    case 'efficiency':
      if (!supplierId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Supplier ID required', 400);
      }
      const efficiency = await spendEngine.calculateEfficiency(supplierId);
      return createSuccessResponse(ctx, efficiency);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { action, source, spendData, mappings } = body;

  const spendEngine = analyticalIntelligenceService.getSpendEngine();

  switch (action) {
    case 'integrate':
      if (!source) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Data source required', 400);
      }
      const integrationResult = await spendEngine.integrateSpendData(source);
      return createSuccessResponse(ctx, integrationResult);

    case 'map':
      if (!spendData) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Spend data required', 400);
      }
      const mappingResult = await spendEngine.mapSpendToContracts(spendData);
      return createSuccessResponse(ctx, mappingResult);

    case 'analyze':
      if (!mappings) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Mappings required', 400);
      }
      const analysisResult = await spendEngine.analyzeVariances(mappings);
      return createSuccessResponse(ctx, analysisResult);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});
