import { NextResponse } from "next/server"
import { getJob, patchJobResult } from "@/lib/jobs"
import type { RoleRow } from "@/lib/jobs"

export const runtime = "nodejs"

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const id = params.id
    const job = getJob(id)
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const body = await req.json() as Partial<{ roles: RoleRow[]; approved: boolean }>
    const updated = patchJobResult(id, { financials: { roles: body.roles ?? job.result?.financials.roles ?? [], approved: body.approved } } as any)
    return NextResponse.json({ ok: true, result: updated?.result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 })
  }
}