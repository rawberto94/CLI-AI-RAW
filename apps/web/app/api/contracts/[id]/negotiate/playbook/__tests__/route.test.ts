import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockArtifactFindFirst,
  mockGenerateAndStorePlaybook,
  mockContractUpdate,
  mockAuditLogCreate,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockArtifactFindFirst: vi.fn(),
  mockGenerateAndStorePlaybook: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    artifact: {
      findFirst: mockArtifactFindFirst,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

vi.mock('@/lib/ai/negotiation-copilot.service', () => ({
  generateAndStorePlaybook: mockGenerateAndStorePlaybook,
}));

import { GET, POST } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(method: 'GET' | 'POST', body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/negotiate/playbook', {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'admin',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('/api/contracts/[id]/negotiate/playbook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty playbook payload when no negotiation artifact exists', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1', negotiationStatus: null });
    mockArtifactFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.playbook).toBeNull();
    expect(data.data.negotiationStatus).toBe('DRAFT');
  });

  it('returns 422 when the contract has no extracted text', async () => {
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1', rawText: '', negotiationStatus: null });

    const response = await POST(createRequest('POST', {}), routeContext);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(mockGenerateAndStorePlaybook).not.toHaveBeenCalled();
  });
});