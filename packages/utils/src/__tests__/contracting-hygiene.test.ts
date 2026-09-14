import { describe, expect, it } from 'vitest'
import {
  applyContractingHygieneToCompliance,
  assessContractingHygiene,
} from '../contracting-hygiene'

describe('assessContractingHygiene', () => {
  it('flags giving 20% of quotes for not respecting a rule', () => {
    const text = 'In case of not respecting a rule the company will give 20% of its total quotes to the other party.'
    const result = assessContractingHygiene(text)
    expect(result.issues.some((issue) => issue.rule === 'unenforceable-forfeiture')).toBe(true)
    expect(result.issues.some((issue) => issue.rule === 'vague-rule-breach')).toBe(true)
    expect(result.scoreCap).toBe(35)
  })

  it('does not flag a normal liquidated-damages clause', () => {
    const text = 'If Supplier misses a milestone, Client may claim liquidated damages of 2% of the delayed deliverable fee, capped at 10% of the Total Contract Value.'
    const result = assessContractingHygiene(text)
    expect(result.issues).toEqual([])
  })

  it('flags paraphrased forfeiture of pipeline/quotes', () => {
    const text = 'The vendor shall donate a fifth of billable pipeline upon any infraction of a rule.'
    const result = assessContractingHygiene(text)
    expect(result.issues.some((issue) => issue.rule === 'unenforceable-forfeiture')).toBe(true)
    expect(result.scoreCap).toBe(35)
  })

  it('flags a French 20% of quotes penalty', () => {
    const text = 'Si le fournisseur ne respecte pas une règle, il donnera 20% de ses devis.'
    const result = assessContractingHygiene(text)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.scoreCap).not.toBeNull()
  })
})

describe('applyContractingHygieneToCompliance', () => {
  it('overrides an LLM 100% score on dummy penalty text', () => {
    const patched = applyContractingHygieneToCompliance(
      { compliant: true, complianceScore: 100, checks: [{ regulation: 'GDPR', status: 'not-applicable' }], issues: [] },
      'In case of not respecting a rule the company will give 20% of its total quotes.',
    )
    expect(patched?.compliant).toBe(false)
    expect(Number(patched?.complianceScore)).toBeLessThanOrEqual(35)
    expect(Array.isArray(patched?.issues) && (patched?.issues as unknown[]).length).toBeGreaterThan(0)
  })
})
