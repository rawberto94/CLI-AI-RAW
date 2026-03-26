import { NextRequest } from 'next/server';
import { getJob } from "@/lib/jobs"
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const runtime = "nodejs"

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getAuthenticatedApiContext(_req);
  if (!ctx) {
    return createErrorResponse(getApiContext(_req), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const params = await context.params;
    const job = getJob(params.id);
    if (!job) return createErrorResponse(ctx, 'NOT_FOUND', 'Not found', 404);
    return createSuccessResponse(ctx, { id: job.id, status: job.status, progress: job.progress, result: job.result, error: job.error });
  } catch (error) {
    return handleApiError(error, ctx);
  }
}
