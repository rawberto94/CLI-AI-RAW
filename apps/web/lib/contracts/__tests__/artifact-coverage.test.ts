import { describe, expect, it } from 'vitest'

import {
  computeArtifactCoverage,
  defaultArtifactApplicable,
  getMissingArtifactDetails,
} from '../artifact-coverage'

describe('defaultArtifactApplicable', () => {
  it('does not expect rate cards or financial analysis on an NDA', () => {
    expect(defaultArtifactApplicable('NDA', 'rates')).toBe(false)
    expect(defaultArtifactApplicable('NDA', 'financial')).toBe(false)
    expect(defaultArtifactApplicable('NDA', 'clauses')).toBe(true)
  })
})

describe('computeArtifactCoverage', () => {
  it('omits not-applicable slots from the missing list', () => {
    const coverage = computeArtifactCoverage({
      contractType: 'NDA',
      artifacts: [
        { type: 'OVERVIEW', data: { summary: 'ok' } },
        { type: 'CLAUSES', data: { clauses: [] } },
      ],
    })
    const missingTypes = coverage.missing.map((item) => item.type)
    expect(missingTypes).not.toContain('rates')
    expect(missingTypes).not.toContain('financial')
    expect(missingTypes).not.toContain('deliverables')
    expect(missingTypes).toContain('risk')
  })

  it('labels fallback artifacts as failed rather than not generated', () => {
    const coverage = computeArtifactCoverage({
      contractType: 'MSA',
      artifacts: [
        { type: 'OVERVIEW', data: { summary: 'ok' } },
        { type: 'RISK', data: { fallback: true, error: 'Failed to generate' } },
      ],
    })
    const risk = coverage.missing.find((item) => item.type === 'risk')
    expect(risk?.reason).toBe('failed')
    expect(risk?.label).toBe('Risk assessment')
  })

  it('treats worker _meta.fallback templates as failed analysis', () => {
    const coverage = computeArtifactCoverage({
      contractType: 'MSA',
      artifacts: [
        { type: 'COMPLIANCE', data: { _meta: { fallback: true, reason: 'AI unavailable' }, complianceScore: null } },
      ],
    })
    const compliance = coverage.missing.find((item) => item.type === 'compliance')
    expect(compliance?.reason).toBe('failed')
  })
})

describe('getMissingArtifactDetails', () => {
  it('trusts an empty missingArtifactTypes array instead of inventing Rate Cards', () => {
    const details = getMissingArtifactDetails({
      artifactTypes: ['overview', 'clauses'],
      missingArtifactTypes: [],
    })
    expect(details).toEqual([])
  })

  it('uses human labels and skip reasons from the status payload', () => {
    const details = getMissingArtifactDetails({
      missingArtifacts: [
        { type: 'risk', label: 'Risk assessment', reason: 'failed' },
        { type: 'CLAUSES', reason: 'not_generated' },
      ],
    })
    expect(details).toEqual([
      { type: 'risk', label: 'Risk assessment', reason: 'failed' },
      { type: 'clauses', label: 'Key clauses', reason: 'not_generated' },
    ])
  })
})
