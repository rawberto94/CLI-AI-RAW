import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/openai-client', () => ({
  createOpenAIClient: () => ({ chat: { completions: { create: vi.fn() } } }),
  hasAIClientConfig: () => true,
}))

vi.mock('../anonymizer', () => ({
  ContractAnonymizer: class {},
  processWithAnonymization: vi.fn(),
}))

import { calculateConfidence } from '../custom-analysis'

describe('custom analysis citation support', () => {
  it('does not treat invented section citations as high accuracy', () => {
    const source = 'This agreement is between Acme and Globex for consulting services in Zurich.'
    const invented = 'Section 999 requires the supplier to pay USD 1. Section 999 also waives all liability. Section 999 is binding.'
    expect(calculateConfidence(invented, source)).toBeLessThan(0.3)
  })

  it('scores higher when cited sections exist in the source', () => {
    const source = 'Section 5.2 Notice. Either party may terminate with 90 days notice.'
    const response = 'Section 5.2 allows termination with prior notice.'
    expect(calculateConfidence(response, source)).toBeGreaterThan(0.4)
  })
})
