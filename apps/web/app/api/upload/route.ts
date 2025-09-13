import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/config"

export const runtime = "nodejs"
export const maxDuration = 60

// Proxy uploads to the backend API so contracts and artifacts are persisted server-side.
export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get("file") as unknown as (Blob | File | null)
    // In Node runtime, Next may return a Blob; accept anything with arrayBuffer()
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    // Basic validations aligned with backend limits (50MB)
    const name = ((file as any).name as string) || "upload.bin"
    const size = (file as any).size as number | undefined
    const type = ((file as any).type as string | undefined) || ""
    const MAX_SIZE = 50 * 1024 * 1024 // 50 MB
    if (typeof size === "number" && size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 })
    }

    // Allow common types: PDF and plaintext. If mimetype missing, fall back to extension
    const allowed = ["application/pdf", "text/plain"]
    const ext = name.toLowerCase().slice(name.lastIndexOf(".") + 1)
    const looksPdf = ext === "pdf"
    const looksTxt = ext === "txt"
    const isAllowed = allowed.includes(type) || looksPdf || looksTxt
    if (!isAllowed) {
      return NextResponse.json({ error: `Unsupported file type: ${type || ext || "unknown"}` }, { status: 415 })
    }

    const out = new FormData()
    // Forward the original File blob so undici sets the multipart boundary correctly
    out.append("file", file as any, name)

    // Abort if backend is too slow for this edge/runtime limit
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 55_000)

    // Prepare headers: tenant passthrough + optional API key from server env
    const headers: Record<string, string> = {}
    const tenant = req.headers.get('x-tenant-id') || undefined
    if (tenant) headers['x-tenant-id'] = tenant
    const apiKey = process.env.BACKEND_API_KEY || process.env.DEMO_API_KEY || process.env.API_KEY
    if (apiKey) {
      headers['x-api-key'] = apiKey
      headers['x-demo-key'] = apiKey
    }

    const resp = await fetch(`${API_BASE_URL}/uploads`, {
      method: "POST",
      body: out as any,
      headers,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))
    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      return NextResponse.json({ error: `Backend upload failed: ${resp.status} ${text}` }, { status: 502 })
    }
    const { docId } = (await resp.json()) as { docId: string }
    return NextResponse.json({ id: docId }, { status: 201 })
  } catch (e: any) {
    const isAbort = e?.name === "AbortError"
    return NextResponse.json({ error: isAbort ? "Upload timed out" : (e?.message || "Upload failed") }, { status: isAbort ? 504 : 500 })
  }
}
