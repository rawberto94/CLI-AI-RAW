import { NextRequest } from 'next/server'
import { getJob, patchJobResult } from "@/lib/jobs"
import type { RoleRow } from "@/lib/jobs"
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

export const runtime = "nodejs"

export const PATCH = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string }
  const id = params.id
  const job = getJob(id)
  if (!job) return createErrorResponse(ctx, 'NOT_FOUND', 'Not found', 404);
  const body = await req.json() as Partial<{ roles: RoleRow[]; approved: boolean }>
  const updated = patchJobResult(id, { financials: { roles: body.roles ?? job.result?.financials.roles ?? [], approved: body.approved } } as any)
  return createSuccessResponse(ctx, { ok: true, result: updated?.result });
})