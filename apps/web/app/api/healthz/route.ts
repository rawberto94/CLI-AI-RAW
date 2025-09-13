import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/config"

export const runtime = "nodejs"
export const maxDuration = 10

export async function GET() {
  try {
    const r = await fetch(`${API_BASE_URL}/healthz`)
    if (!r.ok) return NextResponse.json({ status: "down" }, { status: 503 })
    const j = await r.json().catch(() => ({}))
    return NextResponse.json(j, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ status: "down", error: e?.message }, { status: 503 })
  }
}
