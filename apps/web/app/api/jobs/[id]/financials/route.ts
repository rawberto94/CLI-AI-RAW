import { getJob, patchJobResult } from "@/lib/jobs"
import type { RoleRow } from "@/lib/jobs"
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const runtime = "nodejs"

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = getApiContext(req);
  try {
    const params = await context.params
    const id = params.id
    const job = getJob(id)
    if (!job) return createErrorResponse(ctx, 'NOT_FOUND', 'Not found', 404);
    const body = await req.json() as Partial<{ roles: RoleRow[]; approved: boolean }>
    const updated = patchJobResult(id, { financials: { roles: body.roles ?? job.result?.financials.roles ?? [], approved: body.approved } } as any)
    return createSuccessResponse(ctx, { ok: true, result: updated?.result });
  } catch (e: unknown) {
    return handleApiError(ctx, e);
  }
}