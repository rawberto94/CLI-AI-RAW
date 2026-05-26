import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { File as NodeFile } from 'node:buffer';

const { mockFindMany, mockCreate } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    clauseLibrary: {
      findMany: mockFindMany,
      create: mockCreate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  contractService: {},
}));

import { POST as PREVIEW } from '../upload/preview/route';
import { POST as COMMIT } from '../upload/commit/route';

function createMultipartRequest(file: File): NextRequest {
  const formData = {
    get: (name: string) => (name === 'file' ? file : null),
  } as FormData;

  return {
    headers: new Headers({
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
    }),
    formData: async () => formData,
  } as unknown as NextRequest;
}

function createJsonRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/clauses/upload/commit', {
    method: 'POST',
    headers: {
      'x-user-id': 'test-user-id',
      'x-tenant-id': 'test-tenant',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/clauses/upload/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('previews a CSV file without creating clauses', async () => {
    mockFindMany.mockResolvedValue([]);
    const file = new NodeFile([
      'title,content,category\n',
      'Confidentiality,"Each party shall keep shared information confidential.",confidentiality\n',
    ], 'clauses.csv', { type: 'text/csv' }) as File;

    const response = await PREVIEW(createMultipartRequest(file));
    const data = await response.json();

    expect(response.status, JSON.stringify(data)).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalRows).toBe(1);
    expect(data.data.validRows).toBe(1);
    expect(data.data.rows[0].title).toBe('Confidentiality');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('marks existing library clauses as duplicates', async () => {
    mockFindMany.mockResolvedValue([{ title: 'Existing Clause', name: 'existing_clause_1' }]);
    const file = new NodeFile([
      'title,content,category\n',
      'Existing Clause,"Existing clause body language.",general\n',
    ], 'clauses.csv', { type: 'text/csv' }) as File;

    const response = await PREVIEW(createMultipartRequest(file));
    const data = await response.json();

    expect(response.status, JSON.stringify(data)).toBe(200);
    expect(data.data.duplicateRows).toBe(1);
    expect(data.data.rows[0].duplicateReason).toBe('Already exists in the clause library');
  });
});

describe('POST /api/clauses/upload/commit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports valid rows and reports skipped and failed rows', async () => {
    const now = new Date();
    mockFindMany.mockResolvedValue([{ title: 'Existing Clause', name: 'existing_clause_1' }]);
    mockCreate.mockResolvedValue({
      id: 'clause-1',
      name: 'new_clause_1',
      title: 'New Clause',
      content: 'New clause body language.',
      plainText: 'New clause body language.',
      category: 'GENERAL',
      riskLevel: 'MEDIUM',
      tags: [],
      isStandard: false,
      isMandatory: false,
      isNegotiable: true,
      usageCount: 0,
      alternativeText: null,
      createdBy: 'test-user-id',
      createdAt: now,
      updatedAt: now,
    });

    const response = await COMMIT(createJsonRequest({
      rows: [
        { rowNumber: 2, title: 'New Clause', content: 'New clause body language.', category: 'general' },
        { rowNumber: 3, title: 'Existing Clause', content: 'Existing clause body language.', category: 'general' },
        { rowNumber: 4, title: 'Broken Clause', content: '', category: '' },
      ],
    }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.createdCount).toBe(1);
    expect(data.data.skippedCount).toBe(1);
    expect(data.data.failedCount).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});