import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FindingSourceLink } from '../FindingSourceLink'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/contracts/abc',
  useSearchParams: () => new URLSearchParams(),
}))

describe('FindingSourceLink', () => {
  it('renders a view-in-contract control when a quote exists', () => {
    render(
      <FindingSourceLink
        contractId="abc"
        snippet="Supplier shall not be liable for indirect damages."
        heading="Limitation of Liability"
      />,
    )
    expect(screen.getByRole('button', { name: /view in contract/i })).toBeTruthy()
  })

  it('hides when there is no locatable source', () => {
    const { container } = render(<FindingSourceLink contractId="abc" snippet="too" />)
    expect(container.textContent).toBe('')
  })
})
