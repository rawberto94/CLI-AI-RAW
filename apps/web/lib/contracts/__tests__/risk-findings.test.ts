import { describe, expect, it } from 'vitest'

import { normalizeRiskFindings } from '../risk-findings'

describe('normalizeRiskFindings', () => {
  it('reads the prompt shape (risks[].source) used by the worker', () => {
    const findings = normalizeRiskFindings({
      risks: [
        {
          title: 'Unlimited liability',
          description: 'No cap on damages',
          level: 'High',
          clauseReference: '8.1',
          source: 'Supplier shall not be liable for any damages whatsoever',
        },
      ],
    })
    expect(findings).toHaveLength(1)
    expect(findings[0]?.title).toBe('Unlimited liability')
    expect(findings[0]?.snippet).toMatch(/shall not be liable/)
    expect(findings[0]?.heading).toBe('8.1')
  })

  it('also accepts identifiedRisks and redFlags aliases', () => {
    const findings = normalizeRiskFindings({
      identifiedRisks: [{ description: 'Weak termination', sourceClause: 'Either party may terminate at any time' }],
      redFlags: [{ flag: 'Placeholder party', source: '[Client Name] shall pay' }],
    })
    expect(findings.map((f) => f.title)).toEqual(['Weak termination', 'Placeholder party'])
    expect(findings[0]?.snippet).toMatch(/terminate at any time/)
  })

  it('dedupes overlapping lists', () => {
    const findings = normalizeRiskFindings({
      risks: [{ title: 'Cap missing', source: 'no limitation of liability' }],
      riskFactors: [{ title: 'Cap missing', source: 'no limitation of liability' }],
    })
    expect(findings).toHaveLength(1)
  })
})
