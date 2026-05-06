import { NextRequest } from 'next/server';
import { getJob } from "@/lib/jobs"
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const runtime = "nodejs"

export const GET = withAuthApiHandler(async (_req: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string };
  const job = getJob(params.id);
  if (!job) return createErrorResponse(ctx, 'NOT_FOUND', 'Not found', 404);
  return createSuccessResponse(ctx, { id: job.id, status: job.status, progress: job.progress, result: job.result, error: job.error });
})
