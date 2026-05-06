import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContractSmartAlerts } from '../ContractSmartAlerts'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

describe('ContractSmartAlerts', () => {
  it('prefers persisted expiration alerts over generated expiration alerts in the same category', () => {
    render(
      <ContractSmartAlerts
        expirationDate="2025-01-01T00:00:00.000Z"
        signatureStatus="unsigned"
        persistedAlerts={[
          {
            id: 'alert-1',
            alertType: 'EXPIRATION_30_DAYS',
            severity: 'CRITICAL',
            title: 'Backend Expiration Alert',
            message: 'This alert came from the persisted alerts API.',
            daysBeforeExpiry: 3,
          },
        ]}
      />,
    )

    expect(screen.getByText('Backend Expiration Alert')).toBeInTheDocument()
    expect(screen.queryByText('Contract Expired')).not.toBeInTheDocument()
    expect(screen.getByText('Contract Not Signed')).toBeInTheDocument()
  })
})