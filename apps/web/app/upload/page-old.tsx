"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { BatchUploadZone } from "@/components/batch-upload-zone"
import { API_BASE_URL } from "../../lib/config"
import { tenantHeaders, getTenantId, ensureTenantId } from "../../lib/tenant"

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [clientId, setClientId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [packs, setPacks] = useState<Array<{ id: string; name?: string }>>([])
  const [policyPack, setPolicyPack] = useState<string>('default')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [tip, setTip] = useState<string | null>(null)
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null)
  const router = useRouter()
  const [tenantId, setTenantId] = useState<string | undefined>(undefined)

  // Lightweight API health check
  useEffect(() => {
  // Ensure a tenant id exists in localStorage for local/dev usage
  const tid = ensureTenantId()
  setTenantId(tid)
    let canceled = false
    const ping = async () => {
      try {
        const r = await fetch("/api/healthz")
        if (!canceled) setApiHealthy(r.ok)
      } catch {
        if (!canceled) setApiHealthy(false)
      }
    }
    ping()
    const t = setInterval(ping, 10000)
    return () => {
      canceled = true
      clearInterval(t)
    }
  }, [])

  // Load policy packs and preselect client default when client changes
  useEffect(() => {
    let canceled = false
    const load = async () => {
      try {
  const rp = await fetch(`${API_BASE_URL}/api/policies/packs`, { headers: tenantHeaders() }).then(r=>r.ok?r.json():{ packs: [] })
        if (!canceled) setPacks(Array.isArray(rp.packs)? rp.packs: [])
      } catch {}
      if (clientId.trim()) {
        try {
          const cd = await fetch(`${API_BASE_URL}/api/policies/clients`, { headers: tenantHeaders() }).then(r=>r.ok?r.json():{ defaults: {} })
          const def = cd?.defaults?.[clientId.trim()]
          if (def && !canceled) setPolicyPack(String(def))
        } catch {}
      }
    }
    load()
    return () => { canceled = true }
  }, [clientId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setTip(null)
    setProgress(0)
    if (!files.length) return setError("Choose one or more files")
    if (files.length > 15) return setError("Please select at most 15 files per batch")
    // Validate per-file size (50 MB) and collect only valid ones
    const MAX_MB = 50
    const MAX_BYTES = MAX_MB * 1024 * 1024
    const valid: File[] = []
    const skipped: { name: string; reason: string }[] = []
    for (const f of files.slice(0, 15)) {
      if (f.size > MAX_BYTES) skipped.push({ name: f.name, reason: `exceeds ${MAX_MB} MB` })
      else valid.push(f)
    }
    if (!valid.length) return setError(`All selected files exceed ${MAX_MB} MB.`)
    if (skipped.length) setTip(`Skipped ${skipped.length} files: ${skipped.map(s=>`${s.name} (${s.reason})`).join(', ')}`)
    setLoading(true)
    try {
      const form = new FormData()
      for (const f of valid) form.append("files", f)

      async function sendTo(url: string): Promise<{ items?: Array<{ name: string; docId: string }>; error?: string }> {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open("POST", url)
          try {
            const tenant = getTenantId?.() || (tenantHeaders() as any)['x-tenant-id'] || undefined
            if (tenant) xhr.setRequestHeader('x-tenant-id', String(tenant))
          } catch {}
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.round((evt.loaded / evt.total) * 100)
              setProgress(pct)
            }
          }
          xhr.upload.onloadend = () => setProgress(100)
          xhr.onload = () => setProgress(100)
          xhr.onerror = () => reject(new Error(`Network error posting to ${url}`))
          xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
              try {
                const data = JSON.parse(xhr.responseText || '{}')
                if (xhr.status >= 200 && xhr.status < 300) resolve(data)
                else reject(new Error(data?.error || `HTTP ${xhr.status} at ${url}`))
              } catch (e: any) {
                if (xhr.status >= 200 && xhr.status < 300) resolve({})
                else reject(new Error(xhr.responseText || `HTTP ${xhr.status} at ${url}`))
              }
            }
          }
          xhr.send(form)
        })
      }

      let data: { items?: Array<{ name: string; docId: string }>; error?: string } = {}
      // Prefer same-origin proxy first to avoid cross-origin/network quirks
      try {
        data = await sendTo('/api/upload/batch')
      } catch (errProxy) {
        // Fallback to direct API endpoint
        try {
          const direct = `${API_BASE_URL}/uploads/batch`
          data = await sendTo(direct)
        } catch (errPrimary) {
          throw errPrimary
        }
      }
      const items = Array.isArray(data.items) ? data.items : []
      if (!items.length) throw new Error(data.error || "Upload failed")
      // Assign client/supplier metadata if provided
    if (clientId || supplierId) {
        try {
  await Promise.all(items.map(it => fetch(`${API_BASE_URL}/api/contracts/${it.docId}/assign`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ clientId: clientId || undefined, supplierId: supplierId || undefined }) })))
        } catch {}
      }
  if (items.length === 1) {
        const qp = policyPack ? `?policyPack=${encodeURIComponent(policyPack)}` : ''
        router.push(`/contracts/${items[0].docId}${qp}`)
      } else {
        try {
          window.sessionStorage.setItem('batchUploadedCount', String(items.length));
          window.sessionStorage.setItem('batchUploadedDocIds', JSON.stringify(items.map(it => it.docId)));
        } catch {}
        router.push(`/contracts`)
      }
    } catch (err: any) {
      setTip("Upload failed to reach the backend. Verify API on http://localhost:3001/healthz and try again.")
      setError(err?.message || "Upload failed")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="mb-2"><BackButton hrefFallback="/contracts" /></div>
          <CardTitle>Upload Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                API status: {apiHealthy == null ? "—" : apiHealthy ? "Healthy" : "Unreachable"}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Tenant:</span>
                <input
                  value={tenantId || ''}
                  onChange={(e)=>{ const v=e.target.value.trim(); setTenantId(v||undefined); try{ localStorage.setItem('x-tenant-id', v)}catch{} }}
                  placeholder="demo"
                  className="w-28 px-2 py-1 border rounded text-xs"
                  title="x-tenant-id header value"
                />
              </div>
              {loading && (
                <div aria-live="polite">Uploading…</div>
              )}
            </div>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="block w-full text-sm"
              disabled={loading}
            />
            {files.length > 0 && (
              <div className="rounded border p-2 bg-muted/30">
                <div className="text-xs text-muted-foreground mb-1">Files to upload ({files.length}{files.length>15? ' – will only send first 15':''})</div>
                <ul className="max-h-36 overflow-auto text-xs list-disc pl-5">
                  {files.slice(0,15).map((f, i) => (
                    <li key={i} className="truncate">{f.name} <span className="text-muted-foreground">({Math.round(f.size/1024)} KB)</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Client (optional)</label>
                <input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="Acme Corp" className="w-full px-3 py-2 border rounded text-sm" disabled={loading} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Supplier (optional)</label>
                <input value={supplierId} onChange={e=>setSupplierId(e.target.value)} placeholder="Deloitte" className="w-full px-3 py-2 border rounded text-sm" disabled={loading} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Policy pack (optional)</label>
              <select value={policyPack} onChange={e=>setPolicyPack(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" disabled={loading}>
                {packs.length === 0 && <option value="default">default</option>}
                {packs.map(p => (<option key={p.id} value={p.id}>{p.name || p.id}</option>))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Uploading…" : files.length > 1 ? `Upload ${Math.min(files.length,15)} files` : "Upload & Analyze"}
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={() => alert('Not yet implemented: SharePoint connector')}>
                Connect to SharePoint
              </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {tip && <p className="text-xs text-muted-foreground">{tip}</p>}
            <div className="flex flex-col gap-2">
              {loading && (
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 bg-muted rounded">
                    <div className="h-2 bg-primary rounded" style={{ inlineSize: `${Math.min(100, Math.max(0, progress))}%` }} />
                  </div>
                  <div className="w-16 text-right text-xs">{progress}%</div>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
