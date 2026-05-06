import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockArtifactFindFirst,
  mockLearningRecordCreate,
  mockUpdateArtifact,
  mockProcessFeedback,
  mockQueueRAGIndexing,
} = vi.hoisted(() => ({
  mockArtifactFindFirst: vi.fn(),
  mockLearningRecordCreate: vi.fn(),
  mockUpdateArtifact: vi.fn(),
  mockProcessFeedback: vi.fn(),
  mockQueueRAGIndexing: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    artifact: {
      findFirst: mockArtifactFindFirst,
    },
    learningRecord: {
      create: mockLearningRecordCreate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  editableArtifactService: {
    updateArtifact: mockUpdateArtifact,
  },
}));

vi.mock('@repo/workers/agents/user-feedback-learner', () => ({
  UserFeedbackLearner: class {
    processFeedback = mockProcessFeedback;
  },
}));

vi.mock('@repo/utils/queue/contract-queue', () => ({
  getContractQueue: () => ({
    queueRAGIndexing: mockQueueRAGIndexing,
  }),
}));

import { PUT } from '../route';

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/artifacts/artifact-1', {
    method: 'PUT',
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

describe('/api/contracts/[id]/artifacts/[artifactId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArtifactFindFirst.mockResolvedValue({ id: 'artifact-1' });
    mockUpdateArtifact.mockResolvedValue({
      id: 'artifact-1',
      artifactType: 'EXECUTIVE_SUMMARY',
      previousContent: { summary: 'before' },
    });
    mockProcessFeedback.mockResolvedValue(undefined);
    mockQueueRAGIndexing.mockResolvedValue(undefined);
  });

  it('records learning writes for authenticated contract edits', async () => {
    const response = await PUT(
      createRequest({ updates: { summary: 'after' }, reason: 'manual correction' }),
      routeContext,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockProcessFeedback).toHaveBeenCalledOnce();
    expect(mockLearningRecordCreate).toHaveBeenCalledOnce();
  });
});