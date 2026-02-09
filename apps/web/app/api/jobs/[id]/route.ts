import { getJob } from "@/lib/jobs"
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const runtime = "nodejs"

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = getApiContext(request);
  const params = await context.params
  const job = getJob(params.id)
  if (!job) return createErrorResponse(ctx, 'NOT_FOUND', 'Not found', 404);
  return createSuccessResponse(ctx, { id: job.id, status: job.status, progress: job.progress, result: job.result, error: job.error });
}
