import { NextRequest } from "next/server";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function PATCH(
  request: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  const ctx = getApiContext(request);
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
  const ctx = getApiContext(request);
  try {
    // In production, delete from database and cancel cron job

    return createSuccessResponse(ctx, {
      message: "Schedule deleted",
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
