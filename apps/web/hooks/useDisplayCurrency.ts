'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_DISPLAY_CURRENCY, parseDisplayCurrency } from '@/lib/display-currency'

export { parseDisplayCurrency, DEFAULT_DISPLAY_CURRENCY }

let memoryCache: string | null = null
let inflight: Promise<string> | null = null

export function clearDisplayCurrencyCache(): void {
  memoryCache = null
}

async function loadDisplayCurrency(): Promise<string> {
  if (memoryCache) return memoryCache
  if (!inflight) {
    inflight = (async () => {
      try {
        const response = await fetch('/api/settings', { credentials: 'same-origin' })
        if (!response.ok) return DEFAULT_DISPLAY_CURRENCY
        const currency = parseDisplayCurrency(await response.json())
        memoryCache = currency
        return currency
      } catch {
        return DEFAULT_DISPLAY_CURRENCY
      } finally {
        inflight = null
      }
    })()
  }
  return inflight
}

export function useDisplayCurrency(): string {
  const [currency, setCurrency] = useState(memoryCache ?? DEFAULT_DISPLAY_CURRENCY)

  useEffect(() => {
    let active = true
    loadDisplayCurrency().then((value) => {
      if (active) setCurrency(value)
    })
    return () => {
      active = false
    }
  }, [])

  return currency
}
