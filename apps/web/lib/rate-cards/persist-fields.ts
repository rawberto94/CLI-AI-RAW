import { resolvePersistCurrency, tryConvertCurrency, UNKNOWN_CURRENCY } from '@/lib/fx'

export { resolvePersistCurrency, UNKNOWN_CURRENCY }
export const UNKNOWN_GEO = 'UNKNOWN'

export function resolvePersistGeo(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.trim() : ''
    if (value) return value
  }
  return UNKNOWN_GEO
}

/** Derived USD/CHF cache for sorts/benchmarks only — not the extracted source rate. */
export function convertedDailyRates(
  amount: number,
  currency: string,
): { usd: number; chf: number } {
  const code = resolvePersistCurrency(currency)
  if (code === UNKNOWN_CURRENCY || !Number.isFinite(amount) || amount <= 0) {
    return { usd: 0, chf: 0 }
  }
  const usd = tryConvertCurrency(amount, code, 'USD')
  const chf = tryConvertCurrency(amount, code, 'CHF')
  return {
    usd: usd ?? 0,
    chf: chf ?? 0,
  }
}
