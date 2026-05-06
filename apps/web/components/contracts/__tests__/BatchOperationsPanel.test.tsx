import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BatchOperationsPanel } from '../BatchOperationsPanel';

const { mockFetch, successToast, errorToast } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  successToast: vi.fn(),
  errorToast: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: successToast,
    error: errorToast,
  },
}));

vi.mock('@/lib/tenant', () => ({
  getTenantId: () => 'tenant-1',
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: React.PropsWithChildren<{ onClick?: () => void; className?: string }>) => (
    <button type="button" role="menuitem" className={className} onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <div />,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: React.PropsWithChildren) => <button type="button">{children}</button>,
  AlertDialogAction: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

describe('BatchOperationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('sends delete operations to the bulk operations API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { deleted: 2, failed: 0 } }),
    });

    const onClearSelection = vi.fn();
    const onOperationComplete = vi.fn();

    render(
      <BatchOperationsPanel
        selectedIds={['contract-1', 'contract-2']}
        onClearSelection={onClearSelection}
        onOperationComplete={onOperationComplete}
      />,
    );

    fireEvent.pointerDown(screen.getByRole('button', { name: /more/i }));
    fireEvent.click(await screen.findByText('Delete'));
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/contracts/bulk', expect.objectContaining({
        method: 'POST',
      }));
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/contracts/bulk', expect.objectContaining({
      body: JSON.stringify({
        operation: 'delete',
        contractIds: ['contract-1', 'contract-2'],
      }),
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'x-tenant-id': 'tenant-1',
      }),
    }));
    expect(onOperationComplete).toHaveBeenCalledWith('delete', { success: 2, failed: 0, errors: undefined });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('sends categorize operations to the categorization API', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { results: [{ success: true }, { success: true }] } }),
    });

    render(
      <BatchOperationsPanel
        selectedIds={['contract-1', 'contract-2']}
        onClearSelection={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /categorize/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/contracts/categorize', expect.objectContaining({
        method: 'POST',
      }));
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/contracts/categorize', expect.objectContaining({
      body: JSON.stringify({
        contractIds: ['contract-1', 'contract-2'],
        forceRecategorize: true,
      }),
    }));
  });

  it('reprocesses each selected contract individually', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { success: true } }),
    });

    render(
      <BatchOperationsPanel
        selectedIds={['contract-1', 'contract-2']}
        onClearSelection={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /reprocess/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/contracts/contract-1/process', {
      method: 'POST',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
    });
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/contracts/contract-2/process', {
      method: 'POST',
      headers: {
        'x-tenant-id': 'tenant-1',
      },
    });
  });
});