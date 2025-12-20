import { NextResponse } from "next/server"
import { API_BASE_URL } from "@/lib/config"
import { getErrorMessage, isUploadedFile } from "@/lib/types/common"

// Explicitly mark this route as dynamic (file uploads always dynamic)
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const files = form.getAll("files")
    const items: Array<{ name: string; blob: Blob; filename: string }> = []
    for (const f of files) {
      if (isUploadedFile(f)) {
        const name = f.name || "upload.bin"
        items.push({ name, blob: f as Blob, filename: name })
      }
    }
    if (items.length === 0) {
      // Fallback: accept a single "file" field
      const one = form.get("file")
      if (!one || !isUploadedFile(one)) {
        return NextResponse.json({ error: "Missing files" }, { status: 400 })
      }
      const name = one.name || "upload.bin"
      items.push({ name, blob: one as Blob, filename: name })
    }

    // Resolve tenant id from header, cookie, or query param
    const url = new URL(req.url)
    let tenant = req.headers.get('x-tenant-id') || url.searchParams.get('tenant') || undefined
    if (!tenant) {
      try {
        const cookie = req.headers.get('cookie') || ''
        const m = /(?:^|;\s*)x-tenant-id=([^;]+)/i.exec(cookie)
        if (m && m[1]) tenant = decodeURIComponent(m[1])
      } catch {}
    }
    
    // Require tenant ID - no fallback to demo
    if (!tenant) {
      return NextResponse.json({ error: "Tenant ID is required" }, { status: 400 })
    }

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
  } catch (e) {
    console.error("Batch upload error:", e)
    return NextResponse.json({ error: `Upload failed: ${getErrorMessage(e)}` }, { status: 500 })
  }
}
