import { describe, expect, it } from 'vitest'
import { UNKNOWN_CURRENCY } from '@/lib/fx'
import { DataTransformer } from '../data-transformer'

describe('DataTransformer currency honesty', () => {
  it('does not invent CHF when the source currency is missing', () => {
    const [row] = DataTransformer.transform(
      [{ role: 'Consultant', rate: 1400 }],
      { role: 'role', rate: 'rate' },
    )
    expect(row?.originalCurrency).toBe(UNKNOWN_CURRENCY)
    expect(row?.transformations).not.toContain('currency_converted')
  })

  it('keeps a stated EUR code instead of rewriting it to CHF', () => {
    const [row] = DataTransformer.transform(
      [{ role: 'Consultant', rate: 1400, currency: 'EUR' }],
      { role: 'role', rate: 'rate', currency: 'currency' },
    )
    expect(row?.originalCurrency).toBe('EUR')
  })
})
