import { NextRequest } from 'next/server';
import { analyticalIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const supplierId = searchParams.get('supplierId');

  if (!supplierId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Supplier ID required', 400);
  }

  const supplierEngine = analyticalIntelligenceService.getSupplierEngine();

  switch (action) {
    case 'profile':
      const profile = await supplierEngine.aggregateSupplierData(supplierId);
      return createSuccessResponse(ctx, profile);

    case 'external-data':
      const externalData = await supplierEngine.integrateExternalData(supplierId);
      return createSuccessResponse(ctx, { data: externalData });

    case 'metrics':
      const metrics = await supplierEngine.calculateSupplierMetrics(supplierId);
      return createSuccessResponse(ctx, { data: metrics });

    case 'summary':
      const summary = await supplierEngine.generateExecutiveSummary(supplierId);
      return createSuccessResponse(ctx, { data: summary });

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});
