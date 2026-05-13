import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RealtimeArtifactViewer } from '../RealtimeArtifactViewer';

const { mockUseArtifactStream } = vi.hoisted(() => ({
  mockUseArtifactStream: vi.fn(),
}));

vi.mock('@/hooks/useArtifactStream', () => ({
  useArtifactStream: () => mockUseArtifactStream(),
}));

describe('RealtimeArtifactViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseArtifactStream.mockReturnValue({
      artifacts: [
        {
          id: 'artifact-1',
          type: 'OVERVIEW',
          status: 'COMPLETED',
          hasContent: true,
          contentLength: 128,
          qualityScore: null,
          completenessScore: null,
          confidence: 0.92,
          metadata: { preview: 'Overview ready' },
          createdAt: '2026-05-12T08:00:00.000Z',
          updatedAt: '2026-05-12T08:00:00.000Z',
        },
      ],
      isConnected: false,
      isComplete: true,
      contractStatus: 'COMPLETED',
      processingStage: 'COMPLETED',
      error: null,
      contractNotFound: false,
      disconnect: vi.fn(),
      reconnect: vi.fn(),
    });
  });

  it('surfaces partial artifact failures and retries a failed artifact type', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            success: true,
            metadata: {},
            classification: {},
            data: {
              metadata: {
                partialFailure: true,
                failedArtifactTypes: ['PARTIES', 'TIMELINE'],
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            artifacts: [
              { id: 'artifact-1', type: 'OVERVIEW', data: { summary: 'Overview ready' }, confidence: 0.92 },
              { id: 'artifact-2', type: 'PARTIES', data: { parties: ['Buyer Corp'] }, confidence: 0.84 },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            success: true,
            metadata: {},
            classification: {},
            data: {
              metadata: {
                partialFailure: true,
                failedArtifactTypes: ['TIMELINE'],
              },
            },
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<RealtimeArtifactViewer contractId="contract-1" />);

    expect(await screen.findByText('Analysis finished with partial artifact failures')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry Contract Parties' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/contracts/contract-1/artifacts/regenerate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ artifactType: 'PARTIES' }),
        }),
      );
    });

    expect(await screen.findByRole('button', { name: 'Retry Timeline & Milestones' })).toBeInTheDocument();
  });
});