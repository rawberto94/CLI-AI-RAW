"use client"
import { useEffect, useState, useRef } from "react"
import { tenantHeaders, ensureTenantId } from "@/lib/tenant"

// Simple client-side logger - only log persistent failures (3+ consecutive)
const createLogger = () => {
  const failCounts: Record<string, number> = {};
  return {
    warn: (key: string, msg: string) => {
      failCounts[key] = (failCounts[key] || 0) + 1;
      if (failCounts[key] === 3) {
        console.warn(`[Health] ${msg}`);
      }
    },
    reset: (key: string) => {
      failCounts[key] = 0;
    }
  };
};

const logger = createLogger();

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
        if (r.ok) {
          setApi('ok');
          logger.reset('api');
        } else {
          setApi('down');
          logger.warn('api', 'API health check failed');
        }
      } catch { 
        setApi('down');
        logger.warn('api', 'API health check failed');
      }
      try { 
        const r2 = await fetch('/api/web-health'); 
        if (r2.ok) {
          setWeb('ok');
          logger.reset('web');
        } else {
          setWeb('down');
          logger.warn('web', 'Web health check failed');
        }
      } catch { 
        setWeb('down');
        logger.warn('web', 'Web health check failed');
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
