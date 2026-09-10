import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PolicyRenderer } from '../artifact-renderers/PolicyRenderer'

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'abc' }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/contracts/abc',
  useSearchParams: () => new URLSearchParams(),
}))

describe('PolicyRenderer', () => {
  it('leads with the finding title instead of the rule code', () => {
    render(
      <PolicyRenderer
        data={{
          status: 'FAIL',
          policyScore: 62,
          findings: [
            {
              ruleCode: 'LIAB-1',
              status: 'VIOLATION',
              severity: 'HIGH',
              title: 'Liability cap missing',
              detail: 'No aggregate cap on damages.',
              evidence: [{ quote: 'Supplier shall not be liable for any damages whatsoever.' }],
            },
          ],
        }}
      />,
    )

    expect(screen.getByText('Liability cap missing')).toBeTruthy()
    expect(screen.getByText('LIAB-1')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Liability cap missing' })).toBeTruthy()
  })

  it('does not treat insufficient evidence as a policy violation', () => {
    render(
      <PolicyRenderer
        data={{
          status: 'PASS',
          policyScore: 100,
          findings: [
            {
              ruleCode: 'GDPR-1',
              status: 'INSUFFICIENT_EVIDENCE',
              title: 'DPA not located',
              detail: 'Could not find a data processing agreement.',
            },
          ],
        }}
      />,
    )

    expect(screen.getByText('No policy violations found')).toBeTruthy()
    expect(screen.getByText('Could not verify from the document')).toBeTruthy()
    expect(screen.getByText('DPA not located')).toBeTruthy()
  })
})
