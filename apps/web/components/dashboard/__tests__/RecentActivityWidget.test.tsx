import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RecentActivityWidget, type ActivityItem } from '../RecentActivityWidget'

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, whileHover: _whileHover, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
})

const activities: ActivityItem[] = [
  {
    id: 'activity-1',
    type: 'contract_created',
    title: 'Contract created',
    description: 'A new contract was uploaded.',
    timestamp: new Date('2024-01-01T00:00:00.000Z'),
    user: {
      id: 'user-1',
      name: 'Taylor Admin',
      email: 'taylor@example.com',
    },
    contract: {
      id: 'contract-1',
      name: 'Master Services Agreement',
    },
  },
]

describe('RecentActivityWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it('hides the audit-log link for non-admin users', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            role: 'member',
          },
        },
      }),
    })

    render(<RecentActivityWidget activities={activities} showFilters={false} />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/settings')
    })

    expect(screen.queryByText('View all activity')).not.toBeInTheDocument()
  })

  it('shows the audit-log link for admin users', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          user: {
            role: 'admin',
          },
        },
      }),
    })

    render(<RecentActivityWidget activities={activities} showFilters={false} />)

    expect(await screen.findByText('View all activity')).toBeInTheDocument()
  })
})