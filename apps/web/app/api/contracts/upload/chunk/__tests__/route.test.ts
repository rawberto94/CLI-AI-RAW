import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockUploadToStorage,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockUploadToStorage: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
  },
}));

vi.mock('@/lib/storage', () => ({
  uploadToStorage: mockUploadToStorage,
}));

import { POST } from '../route';

function createMultipartRequest(overrides: {
  uploadId?: string;
  chunkIndex?: string;
  totalChunks?: string;
  file?: File;
} = {}, withAuth = true) {
  const file = overrides.file || new File(['part-1'], 'chunk.bin');
  Object.defineProperty(file, 'arrayBuffer', {
    value: vi.fn().mockResolvedValue(new TextEncoder().encode('part-1').buffer),
  });

  const formData = {
    get(name: string) {
      switch (name) {
        case 'chunk':
          return file;
        case 'uploadId':
          return overrides.uploadId || 'upload-1';
        case 'chunkIndex':
          return overrides.chunkIndex || '0';
        case 'totalChunks':
          return overrides.totalChunks || '2';
        default:
          return null;
      }
    },
  };

  const url = 'http://localhost:3000/api/contracts/upload/chunk';
  const headers = new Headers(
    withAuth
      ? {
          'x-user-id': 'user-1',
          'x-tenant-id': 'tenant-1',
        }
      : undefined,
  );

  return {
    method: 'POST',
    url,
    nextUrl: new URL(url),
    headers,
    formData: async () => formData as unknown as FormData,
  } as unknown as NextRequest;
}

describe('/api/contracts/upload/chunk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadToStorage.mockResolvedValue({ success: true, key: 'chunks/tenant-1/upload-1/chunk-0' });
    mockExecuteRaw.mockResolvedValue(undefined);
  });

  it('returns 404 when the upload session is outside the tenant scope', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const response = await POST(createMultipartRequest());
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
    expect(mockUploadToStorage).not.toHaveBeenCalled();
  });

  it('stores chunks under a tenant-scoped key', async () => {
    mockQueryRaw.mockResolvedValue([
      { id: 'upload-1', tenant_id: 'tenant-1', total_chunks: 2 },
    ]);

    const response = await POST(createMultipartRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockUploadToStorage).toHaveBeenCalledWith(
      'chunks/tenant-1/upload-1/chunk-0',
      expect.any(Buffer),
      'application/octet-stream',
    );
  });
});