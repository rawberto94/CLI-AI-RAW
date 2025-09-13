// Simple FX conversion for the web app (demo only). Keep in sync with API utils.
const FX: Record<string, number> = {
  USD: 1,
  EUR: 1.1,
  GBP: 1.25,
  INR: 0.012,
  CAD: 0.74,
  AUD: 0.66,
}

export function convertCurrency(amount: number, from: string, to: string): number {
  const f = (from || 'USD').toUpperCase()
  const t = (to || 'USD').toUpperCase()
  if (f === t) return amount
  const inUsd = f === 'USD' ? amount : amount * (FX[f] ?? 1)
  if (t === 'USD') return inUsd
  return inUsd / (FX[t] ?? 1)
}

export function normalizeToDaily(amount: number, uom: string): number {
  const u = (uom || '').toLowerCase()
  if (u === 'day' || u === 'daily') return amount
  if (u === 'hour' || u === 'hr' || u === 'h') return amount * 8
  if (u === 'month' || u === 'mo') return amount / 22
  if (u === 'year' || u === 'yr' || u === 'annum') return amount / (22 * 12)
  return amount
}