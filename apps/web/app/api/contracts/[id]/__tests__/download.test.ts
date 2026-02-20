import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── mocks ──────────────────────────────────────────────────────────

const {
  mockContractFindFirst,
  mockGetApiTenantId,
  mockInitializeStorage,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockGetApiTenantId: vi.fn(),
  mockInitializeStorage: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: { findFirst: mockContractFindFirst },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } }),
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: mockGetApiTenantId,
  getServerTenantId: mockGetApiTenantId,
}));

vi.mock('@/lib/storage-service', () => ({
  initializeStorage: (...args: unknown[]) => mockInitializeStorage(...args),
}));

import { GET } from '../download/route';

// ── helpers ──────────────────────────────────────────────────────────

function authReq(url: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
}

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

const BASE = 'http://localhost:3000/api/contracts/c1/download';
const params = Promise.resolve({ id: 'c1' });

// ── Tests ────────────────────────────────────────────────────────────

describe('GET /api/contracts/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
    mockInitializeStorage.mockReturnValue(null);
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when contract not found', async () => {
    mockContractFindFirst.mockResolvedValue(null);
    const res = await GET(authReq(BASE), { params });
    expect(res.status).toBe(404);
  });

  it('serves file from object storage when storagePath exists', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 fake content');
    mockContractFindFirst.mockResolvedValue({
      id: 'c1',
      contractTitle: 'NDA Agreement',
      fileName: 'nda.pdf',
      originalName: 'nda-agreement.pdf',
      mimeType: 'application/pdf',
      storagePath: 'contracts/tenant-1/nda.pdf',
      rawText: null,
      fileSize: BigInt(pdfBuffer.length),
      status: 'active',
    });
    mockInitializeStorage.mockReturnValue({
      download: vi.fn().mockResolvedValue(pdfBuffer),
    });

    const res = await GET(authReq(BASE), { params });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('nda-agreement.pdf');
  });

  it('serves rawText as downloadable file when no storagePath', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'c1',
      contractTitle: 'Test Contract',
      fileName: 'test.txt',
      originalName: null,
      mimeType: 'text/plain',
      storagePath: null,
      rawText: 'This is the contract content for testing purposes.',
      fileSize: null,
      status: 'active',
    });

    let res: any;
    try {
      res = await GET(authReq(BASE), { params });
    } catch (err) {
      throw err;
    }
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/plain');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    const text = await res.text();
    expect(text).toBe('This is the contract content for testing purposes.');
  });

  it('serves HTML rawText with correct content type', async () => {
    const htmlContent = '<html><body><h1>Contract</h1></body></html>';
    mockContractFindFirst.mockResolvedValue({
      id: 'c1',
      contractTitle: 'HTML Contract',
      fileName: 'contract.html',
      originalName: null,
      mimeType: 'text/html',
      storagePath: null,
      rawText: htmlContent,
      fileSize: null,
      status: 'active',
    });

    const res = await GET(authReq(BASE), { params });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
    const text = await res.text();
    expect(text).toBe(htmlContent);
  });

  it('returns 404 when no file content available', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'c1',
      contractTitle: 'Empty Contract',
      fileName: null,
      originalName: null,
      mimeType: null,
      storagePath: null,
      rawText: null,
      fileSize: null,
      status: 'active',
    });

    const res = await GET(authReq(BASE), { params });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toContain('no downloadable file');
  });

  it('falls back to rawText when storage download fails', async () => {
    mockContractFindFirst.mockResolvedValue({
      id: 'c1',
      contractTitle: 'Fallback Contract',
      fileName: 'test.pdf',
      originalName: null,
      mimeType: 'application/pdf',
      storagePath: 'contracts/tenant-1/test.pdf',
      rawText: 'Fallback content',
      fileSize: null,
      status: 'active',
    });
    mockInitializeStorage.mockReturnValue({
      download: vi.fn().mockRejectedValue(new Error('Storage error')),
    });

    const res = await GET(authReq(BASE), { params });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('Fallback content');
  });
});
