import { describe, expect, it } from 'vitest'

import {
  UNKNOWN_CURRENCY,
  UNKNOWN_GEO,
  convertedDailyRates,
  resolvePersistCurrency,
  resolvePersistGeo,
} from '../persist-fields'

describe('resolvePersistCurrency', () => {
  it('does not invent USD when nothing was extracted', () => {
    expect(resolvePersistCurrency(null, undefined, '')).toBe(UNKNOWN_CURRENCY)
  })

  it('prefers the rate currency, then the contract currency', () => {
    expect(resolvePersistCurrency('chf', 'USD')).toBe('CHF')
    expect(resolvePersistCurrency('', 'EUR')).toBe('EUR')
  })
})

describe('resolvePersistGeo', () => {
  it('does not invent United States', () => {
    expect(resolvePersistGeo(null, '')).toBe(UNKNOWN_GEO)
    expect(resolvePersistGeo('Switzerland')).toBe('Switzerland')
  })
})

describe('convertedDailyRates', () => {
  it('converts CHF instead of copying the amount into USD and CHF', () => {
    const converted = convertedDailyRates(1400, 'CHF')
    expect(converted.chf).toBe(1400)
    expect(converted.usd).toBeGreaterThan(1400)
  })

  it('does not treat an unknown currency as USD', () => {
    expect(convertedDailyRates(1400, '')).toEqual({ usd: 0, chf: 0 })
    expect(convertedDailyRates(1400, 'XXX')).toEqual({ usd: 0, chf: 0 })
  })
})
