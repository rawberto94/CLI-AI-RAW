import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/config"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const files = form.getAll("files") as any[]
    const items: Array<{ name: string; blob: Blob; filename: string }> = []
    for (const f of files) {
      if (f && typeof (f as any).arrayBuffer === "function") {
        const name = (f as any).name || "upload.bin"
        items.push({ name, blob: f as Blob, filename: name })
      }
    }
    if (items.length === 0) {
      // Fallback: accept a single "file" field
      const one = form.get("file") as any
      if (!one || typeof one?.arrayBuffer !== "function") {
        return NextResponse.json({ error: "Missing files" }, { status: 400 })
      }
      const name = one.name || "upload.bin"
      items.push({ name, blob: one as Blob, filename: name })
    }

    // Resolve tenant id from header, cookie, or query param; default to demo in dev/local
    const url = new URL(req.url)
    let tenant = req.headers.get('x-tenant-id') || url.searchParams.get('tenant') || undefined
    if (!tenant) {
      try {
        const cookie = req.headers.get('cookie') || ''
        const m = /(?:^|;\s*)x-tenant-id=([^;]+)/i.exec(cookie)
        if (m) tenant = decodeURIComponent(m[1])
      } catch {}
    }
    if (!tenant && process.env.NODE_ENV !== 'production') tenant = 'demo'

    const results = []
    
    // Process files sequentially using the working single upload endpoint
    for (const item of items) {
      try {
        const uploadFormData = new FormData()
        uploadFormData.append('file', item.blob, item.filename)
        
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 60_000) // 60s timeout per file
        
        const resp = await fetch(`${API_BASE_URL}/uploads`, {
          method: "POST",
          body: uploadFormData,
          headers: tenant ? { 'x-tenant-id': tenant } : {},
          signal: controller.signal,
        })
        
        clearTimeout(timer)

        if (!resp.ok) {
          const error = await resp.text().catch(() => `Upload failed with status ${resp.status}`)
          results.push({
            name: item.filename,
            error: error,
            status: 'error'
          })
        } else {
          const data = await resp.json()
          results.push({
            name: item.filename,
            docId: data.id || data.docId,
            status: 'success'
          })
        }
      } catch (error) {
        results.push({
          name: item.filename,
          error: error instanceof Error ? error.message : 'Upload failed',
          status: 'error'
        })
      }
    }

    return NextResponse.json({ 
      items: results,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length
    }, { status: 201 })
  } catch (e: any) {
    console.error("Batch upload error:", e)
    return NextResponse.json({ error: `Upload failed: ${e?.message || "unknown error"}` }, { status: 500 })
  }
}
