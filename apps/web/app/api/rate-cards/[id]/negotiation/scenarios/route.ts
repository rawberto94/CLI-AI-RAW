import { NextRequest } from 'next/server';
import { negotiationScenarioService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getAuthenticatedApiContext(request);
    if (!ctx) {
      return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
    }
try {
    const { searchParams } = new URL(request.url);
    const tenantId = await getApiTenantId(request);
    const volume = searchParams.get('volume');

    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const scenarios = await negotiationScenarioService.generateScenarios(
      params.id,
      tenantId,
      volume ? parseInt(volume) : undefined
    );

    return createSuccessResponse(ctx, scenarios);
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate scenarios', 500);
  }
}
