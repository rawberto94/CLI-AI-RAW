/**
 * Tests for GET /api/agents/learning
 * Adaptive learning records from the AI correction system
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockLearningRecordFindMany: vi.fn(),
  mockLearningRecordCount: vi.fn(),
  mockLearningRecordGroupBy: vi.fn(),
}));

// ── Module mocks ───────────────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  prisma: {
    learningRecord: {
      findMany: mocks.mockLearningRecordFindMany,
      count: mocks.mockLearningRecordCount,
      groupBy: mocks.mockLearningRecordGroupBy,
    },
  },
}));

// ── Import route AFTER mocks ──────────────────────────────────────────

import { GET } from '../route';

// ── Helpers ────────────────────────────────────────────────────────────

function authReq(url: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-user-id': 'user-1', 'x-tenant-id': 'tenant-1' },
  });
}

function noAuthReq(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

const BASE = 'http://localhost:3000/api/agents/learning';

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/agents/learning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default implementations after mockReset
    mocks.mockLearningRecordFindMany.mockResolvedValue([]);
    mocks.mockLearningRecordCount.mockResolvedValue(0);
    mocks.mockLearningRecordGroupBy.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    const res = await GET(noAuthReq(BASE));
    expect(res.status).toBe(401);
  });

  it('returns records with pagination (limit/offset)', async () => {
    const records = [
      {
        id: 'lr1',
        field: 'effectiveDate',
        artifactType: 'contract',
        contractType: 'NDA',
        aiExtracted: '2024-01-01',
        userCorrected: '2024-01-15',
        confidence: 0.75,
        correctionType: 'value_correction',
        modelUsed: 'gpt-4',
        createdAt: new Date('2024-06-01'),
      },
      {
        id: 'lr2',
        field: 'partyName',
        artifactType: 'contract',
        contractType: 'MSA',
        aiExtracted: 'Acme Inc',
        userCorrected: 'Acme Corp',
        confidence: 0.6,
        correctionType: 'value_correction',
        modelUsed: 'gpt-4',
        createdAt: new Date('2024-06-02'),
      },
    ];
    mocks.mockLearningRecordFindMany.mockResolvedValue(records);
    mocks.mockLearningRecordCount.mockResolvedValue(100);
    mocks.mockLearningRecordGroupBy.mockResolvedValue([
      { correctionType: 'value_correction', _count: 80 },
      { correctionType: 'missing_field', _count: 20 },
    ]);

    const res = await GET(authReq(`${BASE}?limit=10&offset=5`));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.records).toHaveLength(2);
    expect(json.data.total).toBe(100);

    // Verify limit/offset were passed to prisma
    expect(mocks.mockLearningRecordFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 5 }),
    );
  });

  it('returns correction breakdown stats', async () => {
    mocks.mockLearningRecordFindMany.mockResolvedValue([]);
    mocks.mockLearningRecordCount.mockResolvedValue(50);
    mocks.mockLearningRecordGroupBy.mockResolvedValue([
      { correctionType: 'value_correction', _count: 30 },
      { correctionType: 'missing_field', _count: 15 },
      { correctionType: null, _count: 5 },
    ]);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.correctionBreakdown).toEqual({
      value_correction: 30,
      missing_field: 15,
      unknown: 5,
    });
  });

  it('computes average confidence from records', async () => {
    const records = [
      { id: 'lr1', field: 'a', confidence: 0.8, correctionType: 'x', createdAt: new Date() },
      { id: 'lr2', field: 'b', confidence: 0.6, correctionType: 'x', createdAt: new Date() },
      { id: 'lr3', field: 'c', confidence: null, correctionType: 'x', createdAt: new Date() },
    ];
    mocks.mockLearningRecordFindMany.mockResolvedValue(records);
    mocks.mockLearningRecordCount.mockResolvedValue(3);
    mocks.mockLearningRecordGroupBy.mockResolvedValue([]);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    // Average of 0.8 and 0.6 = 0.7, null excluded
    expect(json.data.avgConfidence).toBe(0.7);
  });

  it('handles empty results', async () => {
    mocks.mockLearningRecordFindMany.mockResolvedValue([]);
    mocks.mockLearningRecordCount.mockResolvedValue(0);
    mocks.mockLearningRecordGroupBy.mockResolvedValue([]);

    const res = await GET(authReq(BASE));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.data.records).toEqual([]);
    expect(json.data.total).toBe(0);
    expect(json.data.correctionBreakdown).toEqual({});
    expect(json.data.avgConfidence).toBe(0);
  });
});
