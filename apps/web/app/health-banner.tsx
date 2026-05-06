"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { tenantHeaders, ensureTenantId } from "@/lib/tenant"

type Status = 'ok' | 'down' | 'checking'

export function HealthBanner() {
  const [api, setApi] = useState<Status>('checking')
  const [web, setWeb] = useState<Status>('checking')
  const [tenant, setTenant] = useState<string | undefined>(undefined)
  const failCountRef = useRef(0)

  const checkHealth = useCallback(async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      const r = await fetch('/api/health', {
        headers: tenantHeaders(),
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timeout)

      if (r.ok) {
        failCountRef.current = 0
        setApi('ok')
      } else {
        // Require 2 consecutive failures before marking down
        failCountRef.current++
        if (failCountRef.current >= 2) setApi('down')
      }
    } catch {
      failCountRef.current++
      // Require 2 consecutive failures to avoid false down on cold-start
      if (failCountRef.current >= 2) setApi('down')
    }
    // Web is OK if this client-side code is running
    setWeb('ok')
  }, [])

  useEffect(() => {
    ensureTenantId()
    setTenant(localStorage.getItem('tenantId') || '—')
    // Small delay on first check to let Next.js compile routes on-demand
    const initial = setTimeout(checkHealth, 1000)
    let interval: ReturnType<typeof setInterval> | null = setInterval(checkHealth, 15000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!interval) {
          checkHealth()
          interval = setInterval(checkHealth, 15000)
        }
      } else if (interval) {
        clearInterval(interval)
        interval = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearTimeout(initial)
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkHealth])

  const statusColor = (s: Status) =>
    s === 'ok' ? 'text-green-600' : s === 'down' ? 'text-red-600' : 'text-yellow-500'
  const statusLabel = (s: Status) =>
    s === 'ok' ? 'ok' : s === 'down' ? 'down' : '…'

  return (
    <div className="w-full border-b bg-muted/50 text-xs text-muted-foreground">
      <div className="mx-auto max-w-screen-2xl px-4 py-1 flex items-center gap-4">
        <span>Tenant: <strong className="text-foreground">{tenant || '—'}</strong></span>
        <span>API: <strong className={statusColor(api)}>{statusLabel(api)}</strong></span>
        <span>Web: <strong className={statusColor(web)}>{statusLabel(web)}</strong></span>
      </div>
    </div>
  )
}
