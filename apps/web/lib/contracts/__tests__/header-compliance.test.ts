import { describe, expect, it } from 'vitest'

import { describeHeaderCompliance, mapHeaderComplianceScore, normalizePercentScore } from '../header-compliance'

describe('normalizePercentScore', () => {
  it('passes through 0–100 integers', () => {
    expect(normalizePercentScore(0)).toBe(0)
    expect(normalizePercentScore(72)).toBe(72)
    expect(normalizePercentScore(100)).toBe(100)
  })

  it('scales 0–1 fractions to percent', () => {
    expect(normalizePercentScore(0.85)).toBe(85)
  })

  it('rejects non-scores', () => {
    expect(normalizePercentScore(150)).toBeUndefined()
    expect(normalizePercentScore(NaN)).toBeUndefined()
    expect(normalizePercentScore('80')).toBeUndefined()
  })
})

describe('mapHeaderComplianceScore — policy pack', () => {
  const policyArtifact = {
    status: 'FAIL',
    policyScore: 55,
    findings: [
      {
        ruleCode: 'GDPR-1',
        status: 'VIOLATION',
        severity: 'CRITICAL',
        title: 'Missing DPA',
        detail: 'No data processing agreement found',
      },
      {
        ruleCode: 'TERM-2',
        status: 'PASS',
        severity: 'LOW',
        title: 'Term present',
        detail: 'Termination clause exists',
      },
    ],
  }

  it('uses policyScore and non-pass findings when policy_check is present', () => {
    const result = mapHeaderComplianceScore({
      policy_check: policyArtifact,
      compliance: { complianceScore: 100, checks: [{ name: 'LLM', status: 'passed' }] },
    })

    expect(result.source).toBe('policy')
    expect(result.score).toBe(55)
    expect(result.isCompliant).toBe(false)
    expect(result.violations).toEqual(['No data processing agreement found'])
  })

  it('keeps evidence quotes on failing checks so the UI can open the source span', () => {
    const result = mapHeaderComplianceScore({
      policy_check: {
        status: 'FAIL',
        policyScore: 40,
        findings: [
          {
            ruleCode: 'LIAB-1',
            status: 'VIOLATION',
            title: 'Unlimited liability',
            detail: 'No cap',
            evidence: [{ quote: 'Supplier shall not be liable for any damages whatsoever', startOffset: 120, endOffset: 180 }],
          },
        ],
      },
    })
    expect(result.checks[0]?.quote).toMatch(/shall not be liable/)
    expect(result.checks[0]?.startOffset).toBe(120)
    expect(result.checks[0]?.endOffset).toBe(180)
  })

  it('describes the policy formula instead of confidence', () => {
    const result = mapHeaderComplianceScore({
      policy_check: {
        ...policyArtifact,
        packName: 'Global Baseline',
        penalty: 45,
        criticalCount: 1,
        highCount: 0,
      },
    })
    const copy = describeHeaderCompliance(result)
    expect(copy).toMatch(/Policy pack Global Baseline/)
    expect(copy).toMatch(/55\/100/)
    expect(copy).toMatch(/100 − 45 penalty/)
    expect(copy).not.toMatch(/confidence/i)
  })

  it('takes precedence over LLM COMPLIANCE for POLICY_CHECK key as well', () => {
    const result = mapHeaderComplianceScore({
      POLICY_CHECK: { status: 'PASS', policyScore: 92, findings: [] },
      compliance: {
        checks: [{ name: 'GDPR', status: 'failed', message: 'LLM fail' }],
        complianceScore: 10,
      },
    })

    expect(result.source).toBe('policy')
    expect(result.score).toBe(92)
    expect(result.isCompliant).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('treats PASS_WITH_NOTES as compliant while listing low findings', () => {
    const result = mapHeaderComplianceScore({
      policy_check: {
        status: 'PASS_WITH_NOTES',
        policyScore: 90,
        findings: [
          { ruleCode: 'NOTE-1', status: 'MISSING', severity: 'LOW', title: 'Optional clause', detail: 'Notice period is short' },
        ],
      },
    })

    expect(result.source).toBe('policy')
    expect(result.score).toBe(90)
    expect(result.isCompliant).toBe(true)
    expect(result.violations).toEqual(['Notice period is short'])
  })

  it('treats REVIEW as non-compliant', () => {
    const result = mapHeaderComplianceScore({
      policy_check: {
        status: 'REVIEW',
        policyScore: 78,
        findings: [
          { ruleCode: 'HIGH-1', status: 'VIOLATION', severity: 'HIGH', title: 'Cap missing', detail: 'Liability cap absent' },
        ],
      },
    })

    expect(result.isCompliant).toBe(false)
    expect(result.score).toBe(78)
    expect(result.violations).toEqual(['Liability cap absent'])
  })

  it('does not treat INDETERMINATE with no issues as a silent 100% pass', () => {
    const result = mapHeaderComplianceScore({
      policy_check: { status: 'INDETERMINATE', policyScore: 100, findings: [] },
    })

    expect(result.source).toBe('policy')
    expect(result.score).toBe(100)
    expect(result.isCompliant).toBeNull()
    expect(result.violations).toEqual([])
  })

  it('keeps integer policy scores of 0 and 1 (does not scale them as fractions)', () => {
    expect(mapHeaderComplianceScore({
      policy_check: {
        status: 'FAIL',
        policyScore: 0,
        findings: [{ ruleCode: 'BLK', status: 'VIOLATION', title: 'Blocker', detail: 'Blocked' }],
      },
    }).score).toBe(0)

    expect(mapHeaderComplianceScore({
      policy_check: { status: 'FAIL', policyScore: 1, findings: [] },
    }).score).toBe(1)
  })

  it('omits waived findings from header violations', () => {
    const result = mapHeaderComplianceScore({
      policy_check: {
        status: 'PASS',
        policyScore: 100,
        findings: [
          { ruleCode: 'W-1', status: 'VIOLATION', title: 'Waived', detail: 'Was a violation', waiverId: 'w1' },
        ],
      },
    })

    expect(result.violations).toEqual([])
    expect(result.isCompliant).toBe(true)
  })

  it('reads policy artifacts from an array of { type, data }', () => {
    const result = mapHeaderComplianceScore([
      { type: 'COMPLIANCE', data: { complianceScore: 100, checks: [{ name: 'x', status: 'passed' }] } },
      { type: 'POLICY_CHECK', data: { status: 'FAIL', policyScore: 40, findings: [{ status: 'MISSING', title: 'Gap' }] } },
    ])

    expect(result.source).toBe('policy')
    expect(result.score).toBe(40)
    expect(result.violations).toEqual(['Gap'])
  })
})

describe('mapHeaderComplianceScore — LLM COMPLIANCE fallback', () => {
  it('ignores LLM fallback templates so a missing analysis is not a 0% score', () => {
    const result = mapHeaderComplianceScore({
      compliance: {
        compliant: null,
        complianceScore: 0,
        checks: [],
        _meta: { fallback: true, reason: 'AI unavailable' },
      },
    })
    expect(result.source).toBe('none')
    expect(result.score).toBeUndefined()
    expect(result.isCompliant).toBeNull()
  })

  it('scores the share of passed / not-applicable checks', () => {
    const result = mapHeaderComplianceScore({
      compliance: {
        checks: [
          { name: 'A', status: 'passed' },
          { name: 'B', status: 'not-applicable' },
          { name: 'C', status: 'failed', message: 'Missing retention clause' },
        ],
      },
    })

    expect(result.source).toBe('llm')
    expect(result.score).toBe(67)
    expect(result.isCompliant).toBe(false)
    expect(result.violations).toEqual(['Missing retention clause'])
  })

  it('counts needs-review and non-compliant as issues, not as passes', () => {
    const result = mapHeaderComplianceScore({
      compliance: {
        checks: [
          { name: 'GDPR', status: 'needs-review', message: 'Unclear processor role' },
          { name: 'SOX', status: 'non-compliant', details: 'Audit right missing' },
        ],
      },
    })

    expect(result.score).toBe(0)
    expect(result.isCompliant).toBe(false)
    expect(result.violations).toEqual(['Unclear processor role', 'Audit right missing'])
  })

  it('does not treat unknown statuses as passes in the ratio', () => {
    const result = mapHeaderComplianceScore({
      compliance: {
        checks: [
          { name: 'Pending', status: 'pending' },
          { name: 'GDPR', status: 'failed', message: 'No DPA' },
        ],
        complianceScore: 100,
      },
    })

    expect(result.score).toBe(0)
    expect(result.isCompliant).toBe(false)
    expect(result.violations).toEqual(['No DPA'])
  })

  it('leaves score unassessed when there are no scored checks and no numeric score', () => {
    const result = mapHeaderComplianceScore({
      compliance: { checks: [{ name: 'Pending', status: 'pending' }] },
    })

    expect(result.score).toBeUndefined()
    expect(result.isCompliant).toBeNull()
    expect(result.source).toBe('llm')
  })

  it('uses medium+ issues as violations even if checks passed', () => {
    const result = mapHeaderComplianceScore({
      compliance: {
        checks: [{ name: 'A', status: 'passed' }],
        issues: [{ severity: 'high', description: 'Governing law conflict' }],
      },
    })

    expect(result.score).toBe(100)
    expect(result.isCompliant).toBe(false)
    expect(result.violations).toEqual(['Governing law conflict'])
  })

  it('returns not-assessed when there is no compliance or policy artifact', () => {
    const result = mapHeaderComplianceScore({ overview: { summary: 'hello' } })
    expect(result).toEqual({
      isCompliant: null,
      checks: [],
      violations: [],
      score: undefined,
      source: 'none',
    })
  })
})
