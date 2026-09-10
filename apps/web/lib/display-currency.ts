import { DEFAULT_DISPLAY_CURRENCY } from '@/lib/utils/formatters'
import { unwrapApiResponseData } from '@/lib/api-fetch'

export { DEFAULT_DISPLAY_CURRENCY }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read Settings.system.currency. Display only — never a persist default. */
export function displayCurrencyFromCustomSettings(customSettings: unknown): string {
  const root = isRecord(customSettings) ? customSettings : {}
  const system = isRecord(root.system) ? root.system : {}
  const currency = system.currency
  if (typeof currency === 'string' && /^[A-Za-z]{3}$/.test(currency.trim())) {
    const code = currency.trim().toUpperCase()
    if (code !== 'XXX') return code
  }
  return DEFAULT_DISPLAY_CURRENCY
}

/** Parse GET /api/settings JSON (wrapped or raw). */
export function parseDisplayCurrency(payload: unknown): string {
  const unwrapped = unwrapApiResponseData(payload)
  const root = isRecord(unwrapped) ? unwrapped : {}
  const settings = isRecord(root.settings) ? root.settings : root
  return displayCurrencyFromCustomSettings(settings)
}
