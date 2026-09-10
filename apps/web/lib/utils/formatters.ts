/**
 * Utility functions for formatting data
 */

import { tryConvertCurrency } from '@/lib/fx'
import { normalizePercent } from './percent'

export const DEFAULT_DISPLAY_CURRENCY = 'CHF'

function resolveNumberLocale(): string {
  return 'de-CH'
}

export function formatCurrency(amount: number, currency: string = DEFAULT_DISPLAY_CURRENCY): string {
  const code = (currency || DEFAULT_DISPLAY_CURRENCY).toUpperCase()
  const locale = resolveNumberLocale()
  const value = Number.isFinite(amount) ? amount : 0
  if (code === 'XXX' || code.length !== 3) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${code} ${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)}`
  }
}

/** Stored amount + stored currency. Does not invent USD/CHF when the code is missing. */
export function formatAmountWithCurrency(
  value: unknown,
  currency?: string | null,
  empty = '—',
): string {
  if (value == null || value === '') return empty
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount === 0) return empty
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : ''
  const formatted = amount.toLocaleString(resolveNumberLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  if (!code || code === 'XXX') return formatted
  return `${code} ${formatted}`
}

export function convertToDisplayCurrency(
  amount: number,
  fromCurrency: string | null | undefined,
  displayCurrency: string,
): number | null {
  const from = (fromCurrency || '').toUpperCase()
  const to = (displayCurrency || '').toUpperCase()
  if (!from || !to || from === 'XXX') return null
  return tryConvertCurrency(amount, from, to)
}

export function formatConvertedCurrency(
  amount: number,
  fromCurrency: string | null | undefined,
  displayCurrency: string,
): string {
  const from = (fromCurrency || '').toUpperCase()
  const to = (displayCurrency || '').toUpperCase()
  if (!from || from === 'XXX') {
    return formatAmountWithCurrency(amount, fromCurrency)
  }
  if (from === to) {
    return formatCurrency(amount, from)
  }
  const converted = convertToDisplayCurrency(amount, from, to)
  if (converted == null) {
    return formatAmountWithCurrency(amount, from)
  }
  return formatCurrency(converted, to)
}

/** Portfolio/list totals already converted into the settings display currency. */
export function formatDisplayTotal(
  amount: number,
  displayCurrency: string,
  options?: { converted?: boolean },
): string {
  if (!Number.isFinite(amount) || amount === 0) return '—'
  const formatted = formatCurrency(amount, displayCurrency)
  return options?.converted === false ? formatted : `${formatted} (converted)`
}

export interface ConvertedSum {
  total: number
  includedCount: number
  skippedCount: number
  convertedCount: number
}

export function summarizeConvertedCurrency(
  items: Array<{ amount?: number | null; currency?: string | null }>,
  displayCurrency: string,
): ConvertedSum {
  const display = (displayCurrency || '').toUpperCase()
  let total = 0
  let includedCount = 0
  let skippedCount = 0
  let convertedCount = 0
  for (const item of items) {
    const amount = Number(item.amount)
    if (!Number.isFinite(amount) || amount === 0) continue
    const from = typeof item.currency === 'string' ? item.currency.trim().toUpperCase() : ''
    const converted = convertToDisplayCurrency(amount, from, display)
    if (converted == null) {
      skippedCount += 1
      continue
    }
    includedCount += 1
    if (from && from !== display) convertedCount += 1
    total += converted
  }
  return { total, includedCount, skippedCount, convertedCount }
}

export function sumConvertedCurrency(
  items: Array<{ amount?: number | null; currency?: string | null }>,
  displayCurrency: string,
): number {
  return summarizeConvertedCurrency(items, displayCurrency).total
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(resolveNumberLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(resolveNumberLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat(resolveNumberLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num)
}

export function formatPercentage(value: number, decimals: number = 0): string {
  const percent = normalizePercent(value)
  if (percent == null) return '—'
  return `${formatNumber(percent, decimals)}%`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatDuration(days: number): string {
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months} month${months !== 1 ? 's' : ''}`
  }
  const years = Math.floor(days / 365)
  const remainingMonths = Math.floor((days % 365) / 30)
  if (remainingMonths === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7)
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  }
  if (diffDay < 365) {
    const months = Math.floor(diffDay / 30)
    return `${months} month${months !== 1 ? 's' : ''} ago`
  }
  const years = Math.floor(diffDay / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return `${str.slice(0, length)}...`
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function titleCase(str: string): string {
  return str
    .split(' ')
    .map(word => capitalize(word))
    .join(' ')
}
