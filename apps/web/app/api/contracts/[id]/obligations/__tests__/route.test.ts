import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockArtifactFindFirst,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockArtifactFindFirst: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    artifact: {
      findFirst: mockArtifactFindFirst,
    },
  },
}));

import { GET } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest() {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/obligations', {
    method: 'GET',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'member',
    },
  });
}

describe('/api/contracts/[id]/obligations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when the contract is outside the tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns a no-obligations payload when no obligations artifact exists', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1', contractTitle: 'MSA' });
    mockArtifactFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest(), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.hasObligations).toBe(false);
  });
});