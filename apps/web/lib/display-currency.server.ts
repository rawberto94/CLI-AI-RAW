import { prisma } from '@/lib/prisma'
import { tryConvertCurrency, UNKNOWN_CURRENCY } from '@/lib/fx'
import { DEFAULT_DISPLAY_CURRENCY, displayCurrencyFromCustomSettings } from '@/lib/display-currency'

export async function resolveDisplayCurrency(tenantId?: string | null): Promise<string> {
  if (!tenantId) return DEFAULT_DISPLAY_CURRENCY
  try {
    const tenantSettings = await prisma.tenantSettings.findFirst({
      where: { tenantId },
      select: { customFields: true },
    })
    return displayCurrencyFromCustomSettings(tenantSettings?.customFields)
  } catch {
    return DEFAULT_DISPLAY_CURRENCY
  }
}

export async function convertAmountToDisplayLive(
  amount: number | null | undefined,
  fromCurrency: string | null | undefined,
  displayCurrency: string,
): Promise<{ value: number | null; asOf: string | null; source: 'live' | 'static' | 'identity' | 'skipped' }> {
  const staticValue = convertAmountToDisplay(amount, fromCurrency, displayCurrency)
  const from = typeof fromCurrency === 'string' ? fromCurrency.trim().toUpperCase() : ''
  const to = (displayCurrency || '').toUpperCase()
  if (staticValue == null || !from || !to) {
    return { value: staticValue, asOf: null, source: 'skipped' }
  }
  if (from === to) {
    return { value: staticValue, asOf: null, source: 'identity' }
  }
  try {
    const { currencyAdvancedService } = await import('data-orchestration/services')
    const rate = await currencyAdvancedService.getExchangeRate(from, to)
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      return { value: Number(amount) * rate, asOf: new Date().toISOString(), source: 'live' }
    }
  } catch {
    // static fallback
  }
  return { value: staticValue, asOf: null, source: 'static' }
}

export function convertAmountToDisplay(
  amount: number | null | undefined,
  fromCurrency: string | null | undefined,
  displayCurrency: string,
): number | null {
  const value = Number(amount)
  if (!Number.isFinite(value) || value === 0) return null
  const from = typeof fromCurrency === 'string' ? fromCurrency.trim().toUpperCase() : ''
  if (!from || from === UNKNOWN_CURRENCY) return null
  return tryConvertCurrency(value, from, displayCurrency)
}

export function sumToDisplayCurrency(
  items: Array<{ amount?: number | null; currency?: string | null }>,
  displayCurrency: string,
): number {
  let total = 0
  for (const item of items) {
    const converted = convertAmountToDisplay(item.amount, item.currency, displayCurrency)
    if (converted == null) continue
    total += converted
  }
  return total
}

export function sumGroupedTotalValue(
  rows: Array<{ currency?: string | null; _sum?: { totalValue?: unknown } | null }>,
  displayCurrency: string,
): number {
  return sumToDisplayCurrency(
    rows.map((row) => ({
      amount: Number(row._sum?.totalValue || 0),
      currency: row.currency,
    })),
    displayCurrency,
  )
}
