/** Rate-card money for UI. Uses the stored code; never invents USD or CHF. */
export function formatRateMoney(
  amount: number,
  currency?: string | null,
  options?: { maximumFractionDigits?: number },
): string {
  const digits = options?.maximumFractionDigits ?? 0
  const value = Number(amount)
  if (!Number.isFinite(value)) return '—'
  const code = typeof currency === 'string' ? currency.trim() : ''
  if (code.length === 3 && code !== 'XXX') {
    try {
      return new Intl.NumberFormat('de-CH', {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      }).format(value)
    } catch {
      return `${code} ${value.toLocaleString('de-CH', { maximumFractionDigits: digits })}`
    }
  }
  return value.toLocaleString('de-CH', { maximumFractionDigits: digits })
}
