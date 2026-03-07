import { NextRequest } from "next/server";
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function PATCH(
  request: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const body = await request.json();
    const { enabled } = body;

    // In production, update database record
    // For now, just return success

    return createSuccessResponse(ctx, {
      message: `Schedule ${enabled ? "enabled" : "disabled"}`,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    // In production, delete from database and cancel cron job

    return createSuccessResponse(ctx, {
      message: "Schedule deleted",
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
