import { describe, expect, it } from 'vitest'

import { formatCurrency as formatDesignTokenCurrency } from '@/lib/design-tokens'
import { formatRateMoney } from '@/lib/rate-cards/format'
import {
  convertToDisplayCurrency,
  formatAmountWithCurrency,
  formatConvertedCurrency,
  formatCurrency,
  formatDate,
} from '../formatters'

describe('formatAmountWithCurrency', () => {
  it('does not invent USD when currency is missing', () => {
    expect(formatAmountWithCurrency(1200000, null)).not.toMatch(/USD|CHF|\$/)
    expect(formatAmountWithCurrency(1200000, null)).toMatch(/1.200.000/)
    expect(formatAmountWithCurrency(1200000, 'CHF')).toMatch(/CHF/)
    expect(formatAmountWithCurrency(null, 'CHF')).toBe('—')
    expect(formatAmountWithCurrency(0, 'USD')).toBe('—')
    expect(formatAmountWithCurrency(1200000, 'XXX')).not.toMatch(/XXX|USD|CHF/)
  })
})

describe('convertToDisplayCurrency', () => {
  it('does not treat a missing source currency as CHF/USD', () => {
    expect(convertToDisplayCurrency(100, null, 'CHF')).toBeNull()
    expect(convertToDisplayCurrency(100, '', 'CHF')).toBeNull()
  })

  it('converts when both currencies are known', () => {
    expect(convertToDisplayCurrency(100, 'CHF', 'USD')).toBeGreaterThan(100)
  })
})

describe('formatConvertedCurrency', () => {
  it('falls back to a bare number when the source currency is unknown', () => {
    const formatted = formatConvertedCurrency(50000, null, 'CHF')
    expect(formatted).not.toMatch(/CHF|USD|\$/)
    expect(formatted).toMatch(/50/)
  })
})

describe('formatCurrency', () => {
  it('does not treat XXX as a real currency', () => {
    const formatted = formatCurrency(1200, 'XXX')
    expect(formatted).not.toMatch(/USD|\$|XXX/)
    expect(formatted).toMatch(/1.200/)
  })
})

describe('formatRateMoney', () => {
  it('does not invent USD or CHF when currency is missing', () => {
    const formatted = formatRateMoney(1400)
    expect(formatted).not.toMatch(/USD|CHF|\$/)
    expect(formatted).toMatch(/1.400/)
  })
})

describe('design-tokens formatCurrency', () => {
  it('does not invent CHF when the stored currency is missing', () => {
    const formatted = formatDesignTokenCurrency(1200000)
    expect(formatted).not.toMatch(/CHF|USD|\$/)
    expect(formatted).toMatch(/1.200.000/)
  })
})

describe('formatDate', () => {
  it('uses a Swiss-style date, not US month-first', () => {
    const formatted = formatDate('2026-09-10')
    expect(formatted).toMatch(/10/)
    expect(formatted).toMatch(/2026/)
    expect(formatted).not.toBe('Sep 10, 2026')
  })
})
