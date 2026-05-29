import { describe, expect, it, vi } from 'vitest';

const { mockWarn } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: mockWarn,
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/openai-client', () => ({
  getOpenAIApiKey: vi.fn(() => null),
  hasAIClientConfig: vi.fn(() => false),
  createOpenAIClient: vi.fn(() => ({
    chat: { completions: { create: vi.fn() } },
    embeddings: { create: vi.fn() },
  })),
  createEmbeddingClient: vi.fn(() => ({
    embeddings: { create: vi.fn() },
  })),
}));

import { hybridSearch } from '../advanced-rag.service';

describe('hybridSearch tenant scoping', () => {
  it('refuses unscoped searches even when a contract id is supplied', async () => {
    await expect(hybridSearch('termination', {
      filters: { contractIds: ['contract-1'] },
    })).resolves.toEqual([]);

    expect(mockWarn).toHaveBeenCalledWith(
      '[RAG] Refusing unscoped hybrid search without tenantId',
      { hasContractIds: true },
    );
  });
});