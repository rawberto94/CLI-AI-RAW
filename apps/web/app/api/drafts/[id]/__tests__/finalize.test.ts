import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── mocks ──────────────────────────────────────────────────────────

const {
  mockDraftFindFirst,
  mockDraftUpdate,
  mockContractCreate,
  mockTransaction,
  mockGetApiTenantId,
} = vi.hoisted(() => ({
  mockDraftFindFirst: vi.fn(),
  mockDraftUpdate: vi.fn(),
  mockContractCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockGetApiTenantId: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contractDraft: { findFirst: mockDraftFindFirst, update: mockDraftUpdate },
    contract: { create: mockContractCreate },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } }),
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: mockGetApiTenantId,
  getServerTenantId: mockGetApiTenantId,
}));

import { POST } from '../finalize/route';

// ── helpers ──────────────────────────────────────────────────────────

function authReq(url: string) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
}

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'POST' });
}

const BASE = 'http://localhost:3000/api/drafts/d1/finalize';
const params = Promise.resolve({ id: 'd1' });

const VALID_DRAFT = {
  id: 'd1',
  tenantId: 'tenant-1',
  title: 'Test Contract Draft',
  content: 'A'.repeat(100), // well over the 50-char minimum
  status: 'APPROVED',
  contractType: 'NDA',
  aiPrompt: 'Generate NDA',
  version: 3,
};

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/drafts/[id]/finalize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiTenantId.mockResolvedValue('tenant-1');
  });

  it('returns 401 without auth', async () => {
    const res = await POST(noAuthReq(BASE), { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when draft not found', async () => {
    mockDraftFindFirst.mockResolvedValue(null);
    const res = await POST(authReq(BASE), { params });
    expect(res.status).toBe(404);
  });

  it('returns 409 when already finalized', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...VALID_DRAFT, status: 'FINALIZED' });
    const res = await POST(authReq(BASE), { params });
    expect(res.status).toBe(409);
  });

  it('returns 422 when content is too short', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...VALID_DRAFT, content: 'short' });
    const res = await POST(authReq(BASE), { params });
    expect(res.status).toBe(422);
  });

  it('returns 422 when title is empty', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...VALID_DRAFT, title: '' });
    const res = await POST(authReq(BASE), { params });
    expect(res.status).toBe(422);
  });

  it('returns 422 when title is missing', async () => {
    mockDraftFindFirst.mockResolvedValue({ ...VALID_DRAFT, title: null });
    const res = await POST(authReq(BASE), { params });
    expect(res.status).toBe(422);
  });

  it('finalizes a valid draft and creates a contract', async () => {
    mockDraftFindFirst.mockResolvedValue(VALID_DRAFT);

    const finalizedDraft = { id: 'd1', status: 'FINALIZED', version: 4 };
    const createdContract = { id: 'c1', title: 'Test Contract Draft', status: 'DRAFT' };

    mockTransaction.mockImplementation(async (cb: Function) => {
      // Mock the tx parameter passed to the callback
      const tx = {
        contractDraft: {
          update: vi.fn()
            .mockResolvedValueOnce(finalizedDraft) // first update: finalize
            .mockResolvedValueOnce({}),              // second update: link contract
        },
        contract: {
          create: vi.fn().mockResolvedValue(createdContract),
        },
      };
      return cb(tx);
    });

    const res = await POST(authReq(BASE), { params });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.draft.id).toBe('d1');
    expect(json.data.draft.status).toBe('FINALIZED');
    expect(json.data.contract.id).toBe('c1');
    expect(json.data.contract.title).toBe('Test Contract Draft');
  });

  it('processes JSON content correctly', async () => {
    const objContent = { blocks: [{ type: 'paragraph', text: 'Very long contract content text for testing' }] };
    mockDraftFindFirst.mockResolvedValue({
      ...VALID_DRAFT,
      content: objContent,
    });

    // content is not a string so length < 50 check won't apply with typeof guard
    // Finalization should proceed
    mockTransaction.mockImplementation(async (cb: Function) => {
      const tx = {
        contractDraft: {
          update: vi.fn().mockResolvedValue({ id: 'd1', status: 'FINALIZED', version: 4 }),
        },
        contract: {
          create: vi.fn().mockResolvedValue({ id: 'c2', title: VALID_DRAFT.title, status: 'DRAFT' }),
        },
      };
      return cb(tx);
    });

    const res = await POST(authReq(BASE), { params });
    expect(res.status).toBe(200);
  });
});
