"use client"
import { useEffect, useState } from "react"
import { tenantHeaders, ensureTenantId } from "@/lib/tenant"

export function HealthBanner() {
  const [api, setApi] = useState<'ok'|'down'|'?'>('?')
  const [web, setWeb] = useState<'ok'|'down'|'?'>('?')
  const [tenant, setTenant] = useState<string | undefined>(undefined)

  useEffect(() => {
    ensureTenantId()
    setTenant(localStorage.getItem('x-tenant-id') || '—')
    const check = async () => {
      try { 
        const r = await fetch('/api/health', { headers: tenantHeaders() }); 
        setApi(r.ok ? 'ok' : 'down');
      } catch { 
        setApi('down');
      }
      // Web is OK if this client-side code is running
      setWeb('ok');
    }
    check()
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="w-full border-b bg-muted/50 text-xs text-muted-foreground">
      <div className="mx-auto max-w-screen-2xl px-4 py-1 flex items-center gap-4">
        <span>Tenant: <strong className="text-foreground">{tenant || '—'}</strong></span>
        <span>API: <strong className={api==='ok'? 'text-green-600':'text-red-600'}>{api}</strong></span>
        <span>Web: <strong className={web==='ok'? 'text-green-600':'text-red-600'}>{web}</strong></span>
      </div>
    </div>
  )
}
