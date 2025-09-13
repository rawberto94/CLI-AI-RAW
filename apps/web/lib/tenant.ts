// Ensure a tenant id exists for local/dev usage. Defaults to "demo" on localhost.
export function ensureTenantId(defaultId = 'demo'): string | undefined {
  try {
    if (typeof window === 'undefined') return undefined
  const envDefault = (process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '').trim()
  let tid = localStorage.getItem('x-tenant-id') || ''
    // Default only in non-production OR localhost style hosts
    const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(window.location.hostname)
    if (!tid && (process.env.NODE_ENV !== 'production' || isLocal)) {
      tid = envDefault || defaultId
      localStorage.setItem('x-tenant-id', tid)
    }
    return tid || undefined
  } catch {
    return undefined
  }
}

export function tenantHeaders(extra?: HeadersInit): HeadersInit {
  try {
    if (typeof window !== 'undefined') {
      const tid = ensureTenantId() || ''
      return { ...(extra || {}), ...(tid ? { 'x-tenant-id': tid } : {}) }
    }
  } catch {}
  return extra || {}
}

export function getTenantId(): string | undefined {
  try {
    if (typeof window !== 'undefined') return ensureTenantId()
  } catch {}
  return undefined
}