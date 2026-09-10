import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockFindFirst,
  mockCheckWrite,
  mockSafeDelete,
  mockApplySideEffects,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCheckWrite: vi.fn(),
  mockSafeDelete: vi.fn(),
  mockApplySideEffects: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: { findFirst: mockFindFirst },
  },
}));

vi.mock('@/lib/security/contract-acl', () => ({
  checkContractWritePermission: mockCheckWrite,
}));

vi.mock('@/lib/services/contract-deletion.service', () => ({
  safeDeleteContract: mockSafeDelete,
}));

vi.mock('@/lib/contracts/server/contract-change-side-effects', () => ({
  applyContractChangeSideEffects: mockApplySideEffects,
}));

vi.mock('@/lib/realtime/publish', () => ({
  publishRealtimeEvent: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/queue-init', () => ({
  getInitializedQueueService: () => null,
}));

import { POST } from '../route';

const routeContext = { params: Promise.resolve({ id: 'contract-1' }) };

function createRequest() {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/cancel-upload', {
    method: 'POST',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'owner',
    },
  });
}

describe('POST /api/contracts/[id]/cancel-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckWrite.mockResolvedValue({ allowed: true });
    mockApplySideEffects.mockResolvedValue({});
    mockSafeDelete.mockResolvedValue({ success: true, deletedRecords: {} });
  });

  it('deletes a processing upload', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'contract-1',
      status: 'PROCESSING',
      isDeleted: false,
      fileName: 'MSA.pdf',
    });

    const res = await POST(createRequest(), routeContext as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSafeDelete).toHaveBeenCalledWith('contract-1', 'tenant-1', expect.objectContaining({
      reason: 'user_cancelled_upload',
    }));
  });

  it('rejects cancel of an active executed contract', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'contract-1',
      status: 'ACTIVE',
      isDeleted: false,
      fileName: 'MSA.pdf',
    });

    const res = await POST(createRequest(), routeContext as any);
    expect(res.status).toBe(409);
    expect(mockSafeDelete).not.toHaveBeenCalled();
  });
});
