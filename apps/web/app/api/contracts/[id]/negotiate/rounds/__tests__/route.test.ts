import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractUpdate,
  mockAuditLogCreate,
  mockPushAgentNotification,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractUpdate: vi.fn(),
  mockAuditLogCreate: vi.fn(),
  mockPushAgentNotification: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
      update: mockContractUpdate,
    },
    auditLog: {
      create: mockAuditLogCreate,
    },
  },
}));

vi.mock('@/lib/ai/agent-notifications', () => ({
  pushAgentNotification: mockPushAgentNotification,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET, POST } from '../route';

function createRequest(
  method: 'GET' | 'POST',
  withAuth = true,
  body?: Record<string, unknown>,
): NextRequest {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/negotiate/rounds', {
    method,
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

describe('/api/contracts/[id]/negotiate/rounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      contractTitle: 'Master Services Agreement',
      negotiationNotes: null,
      negotiationStatus: null,
      negotiationRound: 0,
    });
  });

  it('returns 401 without auth headers', async () => {
    const response = await GET(createRequest('GET', false), routeContext);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when the contract is not in the tenant', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns parsed negotiation rounds for a tenant-owned contract', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      contractTitle: 'Master Services Agreement',
      negotiationStatus: 'IN_NEGOTIATION',
      negotiationRound: 2,
      negotiationNotes: JSON.stringify([
        {
          id: 'round-1',
          round: 1,
          initiatedBy: 'user-1',
          status: 'pending',
          changes: [{ clause: '4.2', original: 'old', proposed: 'new' }],
          message: 'Please update clause 4.2',
          createdAt: '2026-04-29T10:00:00.000Z',
        },
      ]),
    });

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.rounds).toHaveLength(1);
    expect(data.data.negotiationStatus).toBe('IN_NEGOTIATION');
    expect(data.data.currentRound).toBe(2);
  });

  it('creates a new negotiation round and records audit activity', async () => {
    const response = await POST(createRequest('POST', true, {
      message: 'Please revise indemnity language',
      changes: [{ clause: 'Indemnity', original: 'Original', proposed: 'Proposed' }],
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(mockContractUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        negotiationRound: 1,
        negotiationStatus: 'IN_NEGOTIATION',
      }),
    }));
    expect(mockAuditLogCreate).toHaveBeenCalled();
    expect(mockPushAgentNotification).toHaveBeenCalled();
  });

  it('updates an existing negotiation round response', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'contract-1',
      contractTitle: 'Master Services Agreement',
      negotiationStatus: 'IN_NEGOTIATION',
      negotiationRound: 1,
      negotiationNotes: JSON.stringify([
        {
          id: 'round-1',
          round: 1,
          initiatedBy: 'user-2',
          status: 'pending',
          changes: [{ clause: '4.2', original: 'old', proposed: 'new' }],
          message: 'Please update clause 4.2',
          createdAt: '2026-04-29T10:00:00.000Z',
        },
      ]),
    });

    const response = await POST(createRequest('POST', true, {
      roundId: 'round-1',
      status: 'accepted',
      responseMessage: 'Approved as proposed',
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.round.status).toBe('accepted');
    expect(data.data.round.respondedBy).toBe('user-1');
    expect(mockContractUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'contract-1' },
      data: expect.objectContaining({
        negotiationNotes: expect.stringContaining('accepted'),
      }),
    }));
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
    expect(mockPushAgentNotification).toHaveBeenCalled();
  });
});