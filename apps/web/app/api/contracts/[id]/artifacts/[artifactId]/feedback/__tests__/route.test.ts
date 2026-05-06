import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockArtifactFindFirst,
  mockArtifactUpdate,
  mockLearningRecordCreate,
} = vi.hoisted(() => ({
  mockArtifactFindFirst: vi.fn(),
  mockArtifactUpdate: vi.fn(),
  mockLearningRecordCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    artifact: {
      findFirst: mockArtifactFindFirst,
      update: mockArtifactUpdate,
    },
    learningRecord: {
      create: mockLearningRecordCreate,
    },
  },
}));

import { POST } from '../route';

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/artifacts/artifact-1/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'admin',
    },
    body: JSON.stringify(body),
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1', artifactId: 'artifact-1' }),
};

describe('/api/contracts/[id]/artifacts/[artifactId]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArtifactFindFirst.mockResolvedValue({ id: 'artifact-1' });
    mockArtifactUpdate.mockResolvedValue({
      id: 'artifact-1',
      type: 'RISK',
      userRating: 4,
      feedbackNotes: 'Looks correct',
      feedbackBy: 'user-1',
      feedbackAt: new Date('2026-04-28T12:00:00.000Z'),
      isUserVerified: false,
      verifiedBy: null,
      verifiedAt: null,
    });
  });

  it('records learning feedback for authenticated artifact reviews', async () => {
    const response = await POST(
      createRequest({ rating: 4, notes: 'Looks correct' }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockLearningRecordCreate).toHaveBeenCalledOnce();
  });
});