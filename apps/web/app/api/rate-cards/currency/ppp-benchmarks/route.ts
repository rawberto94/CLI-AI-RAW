import { NextRequest } from 'next/server';
import { pppAdjustmentService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {
    const searchParams = request.nextUrl.searchParams;
  const tenantId = ctx.tenantId;
    const roleStandardized = searchParams.get('role');
    const seniority = searchParams.get('seniority');
    const targetCountry = searchParams.get('targetCountry') || 'USA';

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    if (!roleStandardized || !seniority) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Missing required parameters: role, seniority', 400);
    }

    const benchmarks = await pppAdjustmentService.calculatePPPAdjustedBenchmarks(
      tenantId,
      roleStandardized,
      seniority,
      targetCountry
    );

    return createSuccessResponse(ctx, {
      ...benchmarks,
      targetCountry,
      message: 'PPP-adjusted benchmarks calculated successfully',
    });
  });
