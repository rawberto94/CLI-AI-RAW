import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockQueryRaw,
  mockExecuteRaw,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

import { POST } from '../route';

function createRequest(body: Record<string, unknown>, withAuth = true) {
  return new NextRequest('http://localhost:3000/api/contracts/upload/init', {
    method: 'POST',
    headers: withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
          'Content-Type': 'application/json',
        }
      : {
          'Content-Type': 'application/json',
        },
    body: JSON.stringify(body),
  });
}

describe('/api/contracts/upload/init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
    mockExecuteRaw.mockResolvedValue(undefined);
  });

  it('returns 401 without auth headers', async () => {
    const response = await POST(createRequest({ uploadId: 'u1' }, false));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 409 when the upload session belongs to another tenant', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 'upload-1', tenant_id: 'tenant-2' }]);

    const response = await POST(createRequest({
      uploadId: 'upload-1',
      fileName: 'contract.pdf',
      fileSize: 120,
      mimeType: 'application/pdf',
      totalChunks: 3,
    }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('CONFLICT');
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});