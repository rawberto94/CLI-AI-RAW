import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ContractStatusBanner } from '../ContractStatusBanner'

describe('ContractStatusBanner', () => {
  it('renders artifact regeneration actions and delegates retries', () => {
    const onRetryAllArtifacts = vi.fn()
    const onRetryArtifactType = vi.fn()

    render(
      <ContractStatusBanner
        endDate={null}
        riskLevel="low"
        complianceOk
        failedArtifactTypes={['PARTIES', 'TIMELINE']}
        onRetryAllArtifacts={onRetryAllArtifacts}
        onRetryArtifactType={onRetryArtifactType}
      />,
    )

    expect(screen.getByText(/Partial analysis:/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Contract Parties' }))

    expect(onRetryAllArtifacts).toHaveBeenCalledTimes(1)
    expect(onRetryArtifactType).toHaveBeenCalledWith('PARTIES')
  })
})