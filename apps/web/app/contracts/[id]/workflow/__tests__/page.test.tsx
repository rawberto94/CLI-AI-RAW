import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ContractWorkflowPage from '../page';

const { mockFetch, successToast, errorToast, mockPush } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'contract-1' }),
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/tenant', () => ({
  getTenantId: () => 'tenant-1',
}));

vi.mock('sonner', () => ({
  toast: {
    success: successToast,
    error: errorToast,
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, layout: _layout, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

describe('ContractWorkflowPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('loads approvers from the tenant-scoped users endpoint', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'contract-1',
            contractTitle: 'Master Service Agreement',
            fileName: 'msa.pdf',
            totalValue: 120000,
            status: 'DRAFT',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            users: [
              {
                id: 'user-2',
                name: 'Jane Reviewer',
                email: 'jane@example.com',
                role: 'member',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            workflow: null,
            governance: null,
          },
        }),
      });

    render(<ContractWorkflowPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/users', {
        headers: { 'x-tenant-id': 'tenant-1' },
      });
    });

    expect(mockFetch).not.toHaveBeenCalledWith('/api/admin/users', expect.anything());
    expect(await screen.findByText('Contract Workflow')).toBeInTheDocument();
  });
});