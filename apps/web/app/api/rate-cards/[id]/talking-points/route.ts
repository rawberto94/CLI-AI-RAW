import { NextRequest } from 'next/server';
import { negotiationAssistantEnhancedService } from 'data-orchestration/services';
import { getApiTenantId } from '@/lib/security/tenant';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
    const ctx = getApiContext(request);
try {
    const tenantId = await getApiTenantId(request);
    if (!tenantId) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Tenant ID required', 400);
    }

    const talkingPoints = await negotiationAssistantEnhancedService.generateEnhancedTalkingPoints(
      params.id,
      tenantId
    );

    return createSuccessResponse(ctx, {
      success: true,
      data: talkingPoints,
    });
  } catch (error: unknown) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to generate talking points', 500)
  }
}
