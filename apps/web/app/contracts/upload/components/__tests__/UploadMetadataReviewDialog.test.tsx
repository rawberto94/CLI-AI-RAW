import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadMetadataReviewDialog } from '../UploadMetadataReviewDialog';

const { mockGetTenantId, mockToastSuccess } = vi.hoisted(() => ({
  mockGetTenantId: vi.fn(),
  mockToastSuccess: vi.fn(),
}));

vi.mock('@/lib/tenant', () => ({
  getTenantId: () => mockGetTenantId(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: mockToastSuccess,
  },
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectTrigger: ({ children, className, id }: React.PropsWithChildren<{ className?: string; id?: string }>) => <div className={className} id={id}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children, value }: React.PropsWithChildren<{ value: string }>) => <div data-value={value}>{children}</div>,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: React.PropsWithChildren<{ open: boolean }>) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <h2 className={className}>{children}</h2>,
  DialogDescription: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <p className={className}>{children}</p>,
}));

describe('UploadMetadataReviewDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenantId.mockReturnValue('tenant-1');
  });

  it('loads review fields and saves edited metadata', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            success: true,
            metadata: {
              document_title: 'msa-final.pdf',
              document_classification: 'contract',
              document_classification_confidence: 0.61,
              start_date: '2026-05-01',
              end_date: '2027-05-01',
              currency: 'USD',
              jurisdiction: 'Delaware',
              _field_confidence: {
                document_title: { value: 0.91 },
              },
            },
            data: {
              contractType: 'UNKNOWN',
              clientName: 'Buyer Corp',
              supplierName: 'Seller LLC',
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const onSaved = vi.fn();

    render(
      <UploadMetadataReviewDialog
        open
        contractId="contract-1"
        fileName="msa-final.pdf"
        remainingCount={0}
        onSkip={() => {}}
        onSkipAll={() => {}}
        onSaved={onSaved}
      />,
    );

    const titleInput = await screen.findByLabelText('Contract title');
    fireEvent.change(titleInput, { target: { value: 'Master Services Agreement' } });
    fireEvent.change(screen.getByLabelText('Contract type'), { target: { value: 'MSA' } });
    fireEvent.click(screen.getByRole('button', { name: /save and continue/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/contracts/contract-1/metadata',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-tenant-id': 'tenant-1',
          }),
        }),
      );
    });

    const secondCall = fetchMock.mock.calls[1];
    expect(JSON.parse(secondCall[1].body as string)).toEqual({
      metadata: expect.objectContaining({
        document_title: 'Master Services Agreement',
        document_classification: 'contract',
        contractType: 'MSA',
        external_parties: [
          { legalName: 'Buyer Corp', role: 'Client' },
          { legalName: 'Seller LLC', role: 'Service Provider' },
        ],
        start_date: '2026-05-01',
        end_date: '2027-05-01',
        currency: 'USD',
        jurisdiction: 'Delaware',
      }),
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Contract metadata updated.');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('auto-skips when there is nothing to review', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          success: true,
          metadata: {
            document_title: 'Master Services Agreement',
            document_classification: 'contract',
            start_date: '2026-05-01',
            end_date: '2027-05-01',
            tcv_amount: 500000,
            currency: 'USD',
            jurisdiction: 'Delaware',
            _field_confidence: {
              document_title: { value: 0.95 },
              document_classification: { value: 0.95 },
              start_date: { value: 0.95 },
              end_date: { value: 0.95 },
              tcv_amount: { value: 0.95 },
              currency: { value: 0.95 },
              jurisdiction: { value: 0.95 },
            },
            external_parties: [
              { legalName: 'Buyer Corp', role: 'Client' },
              { legalName: 'Seller LLC', role: 'Service Provider' },
            ],
          },
          data: {
            contractType: 'MSA',
            clientName: 'Buyer Corp',
            supplierName: 'Seller LLC',
          },
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const onSkip = vi.fn();

    render(
      <UploadMetadataReviewDialog
        open
        contractId="contract-2"
        fileName="clean-contract.pdf"
        remainingCount={1}
        onSkip={onSkip}
        onSkipAll={() => {}}
        onSaved={() => {}}
      />,
    );

    await waitFor(() => {
      expect(onSkip).toHaveBeenCalledTimes(1);
    });
  });
});