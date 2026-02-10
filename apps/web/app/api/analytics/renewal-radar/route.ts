import { NextRequest } from 'next/server';
import { analyticalIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const contractId = searchParams.get('contractId');
  const tenantId = ctx.tenantId;

  const renewalEngine = analyticalIntelligenceService.getRenewalEngine();

  switch (action) {
    case 'extract':
      if (!contractId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID required', 400);
      }
      const renewalData = await renewalEngine.extractRenewalData(contractId);
      return createSuccessResponse(ctx, renewalData);

    case 'calendar':
      const filters = {
        tenantId,
        supplierId: searchParams.get('supplierId') || undefined,
        category: searchParams.get('category') || undefined,
        riskLevel: searchParams.get('riskLevel') as any || undefined,
        daysUntilExpiry: searchParams.get('daysUntilExpiry') ? parseInt(searchParams.get('daysUntilExpiry')!) : undefined
      };
      const calendar = await renewalEngine.generateRenewalCalendar(filters);
      return createSuccessResponse(ctx, calendar);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { action, renewalData, contractId } = body;

  const renewalEngine = analyticalIntelligenceService.getRenewalEngine();

  switch (action) {
    case 'schedule-alerts':
      if (!renewalData || !contractId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID and renewal data required', 400);
      }
      await renewalEngine.scheduleAlerts(contractId, renewalData);
      return createSuccessResponse(ctx, { scheduled: true });

    case 'trigger-rfx':
      if (!contractId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID required', 400);
      }
      const rfxEvent = await renewalEngine.triggerRfxGeneration(contractId);
      return createSuccessResponse(ctx, rfxEvent);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});
