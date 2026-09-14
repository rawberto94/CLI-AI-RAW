import { describe, expect, it } from 'vitest'
import { parseIsoDate, parseMonetaryAmount, normalizeExtractedFieldValue } from '../contract-extraction'

describe('parseMonetaryAmount', () => {
  it('parses Swiss apostrophe thousands', () => {
    expect(parseMonetaryAmount("Fr. 1'200'000")).toBe(1_200_000)
    expect(parseMonetaryAmount("CHF 1'400.50")).toBe(1400.5)
  })

  it('parses European thousands with comma decimals', () => {
    expect(parseMonetaryAmount('1.400,50')).toBe(1400.5)
  })

  it('parses German thousands-dot amounts when locale is de', () => {
    expect(parseMonetaryAmount('1.200', { locale: 'de' })).toBe(1200)
    expect(parseMonetaryAmount('1.200,50', { locale: 'de' })).toBe(1200.5)
  })

  it('does not treat EN 1.200 as one thousand two hundred', () => {
    expect(parseMonetaryAmount('1.200', { locale: 'en' })).toBe(1.2)
  })

  it('does not invent a value from empty text', () => {
    expect(parseMonetaryAmount('')).toBeNull()
  })

  it('parses Swiss unicode apostrophe thousands', () => {
    expect(parseMonetaryAmount('CHF 1’500.00')).toBe(1500)
    expect(parseMonetaryAmount("CHF 1‘500.00")).toBe(1500)
  })

  it('parses European comma decimals and thousands', () => {
    expect(parseMonetaryAmount('EUR 1.500,00')).toBe(1500)
    expect(parseMonetaryAmount('EUR 1500,50')).toBe(1500.5)
    expect(parseMonetaryAmount('EUR 1500,50.')).toBe(1500.5)
  })

  it('rejects ambiguous 1.200 without a locale', () => {
    expect(parseMonetaryAmount('1.200')).toBeNull()
  })

  it('does not parse formatted currency strings as US commas', () => {
    expect(normalizeExtractedFieldValue('CHF 1’500.00', 'currency', { locale: 'de' })).toBe(1500)
    expect(normalizeExtractedFieldValue('EUR 1.500,00', 'currency', { locale: 'de' })).toBe(1500)
    expect(normalizeExtractedFieldValue('EUR 1500,50', 'currency', { locale: 'de' })).toBe(1500.5)
  })
})

describe('parseIsoDate Swiss numeric dates', () => {
  it('treats 01.04.2026 as 1 April, not US January 4', () => {
    expect(parseIsoDate('01.04.2026')).toBe('2026-04-01')
  })

  it('treats ambiguous 01/04/2026 as DD/MM (1 April)', () => {
    expect(parseIsoDate('01/04/2026')).toBe('2026-04-01')
  })

  it('treats 13/01/2026 as 13 January', () => {
    expect(parseIsoDate('13/01/2026')).toBe('2026-01-13')
  })
})
