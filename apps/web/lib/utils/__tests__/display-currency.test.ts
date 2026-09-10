import { describe, expect, it } from 'vitest'
import { displayCurrencyFromCustomSettings, parseDisplayCurrency } from '@/lib/display-currency'
import { convertAmountToDisplay, sumToDisplayCurrency } from '@/lib/display-currency.server'
import {
  convertToDisplayCurrency,
  formatConvertedCurrency,
  formatDisplayTotal,
} from '@/lib/utils/formatters'

describe('display currency', () => {
  it('reads Settings.system.currency and ignores XXX', () => {
    expect(displayCurrencyFromCustomSettings({ system: { currency: 'eur' } })).toBe('EUR')
    expect(displayCurrencyFromCustomSettings({ system: { currency: 'XXX' } })).toBe('CHF')
    expect(parseDisplayCurrency({ settings: { system: { currency: 'GBP' } } })).toBe('GBP')
  })
})

describe('convertToDisplayCurrency', () => {
  it('does not treat missing or XXX as the display currency', () => {
    expect(convertToDisplayCurrency(100, null, 'CHF')).toBeNull()
    expect(convertToDisplayCurrency(100, 'XXX', 'CHF')).toBeNull()
  })

  it('converts EUR into CHF instead of relabeling', () => {
    const converted = convertToDisplayCurrency(100, 'EUR', 'CHF')
    expect(converted).not.toBeNull()
    expect(converted).not.toBe(100)
  })
})

describe('formatConvertedCurrency', () => {
  it('keeps the source code when currencies match', () => {
    expect(formatConvertedCurrency(1200, 'EUR', 'EUR')).toMatch(/EUR|€/)
  })
})

describe('convertAmountToDisplay', () => {
  it('skips missing and XXX source currencies', () => {
    expect(convertAmountToDisplay(100, null, 'CHF')).toBeNull()
    expect(convertAmountToDisplay(100, 'XXX', 'EUR')).toBeNull()
    expect(convertAmountToDisplay(0, 'EUR', 'CHF')).toBeNull()
  })

  it('converts a known source currency into the settings display currency', () => {
    const converted = convertAmountToDisplay(100, 'EUR', 'CHF')
    expect(converted).not.toBeNull()
    expect(converted).not.toBe(100)
  })
})

describe('summarizeConvertedCurrency', () => {
  it('counts skipped unknown-currency rows', async () => {
    const { summarizeConvertedCurrency } = await import('@/lib/utils/formatters')
    const summary = summarizeConvertedCurrency(
      [
        { amount: 100, currency: 'EUR' },
        { amount: 999, currency: null },
      ],
      'EUR',
    )
    expect(summary.total).toBe(100)
    expect(summary.skippedCount).toBe(1)
    expect(summary.convertedCount).toBe(0)
  })
})

describe('sumToDisplayCurrency', () => {
  it('omits unknown-currency rows instead of treating them as display currency', () => {
    const total = sumToDisplayCurrency(
      [
        { amount: 100, currency: 'EUR' },
        { amount: 999, currency: null },
        { amount: 50, currency: 'XXX' },
      ],
      'EUR',
    )
    expect(total).toBe(100)
  })
})

describe('formatDisplayTotal', () => {
  it('labels portfolio totals as converted only when conversion happened', () => {
    expect(formatDisplayTotal(100, 'CHF')).toMatch(/converted/)
    expect(formatDisplayTotal(100, 'CHF', { converted: false })).not.toMatch(/converted/)
  })

  it('does not render a converted zero as money', () => {
    expect(formatDisplayTotal(0, 'CHF')).toBe('—')
  })
})
