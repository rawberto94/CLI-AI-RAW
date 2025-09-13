"use client"
import { useEffect, useState } from "react"
import { tenantHeaders, ensureTenantId } from "@/lib/tenant"
import { logger } from "utils/logging"

export function HealthBanner() {
  const [api, setApi] = useState<'ok'|'down'|'?'>('?')
  const [web, setWeb] = useState<'ok'|'down'|'?'>('?')
  const [tenant, setTenant] = useState<string | undefined>(undefined)

  useEffect(() => {
    ensureTenantId()
    setTenant(localStorage.getItem('x-tenant-id') || '—')
    const check = async () => {
      try { 
        const r = await fetch('/api/healthz', { headers: tenantHeaders() }); 
        setApi(r.ok ? 'ok' : 'down') 
        if (!r.ok) logger.warn('API health check failed');
      } catch { 
        setApi('down');
        logger.error('API health check failed');
      }
      try { 
        const r2 = await fetch('/api/web-health'); 
        setWeb(r2.ok ? 'ok' : 'down');
        if (!r2.ok) logger.warn('Web health check failed');
      } catch { 
        setWeb('down');
        logger.error('Web health check failed');
      }
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
